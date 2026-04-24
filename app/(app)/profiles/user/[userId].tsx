import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../../../src/components/ActionButton';
import { AppScreen } from '../../../../src/components/AppScreen';
import { SectionCard } from '../../../../src/components/SectionCard';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../../src/features/theme/themes';
import { type FontSet } from '../../../../src/theme/typography';
import { spacing } from '../../../../src/theme/tokens';

export default function UserProfileScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ userId: string | string[] }>();
  const { currentUser } = useAuth();
  const { contacts, getUserById, isConnected, refresh } = useSocialGraph();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;

  if (userId === currentUser.id) {
    return <Redirect href="/(app)/profiles/me" />;
  }

  const profileUser = userId ? getUserById(userId) : undefined;
  const ownedLinkedContact = userId
    ? contacts.find((contact) => contact.ownerUserId === currentUser.id && contact.linkedUserId === userId)
    : undefined;

  if (ownedLinkedContact) {
    return <Redirect href={`/(app)/profiles/contact/${ownedLinkedContact.id}`} />;
  }

  const topBar = (
    <View style={styles.topBar}>
      <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>
    </View>
  );

  if (!profileUser) {
    return (
      <AppScreen header={topBar} floatingHeaderOnScroll>
        <SectionCard title="We could not find that person.">
          <ActionButton label="Back to friends" onPress={() => router.replace('/(app)/friends')} />
        </SectionCard>
      </AppScreen>
    );
  }

  if (isConnected(currentUser.id, profileUser.id)) {
    return (
      <AppScreen header={topBar} floatingHeaderOnScroll>
        <View style={styles.hero}>
          <Text style={styles.title}>Finishing friend setup...</Text>
          <Text style={styles.subtitle}>
            {profileUser.displayName} is now a connected friend. Their editable profile lives in your private contact card,
            and this screen will redirect there once sync finishes.
          </Text>
        </View>
        <ActionButton label="Refresh" onPress={() => void refresh()} />
        <ActionButton label="Back to friends" onPress={() => router.replace('/(app)/friends')} variant="secondary" />
      </AppScreen>
    );
  }

  return (
    <AppScreen header={topBar} floatingHeaderOnScroll>
      <SectionCard title="This friend view has moved.">
        <Text style={styles.emptyHint}>
          Connected friends now use your editable contact-style profile instead of the old read-only screen.
        </Text>
      </SectionCard>
      <ActionButton label="Back to friends" onPress={() => router.replace('/(app)/friends')} />
    </AppScreen>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    backButton: { paddingVertical: spacing.xs },
    backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
    hero: { gap: spacing.sm },
    title: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink },
    subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
    emptyHint: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.inkMuted },
  });