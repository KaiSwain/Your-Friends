import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { FormField } from '../../src/components/FormField';
import { useAuth } from '../../src/features/auth/AuthContext';
import { OnboardingFrame } from '../../src/features/onboarding/OnboardingFrame';
import { useTheme } from '../../src/features/theme/ThemeContext';

export default function OnboardingWelcomeScreen() {
  const router = useRouter();
  const { currentUser, updateProfile } = useAuth();
  const { colors, fonts } = useTheme();

  // Don't pre-fill from the email-prefix fallback that signUp set on the profile —
  // a blank field with a placeholder reads better than auto-populated text the user
  // didn't actually choose.
  const isPlaceholderName =
    !!currentUser?.displayName &&
    !!currentUser?.email &&
    currentUser.displayName === currentUser.email.split('@')[0];
  const [displayName, setDisplayName] = useState(
    isPlaceholderName ? '' : currentUser?.displayName ?? '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleNext() {
    const trimmed = displayName.trim();
    if (!trimmed) {
      setError('Please add a display name so your friends can find you.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (currentUser && trimmed !== currentUser.displayName) {
        await updateProfile({ displayName: trimmed });
      }
      router.push('/(onboarding)/referral');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save your name.';
      setError(message);
      setBusy(false);
    }
  }

  return (
    <OnboardingFrame
      step={0}
      totalSteps={7}
      eyebrow="Welcome"
      title="What should we call you?"
      subtitle="This is the name your friends will see. You can change it later in settings."
      hideBack
      footer={
        <ActionButton
          label={busy ? 'Saving…' : 'Continue'}
          onPress={handleNext}
          disabled={busy}
        />
      }
    >
      <FormField
        autoCapitalize="words"
        label="Display name"
        onChangeText={setDisplayName}
        placeholder="e.g. Kai"
        value={displayName}
      />
      {error ? (
        <Text style={[styles.error, { color: colors.error, fontFamily: fonts.body }]}>{error}</Text>
      ) : null}
      <View style={styles.spacer} />
      <Text style={[styles.tip, { color: colors.inkMuted, fontFamily: fonts.body }]}>
        Tip: a first name or short nickname works best.
      </Text>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  spacer: { height: 8 },
  error: { fontSize: 13 },
  tip: { fontSize: 12 },
});
