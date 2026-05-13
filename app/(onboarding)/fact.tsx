import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { FormField } from '../../src/components/FormField';
import { useAuth } from '../../src/features/auth/AuthContext';
import { OnboardingFrame } from '../../src/features/onboarding/OnboardingFrame';
import { useTheme } from '../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../src/features/theme/themes';
import type { FontSet } from '../../src/theme/typography';
import { spacing } from '../../src/theme/tokens';

const SUGGESTIONS = [
  'I make really good pancakes.',
  'I cry at every Pixar movie.',
  'I collect ticket stubs.',
  'I love long walks at golden hour.',
  'I always pick the window seat.',
];

export default function OnboardingFactScreen() {
  const router = useRouter();
  const { currentUser, updateProfile } = useAuth();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const [fact, setFact] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleContinue() {
    if (busy) return;
    const trimmed = fact.trim();
    if (!trimmed) {
      Alert.alert('One little thing', 'Share one fact about yourself — even a small one.');
      return;
    }
    setBusy(true);
    try {
      const existing = currentUser?.profileFacts ?? [];
      // Prepend the new fact so it shows first on the user's profile.
      const next = [trimmed, ...existing.filter((f) => f.trim() !== trimmed)];
      await updateProfile({ profileFacts: next });
      router.push('/(onboarding)/paywall');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save your fact.';
      Alert.alert('Hmm', message);
      setBusy(false);
    }
  }

  function handleSkip() {
    if (busy) return;
    router.push('/(onboarding)/paywall');
  }

  return (
    <OnboardingFrame
      step={5}
      totalSteps={7}
      eyebrow="One little thing"
      title="Tell us a fact about you."
      subtitle="A small detail your friends will smile at — a habit, a quirk, something you love."
      footer={
        <ActionButton
          label={busy ? 'Saving…' : 'Continue'}
          onPress={handleContinue}
          disabled={busy || !fact.trim()}
        />
      }
    >
      <FormField
        label="A fact about you"
        placeholder="e.g. I make really good pancakes."
        value={fact}
        onChangeText={setFact}
        autoCapitalize="sentences"
      />
      <View style={styles.suggestionsBlock}>
        <Text style={styles.suggestionsLabel}>Need a nudge?</Text>
        <View style={styles.suggestionsRow}>
          {SUGGESTIONS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setFact(s)}
              style={({ pressed }) => [styles.suggestion, pressed && styles.suggestionPressed]}
              accessibilityRole="button"
            >
              <Text style={styles.suggestionLabel}>{s}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </OnboardingFrame>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    suggestionsBlock: { gap: spacing.xs, marginTop: spacing.sm },
    suggestionsLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.inkSoft,
    },
    suggestionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    suggestion: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
    },
    suggestionPressed: { opacity: 0.7 },
    suggestionLabel: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.ink,
    },
    skipButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
    },
    skipLabel: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.inkSoft,
      textDecorationLine: 'underline',
    },
  });
