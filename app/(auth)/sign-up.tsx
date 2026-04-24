import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';

WebBrowser.maybeCompleteAuthSession();

import { ActionButton } from '../../src/components/ActionButton';
import { AppScreen } from '../../src/components/AppScreen';
import { FormField } from '../../src/components/FormField';
import { useAuth } from '../../src/features/auth/AuthContext';
import { useTheme } from '../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../src/features/theme/themes';
import type { FontSet } from '../../src/theme/typography';
import { radius, spacing } from '../../src/theme/tokens';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp, signInWithApple, signInWithGoogle } = useAuth();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [_googleRequest, googleResponse, googlePromptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  });

  useEffect(() => {
    if (googleResponse?.type === 'success') {
      const idToken = googleResponse.params.id_token;
      setBusy(true);
      setError('');
      signInWithGoogle(idToken).then((result) => {
        if (!result.ok) { if (result.error) setError(result.error); setBusy(false); return; }
        router.replace('/(app)/friends');
      });
    }
  }, [googleResponse]);

  async function handleSignUp() {
    setBusy(true);
    setError('');
    const result = await signUp(displayName, email, password);
    if (!result.ok) { setError(result.error); setBusy(false); return; }
    router.replace('/(app)/friends');
  }

  async function handleApple() {
    setBusy(true);
    setError('');
    const result = await signInWithApple();
    if (!result.ok) { if (result.error) setError(result.error); setBusy(false); return; }
    router.replace('/(app)/friends');
  }

  async function handleGoogle() {
    googlePromptAsync();
  }

  return (
    <AppScreen>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Get started</Text>
        <Text style={styles.title}>Create your first quiet corner.</Text>
        <Text style={styles.subtitle}>Sign up to start collecting memories with the people you care about.</Text>
      </View>

      <View style={styles.socialSection}>
        {Platform.OS === 'ios' && (
          <Pressable
            style={({ pressed }) => [styles.socialButton, styles.appleButton, pressed && styles.pressed]}
            onPress={handleApple}
            disabled={busy}
          >
            <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
            <Text style={[styles.socialLabel, { color: '#FFFFFF' }]}>Continue with Apple</Text>
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [styles.socialButton, styles.googleButton, pressed && styles.pressed]}
          onPress={handleGoogle}
          disabled={busy}
        >
          <Ionicons name="logo-google" size={18} color="#1F1F1F" />
          <Text style={[styles.socialLabel, { color: '#1F1F1F' }]}>Continue with Google</Text>
        </Pressable>

        {error && displayName === '' && email === '' ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={styles.emailSection}>
        <FormField label="Display name" onChangeText={setDisplayName} placeholder="Avery Hart" value={displayName} />
        <FormField autoCapitalize="none" keyboardType="email-address" label="Email" onChangeText={setEmail} placeholder="you@example.com" value={email} />
        <FormField autoCapitalize="none" label="Password" onChangeText={setPassword} placeholder="Choose a password" secureTextEntry value={password} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <ActionButton label={busy ? 'Creating…' : 'Create account'} onPress={handleSignUp} disabled={busy} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.link}>Sign in</Text>
        </Pressable>
      </View>
    </AppScreen>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    hero: { gap: spacing.sm, paddingTop: spacing.xl },
    eyebrow: {
      fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent,
      letterSpacing: 0.8, textTransform: 'uppercase',
    },
    title: { fontFamily: fonts.heading, fontSize: 38, lineHeight: 42, color: colors.ink },
    subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.inkSoft },
    socialSection: { gap: spacing.sm, paddingTop: spacing.lg },
    socialButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      height: 52,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
    },
    appleButton: { backgroundColor: '#000000' },
    googleButton: { backgroundColor: '#FFFFFF' },
    socialLabel: { fontFamily: fonts.bodyBold, fontSize: 16 },
    pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
    dividerText: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted },
    emailSection: { gap: spacing.sm },
    error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.error },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xl,
    },
    footerText: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft },
    link: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.accent },
  });
