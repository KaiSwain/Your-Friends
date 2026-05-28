import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { OnboardingFrame } from '../../src/features/onboarding/OnboardingFrame';
import { useTheme } from '../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../src/features/theme/themes';
import { pushOnce } from '../../src/lib/navigationGuard';
import { protectTextFromFontClipping } from '../../src/theme/fontProtection';
import type { FontSet } from '../../src/theme/typography';
import { radius, spacing } from '../../src/theme/tokens';

export default function OnboardingPrivateNotesScreen() {
  const router = useRouter();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <OnboardingFrame
      step={7}
      totalSteps={13}
      eyebrow="Private notes"
      title="Write down what you want to remember."
      subtitle="Private notes live on a friend’s profile, but only you can see them. Use them for gift ideas, links, photos, or little details you do not want to forget."
      footer={<ActionButton label="Got it" onPress={() => pushOnce(router, '/(onboarding)/ai-captions')} />}
    >
      <View style={styles.profileCard}>
        <View style={styles.heroRow}>
          <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
            <Text style={styles.avatarText}>M</Text>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.name}>Maya</Text>
            <Text style={styles.subtitle}>birthday in June • loves ceramics</Text>
          </View>
        </View>
        <View style={styles.tabRow}>
          <View style={styles.tabInactive}><Text style={styles.tabInactiveText}>Profile</Text></View>
          <View style={styles.tabActive}><Text style={[styles.tabActiveText, { color: colors.accent }]}>Private notes</Text></View>
        </View>
        <View style={styles.noteCard}>
          <View style={styles.noteHeader}>
            <Ionicons name="lock-closed" size={14} color={colors.accent} />
            <Text style={styles.noteTitle}>Things to remember</Text>
          </View>
          <Text style={styles.noteBody}>Loves ceramics. Usually gets oat milk. Ask about the studio class.</Text>
          <View style={styles.linkPill}>
            <Ionicons name="link-outline" size={14} color={colors.accent} />
            <Text style={styles.linkText}>Gift idea link saved here</Text>
          </View>
        </View>
        <View style={styles.noteCardMuted}>
          <View style={styles.noteHeader}>
            <Ionicons name="sparkles-outline" size={14} color={colors.ink} />
            <Text style={styles.noteMutedTitle}>Why it helps</Text>
          </View>
          <Text style={styles.noteMutedBody}>When you open their profile later, the context is right there for you.</Text>
        </View>
      </View>
    </OnboardingFrame>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    profileCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      padding: spacing.md,
      gap: spacing.md,
      shadowColor: colors.black,
      shadowOpacity: 0.12,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 4,
    },
    heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    avatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { fontFamily: fonts.heading, fontSize: 26, color: colors.white, ...protectTextFromFontClipping(fonts.heading, 26) },
    heroCopy: { flex: 1, gap: 2 },
    name: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 24) },
    subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft },
    tabRow: {
      flexDirection: 'row',
      borderRadius: radius.pill,
      backgroundColor: colors.paperMuted,
      padding: 4,
      gap: 4,
    },
    tabInactive: { flex: 1, paddingVertical: 8, alignItems: 'center' },
    tabInactiveText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted },
    tabActive: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: radius.pill,
      backgroundColor: colors.paper,
    },
    tabActiveText: { fontFamily: fonts.bodyBold, fontSize: 12 },
    noteCard: {
      gap: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.paper,
      padding: spacing.md,
    },
    noteHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    noteTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
    noteBody: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.ink },
    linkPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.paper,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
    },
    linkText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.accent },
    noteCardMuted: {
      gap: spacing.xs,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
      padding: spacing.md,
    },
    noteMutedTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.inkSoft },
    noteMutedBody: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  });
