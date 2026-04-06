import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../../../src/components/ActionButton';
import { AppScreen } from '../../../../src/components/AppScreen';
import { ProfileHeroCard } from '../../../../src/components/ProfileHeroCard';
import { SectionCard } from '../../../../src/components/SectionCard';
import { WallPostCard } from '../../../../src/components/WallPostCard';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../../src/features/theme/themes';
import { fonts } from '../../../../src/theme/typography';
import { radius, spacing } from '../../../../src/theme/tokens';

export default function UserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId: string | string[] }>();
  const { currentUser } = useAuth();
  const { getUserById, isConnected, getWallPostsForSubject, getFriendFactsFor, addFriendFact, deleteFriendFact } = useSocialGraph();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [newFact, setNewFact] = useState('');
  const [factBusy, setFactBusy] = useState(false);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;

  // Self-profile redirects to Settings
  if (userId === currentUser.id) {
    return <Redirect href="/(app)/settings" />;
  }

  const profileUser = userId ? getUserById(userId) : undefined;

  if (!profileUser) {
    return (
      <AppScreen>
        <SectionCard title="We could not find that person.">
          <ActionButton label="Back to friends" onPress={() => router.replace('/(app)/friends')} />
        </SectionCard>
      </AppScreen>
    );
  }

  const connected = isConnected(currentUser.id, profileUser.id);
  const wallPosts = getWallPostsForSubject(profileUser.id, 'user');
  // Viewer-centric: show facts YOU wrote about this friend
  const myFacts = getFriendFactsFor(currentUser.id, profileUser.id);

  async function handleAddFact() {
    if (!newFact.trim()) return;
    setFactBusy(true);
    try {
      await addFriendFact(currentUser!.id, { subjectUserId: profileUser!.id, body: newFact.trim() });
      setNewFact('');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setFactBusy(false);
  }

  function handleDeleteFact(factId: string) {
    Alert.alert('Delete fact?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteFriendFact(factId) },
    ]);
  }

  return (
    <AppScreen>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backLabel}>← Back</Text>
      </Pressable>

      <ProfileHeroCard
        accentColor={profileUser.avatarColor}
        name={profileUser.displayName}
        subtitle={connected ? 'Connected friend' : `Friend code ${profileUser.friendCode}`}
      />

      {connected && (
        <ActionButton
          label="View Your Wall"
          onPress={() => router.push(`/(app)/wall/${profileUser.id}`)}
          variant="primary"
        />
      )}

      {/* Facts YOU wrote about this friend */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Notes</Text>
        </View>
        {myFacts.length > 0 ? (
          <View style={styles.factList}>
            {myFacts.map((fact) => (
              <View key={fact.id} style={styles.factRow}>
                <Text style={styles.factText}>{fact.body}</Text>
                <Pressable onPress={() => handleDeleteFact(fact.id)}>
                  <Text style={styles.deleteLink}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyHint}>No notes yet. Add something you want to remember about {profileUser.displayName}.</Text>
        )}
        <View style={styles.addFactRow}>
          <TextInput
            style={styles.addFactInput}
            value={newFact}
            onChangeText={setNewFact}
            placeholder="Add a note…"
            placeholderTextColor={colors.inkMuted}
          />
          <Pressable onPress={handleAddFact} disabled={factBusy} style={styles.addFactButton}>
            <Text style={styles.addFactButtonLabel}>{factBusy ? '…' : '+'}</Text>
          </Pressable>
        </View>
      </View>

      {/* Memory wall */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Memory Wall</Text>
          <Pressable onPress={() => router.push(`/(app)/memories/add?subjectId=${profileUser.id}&subjectType=user`)}>
            <Text style={styles.addLink}>Add</Text>
          </Pressable>
        </View>
        {wallPosts.length > 0 ? (
          <View style={styles.wallList}>
            {wallPosts.map((post) => {
              const author = getUserById(post.authorUserId);
              return <WallPostCard key={post.id} authorName={author?.displayName ?? 'Unknown'} post={post} />;
            })}
          </View>
        ) : (
          <Text style={styles.emptyHint}>No memories yet. Be the first to write one.</Text>
        )}
      </View>
    </AppScreen>
  );
}

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    backButton: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
    backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
    section: { gap: spacing.sm },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
    addLink: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.accent },
    factList: { gap: spacing.xs },
    factRow: {
      flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm,
      borderBottomWidth: 1, borderBottomColor: colors.line,
    },
    factText: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink },
    deleteLink: { fontFamily: fonts.heading, fontSize: 20, color: colors.error, paddingLeft: spacing.sm },
    emptyHint: { fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted },
    addFactRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
    addFactInput: {
      flex: 1, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1,
      borderColor: colors.line, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
      fontFamily: fonts.body, fontSize: 14, color: colors.ink,
    },
    addFactButton: {
      width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.accent,
      alignItems: 'center', justifyContent: 'center',
    },
    addFactButtonLabel: { fontFamily: fonts.heading, fontSize: 22, color: colors.white },
    wallList: { gap: spacing.md },
  });
