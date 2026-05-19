import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { AppScreen } from '../../src/components/AppScreen';
import { FormField } from '../../src/components/FormField';
import { useAuth } from '../../src/features/auth/AuthContext';
import { useTheme } from '../../src/features/theme/ThemeContext';
import { backOnce, replaceOnce } from '../../src/lib/navigationGuard';
import { protectTextFromFontClipping } from '../../src/theme/fontProtection';
import type { ColorTokens } from '../../src/features/theme/themes';
import type { FontSet } from '../../src/theme/typography';
import { spacing } from '../../src/theme/tokens';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ recoveryUrl?: string | string[] }>();
  const { requestPasswordReset, recoverPasswordFromUrl, updatePassword } = useAuth();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const recoveryUrl = Array.isArray(params.recoveryUrl) ? params.recoveryUrl[0] : params.recoveryUrl;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [readyToUpdate, setReadyToUpdate] = useState(Boolean(recoveryUrl));

  useEffect(() => {
    if (!recoveryUrl) return;
    setBusy(true);
    recoverPasswordFromUrl(decodeURIComponent(recoveryUrl)).then((result) => {
      if (!result.ok) setError(result.error);
      else setReadyToUpdate(true);
      setBusy(false);
    });
  }, [recoveryUrl, recoverPasswordFromUrl]);

  async function sendResetEmail() {
    setBusy(true);
    setError('');
    setNotice('');
    const result = await requestPasswordReset(email);
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }
    setNotice('Check your email for a password reset link.');
    setBusy(false);
  }

  async function saveNewPassword() {
    setBusy(true);
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setBusy(false);
      return;
    }
    const result = await updatePassword(password);
    if (!result.ok) {
      setError(result.error);
      setBusy(false);
      return;
    }
    Alert.alert('Password updated', 'You can keep using Your Friends with your new password.', [
      { text: 'Continue', onPress: () => replaceOnce(router, '/') },
    ]);
  }

  return (
    <AppScreen>
      <View style={styles.hero}>
        <Pressable onPress={() => backOnce(router)} style={styles.backButton}>
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text style={styles.eyebrow}>Account help</Text>
        <Text style={styles.title}>{readyToUpdate ? 'Choose a new password.' : 'Reset your password.'}</Text>
        <Text style={styles.subtitle}>
          {readyToUpdate
            ? 'Enter and confirm your new password below.'
            : 'Enter your email and we will send you a secure reset link.'}
        </Text>
      </View>

      {readyToUpdate ? (
        <View style={styles.form}>
          <FormField autoCapitalize="none" label="New password" onChangeText={setPassword} placeholder="New password" secureTextEntry value={password} />
          <FormField autoCapitalize="none" label="Confirm new password" onChangeText={setConfirmPassword} placeholder="Re-enter new password" secureTextEntry value={confirmPassword} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <ActionButton label={busy ? 'Saving...' : 'Update password'} onPress={saveNewPassword} disabled={busy} />
        </View>
      ) : (
        <View style={styles.form}>
          <FormField autoCapitalize="none" keyboardType="email-address" label="Email" onChangeText={setEmail} placeholder="you@example.com" value={email} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          <ActionButton label={busy ? 'Sending...' : 'Send reset link'} onPress={sendResetEmail} disabled={busy} />
        </View>
      )}
    </AppScreen>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    hero: { gap: spacing.sm, paddingTop: spacing.xl },
    backButton: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
    backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
    eyebrow: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: colors.accent,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    title: { fontFamily: fonts.heading, fontSize: 34, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 34) },
    subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.inkSoft },
    form: { gap: spacing.sm },
    error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.error },
    notice: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.accent },
  });
