import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { ActionButton } from '../../../src/components/ActionButton';
import { AppScreen } from '../../../src/components/AppScreen';
import { FormField } from '../../../src/components/FormField';
import { SectionCard } from '../../../src/components/SectionCard';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { FREE_FRIEND_LIMIT, FRIENDS_UNLOCK_PRICE, usePremium } from '../../../src/features/premium/PremiumContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../src/features/theme/themes';
import { createFriendInviteLink, extractFriendCode } from '../../../src/lib/friendCode';
import type { FontSet } from '../../../src/theme/typography';
import { radius, spacing } from '../../../src/theme/tokens';

export default function AddFriendScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();
  const { currentUser } = useAuth();
  const { friendsUnlocked, unlockFriends } = usePremium();
  const { addFriendByCode, addManualContact, contacts } = useSocialGraph();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const [displayName, setDisplayName] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [friendCode, setFriendCode] = useState(extractFriendCode(params.code ?? ''));
  const [friendError, setFriendError] = useState('');
  const [friendBusy, setFriendBusy] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;
  const authenticatedUser = currentUser;
  const inviteLink = createFriendInviteLink(authenticatedUser.friendCode);

  const friendCount = contacts.filter((c) => c.ownerUserId === authenticatedUser.id).length;
  const atLimit = !friendsUnlocked && friendCount >= FREE_FRIEND_LIMIT;

  function guardLimit(): boolean {
    if (!atLimit) return false;
    Alert.alert(
      'Friend Limit Reached',
      `You've got ${FREE_FRIEND_LIMIT} friends! Unlock unlimited friends for ${FRIENDS_UNLOCK_PRICE}.`,
      [
        { text: 'Not now', style: 'cancel' },
        { text: `Unlock ${FRIENDS_UNLOCK_PRICE}`, onPress: () => unlockFriends() },
      ],
    );
    return true;
  }

  async function handleCreateManualContact() {
    if (guardLimit()) return;
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
    if (guardLimit()) return;
    if (!friendCode.trim()) { setFriendError('Enter a friend code.'); return; }
    setFriendBusy(true);
    setFriendError('');
    const result = await addFriendByCode(authenticatedUser.id, friendCode);
    if (!result.ok) { setFriendError(result.error); setFriendBusy(false); return; }
    router.replace(result.contactId
      ? `/(app)/profiles/contact/${result.contactId}`
      : `/(app)/profiles/user/${result.friend.id}`,
    );
  }

  async function openScanner() {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) { setFriendError('Camera permission is required to scan QR codes.'); return; }
    }
    scannedRef.current = false;
    setScanning(true);
  }

  const handleBarcodeScan = useCallback(({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setScanning(false);
    const code = extractFriendCode(data);
    if (code) {
      setFriendCode(code);
      setFriendError('');
    }
  }, []);

  return (
    <AppScreen>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Add friend</Text>
        <Text style={styles.title}>Start with the person, then choose the connection type.</Text>
        <Text style={styles.subtitle}>Add a real friend by their code, or save someone as a private contact.</Text>
      </View>

      {atLimit && (
        <Pressable
          onPress={() => unlockFriends()}
          style={[styles.limitBanner, { backgroundColor: colors.accent + '18', borderColor: colors.accent + '40' }]}
        >
          <Ionicons name="lock-closed" size={16} color={colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.limitBannerTitle, { color: colors.ink }]}>Friend limit reached</Text>
            <Text style={[styles.limitBannerSub, { color: colors.inkSoft }]}>
              Unlock unlimited friends for {FRIENDS_UNLOCK_PRICE}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.accent} />
        </Pressable>
      )}

      <SectionCard eyebrow="Connect" title="Add by friend code">
        <Text style={styles.note}>Ask your friend for their code, paste their invite link, or scan their QR.</Text>

        {scanning ? (
          <View style={styles.scannerContainer}>
            <CameraView
              style={styles.scanner}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcodeScan}
            />
            <View style={styles.scannerOverlay}>
              <View style={styles.scannerFrame} />
            </View>
            <Pressable onPress={() => setScanning(false)} style={styles.cancelScan} accessibilityRole="button" accessibilityLabel="Cancel scanning">
              <Text style={styles.cancelScanLabel}>Cancel</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable onPress={openScanner} style={styles.scanButton} accessibilityRole="button" accessibilityLabel="Scan QR code">
              <Text style={styles.scanButtonLabel}><Ionicons name="camera-outline" size={16} />  Scan QR Code</Text>
            </Pressable>
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or type it</Text>
              <View style={styles.orLine} />
            </View>
            <FormField autoCapitalize="characters" label="Friend code" onChangeText={setFriendCode} placeholder="e.g. AB3XK7PN" value={friendCode} />
            {friendError ? <Text style={styles.error}>{friendError}</Text> : null}
            <ActionButton label={friendBusy ? 'Looking up…' : 'Add friend'} onPress={handleAddByCode} disabled={friendBusy} />
          </>
        )}
      </SectionCard>

      <SectionCard eyebrow="Your Code" title="Show your QR">
        <Text style={styles.note}>Let a friend scan this to add you instantly.</Text>
        <View style={styles.qrCard}>
          <QRCode
            value={inviteLink}
            size={160}
            backgroundColor={colors.paper}
            color={colors.ink}
          />
          <Text style={styles.qrCodeText}>{authenticatedUser.friendCode}</Text>
        </View>
        <Pressable
          onPress={() => Share.share({ message: `Add me on Your Friends!\n${inviteLink}\nFriend code: ${authenticatedUser.friendCode}` })}
          style={styles.shareButton}
          accessibilityRole="button"
          accessibilityLabel="Share your friend link"
        >
          <Text style={styles.shareButtonLabel}>Share Link</Text>
        </Pressable>
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

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
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

    scanButton: {
      backgroundColor: colors.accent, borderRadius: radius.md,
      paddingVertical: spacing.md, alignItems: 'center',
    },
    scanButtonLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.white },

    orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    orLine: { flex: 1, height: 1, backgroundColor: colors.line },
    orText: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted },

    scannerContainer: {
      height: 280, borderRadius: radius.md, overflow: 'hidden',
      position: 'relative',
    },
    scanner: { flex: 1 },
    scannerOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center', justifyContent: 'center',
    },
    scannerFrame: {
      width: 200, height: 200, borderRadius: radius.md,
      borderWidth: 2, borderColor: colors.accent,
    },
    cancelScan: {
      position: 'absolute', bottom: spacing.md,
      alignSelf: 'center',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.xs,
      borderRadius: radius.pill, backgroundColor: 'rgba(0,0,0,0.6)',
    },
    cancelScanLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: '#fff' },

    qrCard: {
      alignItems: 'center', gap: spacing.sm,
      backgroundColor: colors.paper, borderRadius: radius.md,
      paddingVertical: spacing.lg,
    },
    qrCodeText: { fontFamily: fonts.heading, fontSize: 20, color: colors.accent, letterSpacing: 3 },
    shareButton: {
      alignSelf: 'center',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.xs,
      borderRadius: radius.pill, backgroundColor: colors.accent,
    },
    shareButtonLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.white },

    limitBanner: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
      padding: spacing.md, borderRadius: radius.md,
      borderWidth: 1,
    },
    limitBannerTitle: { fontFamily: fonts.bodyBold, fontSize: 14 },
    limitBannerSub: { fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  });
