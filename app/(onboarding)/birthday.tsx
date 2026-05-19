import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { BirthdaySliderPicker } from '../../src/components/BirthdaySliderPicker';
import { useAuth } from '../../src/features/auth/AuthContext';
import { OnboardingFrame } from '../../src/features/onboarding/OnboardingFrame';
import { useTheme } from '../../src/features/theme/ThemeContext';
import { getDefaultBirthdayIso } from '../../src/lib/birthday';

export default function OnboardingBirthdayScreen() {
  const router = useRouter();
  const { currentUser, updateProfile } = useAuth();
  const { colors, fonts } = useTheme();
  const [birthday, setBirthday] = useState(currentUser?.birthday ?? getDefaultBirthdayIso());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;
  if (currentUser.birthday) return <Redirect href="/friends" />;

  async function handleSave() {
    setBusy(true);
    setError('');
    try {
      await updateProfile({ birthday });
      router.replace('/friends');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your birthday.');
      setBusy(false);
    }
  }

  return (
    <OnboardingFrame
      step={0}
      totalSteps={1}
      eyebrow="One more thing"
      title="When is your birthday?"
      subtitle="We’ll add it to your friends’ calendars automatically so they never miss your day."
      hideBack
      scrollable
      footer={
        <ActionButton
          label={busy ? 'Saving…' : 'Save birthday'}
          onPress={handleSave}
          disabled={busy}
        />
      }
    >
      <BirthdaySliderPicker value={birthday} onChange={setBirthday} />
      {error ? (
        <Text style={[styles.error, { color: colors.error, fontFamily: fonts.body }]}>{error}</Text>
      ) : null}
      <View style={styles.spacer} />
      <Text style={[styles.tip, { color: colors.inkMuted, fontFamily: fonts.body }]}>
        This creates a yearly birthday reminder for your connected friends.
      </Text>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  spacer: { height: 8 },
  error: { fontSize: 13 },
  tip: { fontSize: 12 },
});
