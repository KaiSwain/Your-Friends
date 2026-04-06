import { Link, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { AppScreen } from '../../src/components/AppScreen';
import { FormField } from '../../src/components/FormField';
import { SectionCard } from '../../src/components/SectionCard';
import { useAuth } from '../../src/features/auth/AuthContext';
import { useTheme } from '../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../src/features/theme/themes';
import { fonts } from '../../src/theme/typography';
import { spacing } from '../../src/theme/tokens';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    setBusy(true);
    setError('');
    const result = await signIn(email, password);
    if (!result.ok) { setError(result.error); setBusy(false); return; }
    router.replace('/(app)/friends');
  }

  return (
    <AppScreen>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Your Friends</Text>
        <Text style={styles.title}>A warm little place to remember the people who matter.</Text>
        <Text style={styles.subtitle}>Sign in with your email and password to pick up where you left off.</Text>
      </View>

      <SectionCard eyebrow="Sign in" title="Welcome back">
        <FormField autoCapitalize="none" keyboardType="email-address" label="Email" onChangeText={setEmail} placeholder="avery@yourfriends.app" value={email} />
        <FormField autoCapitalize="none" label="Password" onChangeText={setPassword} placeholder="Your password" secureTextEntry value={password} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <ActionButton label={busy ? 'Signing in…' : 'Sign in'} onPress={handleSignIn} disabled={busy} />
      </SectionCard>

      <SectionCard eyebrow="Need an account?">
        <Text style={styles.note}>Don't have an account yet? It only takes a moment.</Text>
        <Link href="/(auth)/sign-up" style={styles.link}>Create account</Link>
      </SectionCard>
    </AppScreen>
  );
}

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    hero: { gap: spacing.sm, paddingTop: spacing.lg },
    eyebrow: {
      fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent,
      letterSpacing: 0.8, textTransform: 'uppercase',
    },
    title: { fontFamily: fonts.heading, fontSize: 42, lineHeight: 46, color: colors.ink },
    subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.inkSoft },
    error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.error },
    note: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.inkSoft },
    link: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  });
