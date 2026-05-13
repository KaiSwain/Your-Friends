import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { OnboardingFrame } from '../../src/features/onboarding/OnboardingFrame';
import { useTheme } from '../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../src/features/theme/themes';
import type { FontSet } from '../../src/theme/typography';
import { radius, spacing } from '../../src/theme/tokens';

interface PrivacyPoint {
  icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;
  title: string;
  body: string;
}

const POINTS: PrivacyPoint[] = [
  {
    icon: 'lock-closed-outline',
    title: 'Private by default',
    body: 'Memories are only visible to you unless you choose to share them with a specific friend.',
  },
  {
    icon: 'eye-off-outline',
    title: 'No public feed',
    body: 'There is no algorithm, no follower count, and no public profiles. Your scrapbook stays personal.',
  },
  {
    icon: 'cloud-outline',
    title: 'Yours to keep',
    body: "Photos and notes are stored securely so you can see them on your devices — and only yours.",
  },
  {
    icon: 'trash-outline',
    title: 'Delete anytime',
    body: 'You can remove a memory, a contact, or your whole account whenever you want. No questions asked.',
  },
];

export default function OnboardingPrivacyScreen() {
  const router = useRouter();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <OnboardingFrame
      step={2}
      totalSteps={7}
      eyebrow="Your data is yours"
      title="A quiet, private corner of the internet."
      subtitle="Before we go further, here's how Your Friends treats what you put in it."
      footer={
        <ActionButton label="I get it — keep going" onPress={() => router.push('/(onboarding)/tutorial')} />
      }
    >
      <View style={styles.list}>
        {POINTS.map((point) => (
          <View key={point.title} style={styles.row}>
            <View style={styles.iconBubble}>
              <Ionicons name={point.icon} size={18} color={colors.accent} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{point.title}</Text>
              <Text style={styles.rowBodyText}>{point.body}</Text>
            </View>
          </View>
        ))}
      </View>
    </OnboardingFrame>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    list: { gap: spacing.md },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    iconBubble: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.accent + '18',
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowBody: { flex: 1, gap: 4 },
    rowTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    rowBodyText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.inkSoft },
  });
