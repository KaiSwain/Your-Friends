import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { OnboardingFrame } from '../../src/features/onboarding/OnboardingFrame';
import { useOnboarding, type ReferralSource } from '../../src/features/onboarding/OnboardingContext';
import { useTheme } from '../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../src/features/theme/themes';
import type { FontSet } from '../../src/theme/typography';
import { radius, spacing } from '../../src/theme/tokens';

interface ReferralOption {
  value: ReferralSource;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const OPTIONS: ReferralOption[] = [
  { value: 'friend', label: 'A friend told me', icon: 'people-outline' },
  { value: 'social', label: 'Social media', icon: 'sparkles-outline' },
  { value: 'app_store', label: 'App Store', icon: 'cloud-download-outline' },
  { value: 'web_search', label: 'Web search', icon: 'search-outline' },
  { value: 'press', label: 'Article or podcast', icon: 'newspaper-outline' },
  { value: 'other', label: 'Somewhere else', icon: 'ellipsis-horizontal' },
];

export default function OnboardingReferralScreen() {
  const router = useRouter();
  const { setReferralSource, referralSource } = useOnboarding();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const [selected, setSelected] = useState<ReferralSource | null>(referralSource);
  const [busy, setBusy] = useState(false);

  async function handleNext() {
    if (!selected) return;
    setBusy(true);
    await setReferralSource(selected);
    router.push('/(onboarding)/privacy');
  }

  return (
    <OnboardingFrame
      step={1}
      totalSteps={7}
      eyebrow="Quick question"
      title="How did you hear about Your Friends?"
      subtitle="No wrong answers — this just helps us understand how people are finding the app."
      footer={
        <ActionButton
          label={busy ? 'Saving…' : 'Continue'}
          onPress={handleNext}
          disabled={busy || !selected}
        />
      }
    >
      <View style={styles.optionList}>
        {OPTIONS.map((opt) => {
          const isActive = selected === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setSelected(opt.value)}
              style={({ pressed }) => [
                styles.option,
                isActive && styles.optionActive,
                pressed && styles.optionPressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={opt.label}
            >
              <Ionicons
                name={opt.icon}
                size={20}
                color={isActive ? colors.accent : colors.inkSoft}
              />
              <Text style={[styles.optionLabel, isActive && styles.optionLabelActive]}>
                {opt.label}
              </Text>
              {isActive ? (
                <Ionicons name="checkmark-circle" size={20} color={colors.accent} />
              ) : (
                <View style={styles.checkPlaceholder} />
              )}
            </Pressable>
          );
        })}
      </View>
    </OnboardingFrame>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    optionList: { gap: spacing.sm },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
    },
    optionActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accent + '14',
    },
    optionPressed: { transform: [{ scale: 0.99 }] },
    optionLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
    optionLabelActive: { color: colors.ink },
    checkPlaceholder: { width: 20, height: 20 },
    skipButton: { alignSelf: 'center', padding: spacing.sm },
    skipLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: colors.inkSoft,
      textDecorationLine: 'underline',
    },
  });
