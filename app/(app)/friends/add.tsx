import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../../src/components/ActionButton';
import { AppScreen } from '../../../src/components/AppScreen';
import { FormField } from '../../../src/components/FormField';
import { SectionCard } from '../../../src/components/SectionCard';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../src/features/theme/themes';
import { fonts } from '../../../src/theme/typography';
import { spacing } from '../../../src/theme/tokens';

export default function AddFriendScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { addFriendByCode, addManualContact } = useSocialGraph();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [displayName, setDisplayName] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [friendCode, setFriendCode] = useState('');
  const [friendError, setFriendError] = useState('');
  const [friendBusy, setFriendBusy] = useState(false);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;
  const authenticatedUser = currentUser;

  async function handleCreateManualContact() {
    if (!displayName.trim()) { setError('A display name is required.'); return; }
    setBusy(true);
    setError('');
    try {
      const result = await addManualContact(authenticatedUser.id, { displayName: displayName.trim(), nickname: nickname.trim() || undefined });
      router.replace(`/(app)/profiles/contact/${result.id}`);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.');
      setBusy(false);
    }
  }

  async function handleAddByCode() {
    if (!friendCode.trim()) { setFriendError('Enter a friend code.'); return; }
    setFriendBusy(true);
    setFriendError('');
    const result = await addFriendByCode(authenticatedUser.id, friendCode);
    if (!result.ok) { setFriendError(result.error); setFriendBusy(false); return; }
    router.replace(`/(app)/profiles/user/${result.friend.id}`);
  }

  return (
    <AppScreen>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Add friend</Text>
        <Text style={styles.title}>Start with the person, then choose the connection type.</Text>
        <Text style={styles.subtitle}>Add a real friend by their code, or save someone as a private contact.</Text>
      </View>

      <SectionCard eyebrow="Connect" title="Add by friend code">
        <Text style={styles.note}>Ask your friend for their code — you can find yours on your profile screen.</Text>
        <FormField autoCapitalize="characters" label="Friend code" onChangeText={setFriendCode} placeholder="e.g. AB3XK7PN" value={friendCode} />
        {friendError ? <Text style={styles.error}>{friendError}</Text> : null}
        <ActionButton label={friendBusy ? 'Looking up…' : 'Add friend'} onPress={handleAddByCode} disabled={friendBusy} />
      </SectionCard>

      <SectionCard eyebrow="Private" title="Add manually">
        <Text style={styles.note}>Save someone as a private contact only you can see. You can link them to a real account later.</Text>
        <FormField label="Display name" onChangeText={setDisplayName} placeholder="Rosa Maren" value={displayName} />
        <FormField label="Nickname" onChangeText={setNickname} placeholder="Aunt Rosa" value={nickname} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <ActionButton label={busy ? 'Saving…' : 'Save contact'} onPress={handleCreateManualContact} disabled={busy} />
      </SectionCard>
    </AppScreen>
  );
}

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    hero: { gap: spacing.sm },
    eyebrow: {
      fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent,
      letterSpacing: 0.8, textTransform: 'uppercase',
    },
    title: { fontFamily: fonts.heading, fontSize: 36, lineHeight: 40, color: colors.ink },
    subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
    note: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.inkSoft },
    error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.error },
  });
