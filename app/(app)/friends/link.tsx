import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../../src/components/ActionButton';
import { AppScreen } from '../../../src/components/AppScreen';
import { SavedProfileLinkChooser } from '../../../src/components/profile';
import { SectionCard } from '../../../src/components/SectionCard';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../src/features/theme/themes';
import { backOnce, replaceOnce } from '../../../src/lib/navigationGuard';
import type { Contact } from '../../../src/types/domain';
import { protectTextFromFontClipping } from '../../../src/theme/fontProtection';
import type { FontSet } from '../../../src/theme/typography';
import { radius, spacing } from '../../../src/theme/tokens';

export default function LinkFriendChooserScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ friendId?: string }>();
  const friendId = (params.friendId ?? '').toString();
  const { currentUser } = useAuth();
  const {
    contacts,
    getUserById,
    getManualContactCandidatesForFriend,
    getPendingFriendLinks,
    linkContactToFriend,
    createLinkedContactForFriend,
    isConnected,
  } = useSocialGraph();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const [busyContactId, setBusyContactId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [error, setError] = useState('');

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;
  const me = currentUser;
  const pendingLinks = getPendingFriendLinks(me.id);
  const friend = friendId ? getUserById(friendId) : undefined;

  if (!friendId) {
    return (
      <AppScreen>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Friend matches</Text>
          <Text style={styles.title}>Review saved profiles</Text>
          <Text style={styles.subtitle}>
            Choose whether each new friend should connect to a saved profile, or create a fresh one.
          </Text>
        </View>

        {pendingLinks.length > 0 ? (
          <SectionCard title="Needs review">
            <View style={styles.list}>
              {pendingLinks.map(({ friend: pendingFriend, candidates }) => (
                <Pressable
                  key={pendingFriend.id}
                  onPress={() => replaceOnce(router, `/(app)/friends/link?friendId=${pendingFriend.id}`)}
                  style={({ pressed }) => [styles.reviewRow, pressed && styles.pressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`Review match for ${pendingFriend.displayName}`}
                >
                  <Ionicons name="git-merge-outline" size={18} color={colors.accent} />
                  <View style={styles.body}>
                    <Text style={styles.reviewTitle}>{pendingFriend.displayName}</Text>
                    <Text style={styles.reviewEmail}>{pendingFriend.email}</Text>
                    <Text style={styles.reviewSubtitle}>
                      {candidates.length} saved {candidates.length === 1 ? 'profile may' : 'profiles may'} match.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />
                </Pressable>
              ))}
            </View>
          </SectionCard>
        ) : (
          <SectionCard title="All caught up">
            <Text style={styles.note}>There are no friend matches waiting for review.</Text>
          </SectionCard>
        )}

        <Pressable style={styles.laterButton} onPress={() => backOnce(router)} accessibilityRole="button">
          <Text style={styles.laterLabel}>Go back</Text>
        </Pressable>
      </AppScreen>
    );
  }

  if (!friend) {
    return (
      <AppScreen>
        <View style={styles.hero}>
          <Text style={styles.title}>We couldn't find that friend.</Text>
          <Text style={styles.subtitle}>They may have removed their account, or the link is out of date.</Text>
        </View>
        <ActionButton label="Go back" onPress={() => backOnce(router)} />
      </AppScreen>
    );
  }

  if (!isConnected(me.id, friend.id)) {
    return (
      <AppScreen>
        <View style={styles.hero}>
          <Text style={styles.title}>You're not connected with {friend.displayName} yet.</Text>
          <Text style={styles.subtitle}>Add them by friend code first, then choose how to link them up.</Text>
        </View>
        <ActionButton label="Go back" onPress={() => backOnce(router)} />
      </AppScreen>
    );
  }

  const candidates = getManualContactCandidatesForFriend(me.id, friend.id);
  const unlinkedContacts = contacts.filter((contact) => contact.ownerUserId === me.id && !contact.linkedUserId);

  const goToContact = (contactId: string) => {
    replaceOnce(router, `/(app)/profiles/contact/${contactId}`);
  };

  const linkContact = async (contact: Contact) => {
    setBusyContactId(contact.id);
    setError('');
    const result = await linkContactToFriend(contact.id, me.id, friend.id);
    if (!result.ok) {
      setBusyContactId(null);
      setError(result.error);
      return;
    }
    Alert.alert(
      'Linked',
      `${contact.displayName} is now connected to ${friend.displayName}. Old memories you saved have moved over.`,
    );
    goToContact(contact.id);
  };

  const handlePickCandidate = (contact: Contact) => {
    Alert.alert(
      'Connect this profile?',
      `Connect the ${friend.email} account to your saved ${contact.displayName} profile?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Connect', onPress: () => linkContact(contact) },
      ],
    );
  };

  const handleCreateNew = async () => {
    setCreatingNew(true);
    setError('');
    const result = await createLinkedContactForFriend(me.id, friend.id);
    if (!result.ok) {
      setCreatingNew(false);
      setError(result.error);
      return;
    }
    goToContact(result.contactId);
  };

  return (
    <AppScreen>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>New connection</Text>
        <Text style={styles.title}>{friend.displayName} is on Your Friends.</Text>
        <Text style={styles.accountEmail}>Account email: {friend.email}</Text>
        <Text style={styles.subtitle}>
          Is this someone you already saved? Choose a saved profile to connect, or create a new one.
        </Text>
      </View>

      {unlinkedContacts.length > 0 ? (
        <SavedProfileLinkChooser
          allContacts={unlinkedContacts}
          busyContactId={busyContactId}
          colors={colors}
          disabled={creatingNew}
          fonts={fonts}
          onSelect={handlePickCandidate}
          suggestedContacts={candidates}
        />
      ) : null}

      <SectionCard eyebrow="None of these" title={`Create a new profile for ${friend.displayName}`}>
        <Text style={styles.note}>
          We'll add a fresh profile linked to their real account. You can always merge later from one of your existing profiles.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <ActionButton
          label={creatingNew ? 'Creating…' : `Create new ${shortFirstName(friend.displayName)}`}
          onPress={handleCreateNew}
          disabled={creatingNew || busyContactId !== null}
        />
      </SectionCard>

      <Pressable style={styles.laterButton} onPress={() => backOnce(router)} accessibilityRole="button">
        <Text style={styles.laterLabel}>Decide later</Text>
      </Pressable>
    </AppScreen>
  );
}

function shortFirstName(displayName: string): string {
  const first = displayName.trim().split(/\s+/)[0] ?? displayName;
  return first;
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    hero: { gap: spacing.xs, paddingHorizontal: spacing.md, paddingTop: spacing.md },
    eyebrow: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: colors.accent,
    },
    title: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 24) },
    accountEmail: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accent },
    subtitle: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, lineHeight: 20 },
    note: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, lineHeight: 20 },
    list: { gap: spacing.sm, marginTop: spacing.sm },
    body: { flex: 1, gap: 2 },
    reviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.paperMuted,
      borderWidth: 1,
      borderColor: colors.line,
      padding: spacing.md,
    },
    reviewTitle: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
    reviewEmail: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.accent },
    reviewSubtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
    pressed: { transform: [{ scale: 0.99 }] },
    error: { fontFamily: fonts.body, fontSize: 13, color: colors.error },
    laterButton: { alignSelf: 'center', padding: spacing.md },
    laterLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 14,
      color: colors.inkSoft,
      textDecorationLine: 'underline',
    },
  });
