import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
import { spacing } from '../../../../src/theme/tokens';

export default function ContactProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ contactId: string | string[] }>();
  const { currentUser } = useAuth();
  const { getContactById, getUserById, getPeopleListForUser, getWallPostsForSubject } = useSocialGraph();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  const contactId = Array.isArray(params.contactId) ? params.contactId[0] : params.contactId;
  const contact = contactId ? getContactById(contactId) : undefined;

  if (!contact || contact.ownerUserId !== currentUser.id) {
    return (
      <AppScreen>
        <SectionCard title="That contact is not in your private list.">
          <ActionButton label="Back to friends" onPress={() => router.replace('/(app)/friends')} />
        </SectionCard>
      </AppScreen>
    );
  }

  const linkedUser = contact.linkedUserId ? getUserById(contact.linkedUserId) : undefined;
  const accentColor = getPeopleListForUser(currentUser.id).find((item) => item.id === contact.id)?.avatarColor ?? colors.apricot;
  const wallPosts = getWallPostsForSubject(contact.id, 'contact');

  return (
    <AppScreen>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backLabel}>← Back</Text>
      </Pressable>

      <ProfileHeroCard
        accentColor={accentColor}
        name={contact.displayName}
        subtitle={contact.nickname ? `Saved as ${contact.nickname}` : 'Private contact'}
      />

      {linkedUser && (
        <ActionButton
          label={`Open ${linkedUser.displayName}'s profile`}
          onPress={() => router.push(`/(app)/profiles/user/${linkedUser.id}`)}
          variant="secondary"
        />
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Facts</Text>
          <Pressable><Text style={styles.addLink}>Add</Text></Pressable>
        </View>
        {contact.facts.length > 0 ? (
          <View style={styles.factList}>
            {contact.facts.map((fact) => (
              <View key={fact} style={styles.factRow}>
                <Text style={styles.factText}>{fact}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyHint}>No facts added yet.</Text>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Memory Wall</Text>
          <Pressable onPress={() => router.push(`/(app)/memories/add?subjectId=${contact.id}&subjectType=contact`)}>
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
    factRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
    factText: { fontFamily: fonts.body, fontSize: 15, color: colors.ink },
    emptyHint: { fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted },
    wallList: { gap: spacing.md },
  });
