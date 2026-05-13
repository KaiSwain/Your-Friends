import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../../src/components/ActionButton';
import { AppScreen } from '../../../src/components/AppScreen';
import { SectionCard } from '../../../src/components/SectionCard';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../src/features/theme/themes';
import type { Contact } from '../../../src/types/domain';
import type { FontSet } from '../../../src/theme/typography';
import { radius, shadow, spacing } from '../../../src/theme/tokens';

export default function LinkFriendChooserScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ friendId?: string }>();
  const friendId = (params.friendId ?? '').toString();
  const { currentUser } = useAuth();
  const {
    getUserById,
    getManualContactCandidatesForFriend,
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
  const friend = friendId ? getUserById(friendId) : undefined;

  if (!friend) {
    return (
      <AppScreen>
        <View style={styles.hero}>
          <Text style={styles.title}>We couldn't find that friend.</Text>
          <Text style={styles.subtitle}>They may have removed their account, or the link is out of date.</Text>
        </View>
        <ActionButton label="Go back" onPress={() => router.back()} />
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
        <ActionButton label="Go back" onPress={() => router.back()} />
      </AppScreen>
    );
  }

  const candidates = getManualContactCandidatesForFriend(me.id, friend.id);

  const goToContact = (contactId: string) => {
    router.replace(`/(app)/profiles/contact/${contactId}`);
  };

  const handlePickCandidate = async (contact: Contact) => {
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
        <Text style={styles.subtitle}>
          {candidates.length === 0
            ? 'Pick how you want to save them.'
            : `Do you already have a profile for ${shortFirstName(friend.displayName)}? Pick the right one, or start fresh.`}
        </Text>
      </View>

      {candidates.length > 0 && (
        <SectionCard eyebrow="Existing profiles" title={`Your ${shortFirstName(friend.displayName)}s`}>
          <Text style={styles.note}>
            We won't merge anyone automatically. Tap the profile that matches {friend.displayName}, or create a new one below.
          </Text>
          <View style={styles.list}>
            {candidates.map((candidate) => (
              <CandidateRow
                key={candidate.id}
                contact={candidate}
                colors={colors}
                fonts={fonts}
                disabled={busyContactId !== null || creatingNew}
                busy={busyContactId === candidate.id}
                onPress={() => handlePickCandidate(candidate)}
              />
            ))}
          </View>
        </SectionCard>
      )}

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

      <Pressable style={styles.laterButton} onPress={() => router.back()} accessibilityRole="button">
        <Text style={styles.laterLabel}>Decide later</Text>
      </Pressable>
    </AppScreen>
  );
}

interface CandidateRowProps {
  contact: Contact;
  colors: ColorTokens;
  fonts: FontSet;
  disabled: boolean;
  busy: boolean;
  onPress: () => void;
}

function CandidateRow({ contact, colors, fonts, disabled, busy, onPress }: CandidateRowProps) {
  const styles = useMemo(() => makeRowStyles(colors, fonts), [colors, fonts]);
  const clueParts: string[] = [];
  if (contact.nickname) clueParts.push(`"${contact.nickname}"`);
  if (contact.tags.length > 0) clueParts.push(contact.tags.slice(0, 2).join(' · '));
  if (contact.facts.length > 0) clueParts.push(contact.facts[0]);
  const clue = clueParts.join(' · ');

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && !busy && styles.dim]}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarLabel}>{getInitials(contact.displayName)}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{contact.displayName}</Text>
        {clue ? <Text style={styles.subtitle}>{clue}</Text> : null}
        <Text style={styles.caption}>Saved {formatRelativeDate(contact.createdAt)}</Text>
      </View>
      <Ionicons
        name={busy ? 'hourglass-outline' : 'chevron-forward'}
        size={18}
        color={colors.inkSoft}
      />
    </Pressable>
  );
}

function shortFirstName(displayName: string): string {
  const first = displayName.trim().split(/\s+/)[0] ?? displayName;
  return first;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

function formatRelativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffDays = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
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
    title: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink },
    subtitle: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, lineHeight: 20 },
    note: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, lineHeight: 20 },
    list: { gap: spacing.sm, marginTop: spacing.sm },
    error: { fontFamily: fonts.body, fontSize: 13, color: colors.error },
    laterButton: { alignSelf: 'center', padding: spacing.md },
    laterLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 14,
      color: colors.inkSoft,
      textDecorationLine: 'underline',
    },
  });

const makeRowStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.paperMuted,
      borderWidth: 1,
      borderColor: colors.line,
      padding: spacing.md,
      ...shadow.card,
    },
    pressed: { transform: [{ scale: 0.99 }] },
    dim: { opacity: 0.5 },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    avatarLabel: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white },
    body: { flex: 1, gap: 2 },
    title: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
    subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
    caption: { fontFamily: fonts.body, fontSize: 11, color: colors.inkSoft, opacity: 0.7 },
  });
