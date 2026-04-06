import { useRouter } from 'expo-router';
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

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSignUp() {
    setBusy(true);
    setError('');
    const result = await signUp(displayName, email, password);
    if (!result.ok) { setError(result.error); setBusy(false); return; }
    router.replace('/(app)/friends');
  }

  return (
    <AppScreen>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Get started</Text>
        <Text style={styles.title}>Create your first quiet corner.</Text>
        <Text style={styles.subtitle}>Sign up to start collecting memories with the people you care about.</Text>
      </View>

      <SectionCard eyebrow="Create account" title="Start with yourself">
        <FormField label="Display name" onChangeText={setDisplayName} placeholder="Avery Hart" value={displayName} />
        <FormField autoCapitalize="none" keyboardType="email-address" label="Email" onChangeText={setEmail} placeholder="you@example.com" value={email} />
        <FormField autoCapitalize="none" label="Password" onChangeText={setPassword} placeholder="Choose a password" secureTextEntry value={password} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <ActionButton label={busy ? 'Creating…' : 'Create account'} onPress={handleSignUp} disabled={busy} />
        <ActionButton label="Back to sign in" onPress={() => router.back()} variant="ghost" />
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
    title: { fontFamily: fonts.heading, fontSize: 38, lineHeight: 42, color: colors.ink },
    subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.inkSoft },
    error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.error },
  });
