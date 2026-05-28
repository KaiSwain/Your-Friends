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
import {
  QR_PREMIUM_ACTIVE_GRANT_LIMIT,
  QR_PREMIUM_GRANT_LABEL,
  usePremium,
} from '../../../src/features/premium/PremiumContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../src/features/theme/themes';
import { createFriendInviteLink, extractFriendCode } from '../../../src/lib/friendCode';
import { backOnce, pushOnce, replaceOnce } from '../../../src/lib/navigationGuard';
import { protectTextFromFontClipping } from '../../../src/theme/fontProtection';
import type { FontSet } from '../../../src/theme/typography';
import { radius, spacing } from '../../../src/theme/tokens';
import type { FriendRequest } from '../../../src/types/domain';

export default function AddFriendScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; scan?: string }>();
  const { currentUser } = useAuth();
  const {
    applyQrPremiumGrant,
    isPremium,
    qrPremiumGrantCount,
  } = usePremium();
  const {
    addFriendByCode,
    addManualContact,
    acceptFriendRequest,
    contacts,
    createLinkedContactForFriend,
    declineFriendRequest,
    getDirectFriends,
    getIncomingFriendRequests,
    getOutgoingFriendRequests,
    getUserById,
  } = useSocialGraph();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const [displayName, setDisplayName] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [friendCode, setFriendCode] = useState(extractFriendCode(params.code ?? ''));
  const [friendError, setFriendError] = useState('');
  const [friendNotice, setFriendNotice] = useState('');
  const [friendBusy, setFriendBusy] = useState(false);
  const [premiumGrantCandidateCode, setPremiumGrantCandidateCode] = useState<string | null>(null);
  const [requestBusyId, setRequestBusyId] = useState<string | null>(null);
  const [requestError, setRequestError] = useState('');
  const [linkedProfileBusyId, setLinkedProfileBusyId] = useState<string | null>(null);
  const [linkedProfileError, setLinkedProfileError] = useState('');
  const [qrGrantNotice, setQrGrantNotice] = useState('');
  const [qrGrantError, setQrGrantError] = useState('');

  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;
  const authenticatedUser = currentUser;
  const inviteLink = createFriendInviteLink(authenticatedUser.friendCode);
  const topBar = (
    <Pressable onPress={() => backOnce(router)} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
      <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
    </Pressable>
  );

  const incomingRequests = getIncomingFriendRequests(authenticatedUser.id);
  const outgoingRequests = getOutgoingFriendRequests(authenticatedUser.id);
  const linkedFriendIds = new Set(
    contacts
      .filter((contact) => contact.ownerUserId === authenticatedUser.id && contact.linkedUserId)
      .map((contact) => contact.linkedUserId!),
  );
  const existingFriendsWithoutProfile = getDirectFriends(authenticatedUser.id)
    .filter((friend) => !linkedFriendIds.has(friend.id))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  async function handleCreateManualContact() {
    if (!displayName.trim()) { setError('A display name is required.'); return; }
    setBusy(true);
    setError('');
    try {
      const result = await addManualContact(authenticatedUser.id, { displayName: displayName.trim(), nickname: nickname.trim() || undefined });
      replaceOnce(router, `/(app)/profiles/contact/${result.id}`);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.');
      setBusy(false);
    }
  }

  async function handleCreateProfileForFriend(friendId: string) {
    const friend = getUserById(friendId);
    if (!friend) return;
    Alert.alert(
      'Create memory profile card?',
      `Create your private saved profile for ${friend.displayName} (${friend.email})? This will not create anything on their side.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create',
          onPress: async () => {
            setLinkedProfileBusyId(friend.id);
            setLinkedProfileError('');
            const result = await createLinkedContactForFriend(authenticatedUser.id, friend.id);
            setLinkedProfileBusyId(null);
            if (!result.ok) {
              setLinkedProfileError(result.error);
              return;
            }
            replaceOnce(router, `/(app)/profiles/contact/${result.contactId}`);
          },
        },
      ],
    );
  }

  async function handleAddByCode() {
    const code = extractFriendCode(friendCode);
    if (!code) { setFriendError('Enter a friend code.'); return; }
    setFriendBusy(true);
    setFriendError('');
    setFriendNotice('');
    setQrGrantError('');
    setQrGrantNotice('');
    const result = await addFriendByCode(authenticatedUser.id, friendCode);
    if (!result.ok) { setFriendError(result.error); setFriendBusy(false); return; }
    if (result.requested) {
      setFriendError('');
      setFriendNotice(`Request sent to ${result.friend.displayName}.`);
      setFriendBusy(false);
      setFriendCode('');
      return;
    }
    if (premiumGrantCandidateCode === code && result.alreadyFriends) {
      applyQrPremiumGrant(code).then((grantResult) => {
        if (!grantResult.ok) return;
        setQrGrantNotice(grantResult.granted === false
          ? 'You already received free Premium from this QR.'
          : `${QR_PREMIUM_GRANT_LABEL} unlocked from this Premium friend.`);
      }).catch(() => {
        // Adding the friend is the main action. Premium QR grants should never block it.
      });
    }
    if (result.contactId) {
      replaceOnce(router, `/(app)/profiles/contact/${result.contactId}`);
    } else if (result.candidateContactIds.length > 0) {
      // Ambiguous: the user already has manual contacts that look like this
      // person. Send them to the chooser so they can merge or create new.
      replaceOnce(router, `/(app)/friends/link?friendId=${result.friend.id}`);
    } else {
      replaceOnce(router, `/(app)/profiles/user/${result.friend.id}`);
    }
  }

  async function handleAcceptRequest(request: FriendRequest) {
    setRequestBusyId(request.id);
    setRequestError('');
    const result = await acceptFriendRequest(request.id, authenticatedUser.id);
    if (!result.ok) {
      setRequestBusyId(null);
      setRequestError(result.error);
      return;
    }
    if (result.contactId) {
      replaceOnce(router, `/(app)/profiles/contact/${result.contactId}`);
    } else if (result.candidateContactIds.length > 0) {
      replaceOnce(router, `/(app)/friends/link?friendId=${result.friend.id}`);
    } else {
      replaceOnce(router, `/(app)/profiles/user/${result.friend.id}`);
    }
  }

  async function handleDeclineRequest(request: FriendRequest) {
    setRequestBusyId(request.id);
    setRequestError('');
    const result = await declineFriendRequest(request.id, authenticatedUser.id);
    if (!result.ok) setRequestError(result.error);
    setRequestBusyId(null);
  }

  async function openScanner() {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) { setFriendError('Camera permission is required to scan QR codes.'); return; }
    }
    scannedRef.current = false;
    setScanning(true);
  }

  useEffect(() => {
    if (params.scan !== '1') return;
    openScanner();
  }, [params.scan]);

  const handleBarcodeScan = useCallback(({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setScanning(false);
    const code = extractFriendCode(data);
    if (code && /^[A-Z0-9]{6,12}$/.test(code)) {
      setFriendCode(code);
      setPremiumGrantCandidateCode(code);
      setFriendError('');
      setFriendNotice('Code scanned. Tap Add friend to send or accept the friend request.');
      setQrGrantError('');
      setQrGrantNotice('');
    } else {
      setFriendError("That QR code doesn't look like a friend invite.");
    }
  }, []);

  function handleFriendCodeChange(value: string) {
    setFriendCode(value);
    if (extractFriendCode(value) !== premiumGrantCandidateCode) {
      setPremiumGrantCandidateCode(null);
      setQrGrantError('');
      setQrGrantNotice('');
    }
  }

  return (
    <AppScreen header={topBar} floatingHeaderOnScroll>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Add friend</Text>
        <Text style={styles.title}>Start with the person, then choose the connection type.</Text>
        <Text style={styles.subtitle}>Add a real friend by their code, or save someone as a private contact.</Text>
      </View>

      <SectionCard eyebrow="Requests" title="Friend requests">
          {requestError ? <Text style={styles.error}>{requestError}</Text> : null}
          {incomingRequests.length === 0 && outgoingRequests.length === 0 ? (
            <Text style={styles.note}>When someone adds you by QR or friend code, their request will appear here.</Text>
          ) : null}
          {incomingRequests.length > 0 ? (
            <View style={styles.requestList}>
              {incomingRequests.map((request) => {
                const requester = getUserById(request.requesterUserId);
                const busy = requestBusyId === request.id;
                return (
                  <View key={request.id} style={styles.requestRow}>
                    <View style={styles.requestCopy}>
                      <Text style={styles.requestTitle}>{requester?.displayName ?? 'Someone'}</Text>
                      <Text style={styles.requestSubtitle}>Wants to be your friend</Text>
                    </View>
                    <View style={styles.requestActions}>
                      <Pressable
                        onPress={() => handleDeclineRequest(request)}
                        disabled={!!requestBusyId}
                        style={({ pressed }) => [styles.secondaryRequestButton, pressed && styles.pressed, !!requestBusyId && !busy && styles.disabled]}
                        accessibilityRole="button"
                        accessibilityLabel={`Decline request from ${requester?.displayName ?? 'friend'}`}
                      >
                        <Text style={styles.secondaryRequestLabel}>Decline</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleAcceptRequest(request)}
                        disabled={!!requestBusyId}
                        style={({ pressed }) => [styles.primaryRequestButton, pressed && styles.pressed, !!requestBusyId && !busy && styles.disabled]}
                        accessibilityRole="button"
                        accessibilityLabel={`Accept request from ${requester?.displayName ?? 'friend'}`}
                      >
                        <Text style={styles.primaryRequestLabel}>{busy ? '...' : 'Accept'}</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {outgoingRequests.length > 0 ? (
            <View style={styles.requestList}>
              {outgoingRequests.map((request) => {
                const recipient = getUserById(request.recipientUserId);
                return (
                  <View key={request.id} style={styles.requestRow}>
                    <View style={styles.requestCopy}>
                      <Text style={styles.requestTitle}>{recipient?.displayName ?? 'Someone'}</Text>
                      <Text style={styles.requestSubtitle}>Waiting for them to accept</Text>
                    </View>
                    <Ionicons name="time-outline" size={18} color={colors.ink} />
                  </View>
                );
              })}
            </View>
          ) : null}
      </SectionCard>

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
            <FormField autoCapitalize="characters" label="Friend code" onChangeText={handleFriendCodeChange} placeholder="e.g. AB3XK7PN" value={friendCode} />
            {friendError ? <Text style={styles.error}>{friendError}</Text> : null}
            {friendNotice ? <Text style={styles.notice}>{friendNotice}</Text> : null}
            {qrGrantNotice ? <Text style={styles.notice}>{qrGrantNotice}</Text> : null}
            {qrGrantError ? <Text style={styles.error}>{qrGrantError}</Text> : null}
            <ActionButton label={friendBusy ? 'Looking up…' : 'Add friend'} onPress={handleAddByCode} disabled={friendBusy} />
          </>
        )}
      </SectionCard>

      <SectionCard eyebrow="Your Code" title="Show your QR">
        <Text style={styles.note}>
          Let a friend scan this to add you instantly. If your Premium is active, up to {QR_PREMIUM_ACTIVE_GRANT_LIMIT} friends can have a free {QR_PREMIUM_GRANT_LABEL} grant from your QR at the same time.
        </Text>
        <View style={[styles.premiumQrBanner, isPremium ? styles.premiumQrBannerActive : undefined]}>
          <Ionicons name={isPremium ? 'sparkles' : 'lock-closed-outline'} size={16} color={isPremium ? colors.accent : colors.ink} />
          <Text style={styles.premiumQrBannerText}>
            {isPremium
              ? 'Premium QR active. Scanning still adds you first; the free Premium grant can apply after you are connected.'
              : 'Subscribe or receive free Premium before your QR can gift Premium to friends.'}
          </Text>
        </View>
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
      {qrPremiumGrantCount > 0 ? (
        <View style={styles.referralRewardBanner}>
          <Ionicons name="gift" size={16} color={colors.accent} />
          <Text style={styles.referralRewardText}>
            {qrPremiumGrantCount === 1
              ? '1 Premium QR scan gifted'
              : `${qrPremiumGrantCount} Premium QR scans gifted`}
          </Text>
        </View>
      ) : null}

      {existingFriendsWithoutProfile.length > 0 ? (
        <SectionCard eyebrow="Existing friends" title="Create profile for a friend">
          <Text style={styles.note}>
            Pick a friend who does not have one of your saved memory profile cards yet. This only creates a private profile on your side.
          </Text>
          {linkedProfileError ? <Text style={styles.error}>{linkedProfileError}</Text> : null}
          <View style={styles.existingFriendList}>
            {existingFriendsWithoutProfile.map((friend) => {
              const busy = linkedProfileBusyId === friend.id;
              return (
                <Pressable
                  key={friend.id}
                  onPress={() => handleCreateProfileForFriend(friend.id)}
                  disabled={linkedProfileBusyId !== null}
                  style={({ pressed }) => [styles.existingFriendRow, pressed && styles.pressed, linkedProfileBusyId !== null && !busy && styles.disabled]}
                  accessibilityRole="button"
                  accessibilityLabel={`Create memory profile card for ${friend.displayName}`}
                >
                  <View style={[styles.existingFriendAvatar, { backgroundColor: friend.avatarColor }]}>
                    <Text style={styles.existingFriendAvatarText}>{friend.displayName.trim().slice(0, 1).toUpperCase() || '?'}</Text>
                  </View>
                  <View style={styles.existingFriendCopy}>
                    <Text style={styles.existingFriendName}>{friend.displayName}</Text>
                    <Text style={styles.existingFriendEmail}>{friend.email}</Text>
                  </View>
                  <Ionicons name={busy ? 'hourglass-outline' : 'add-circle-outline'} size={19} color={colors.accent} />
                </Pressable>
              );
            })}
          </View>
        </SectionCard>
      ) : null}

      <SectionCard eyebrow="Private" title="Add manually">
        <Text style={styles.note}>Save someone as a private contact only you can see, even if they are not on the app yet. You can link them to a real account later.</Text>
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
    backButton: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center' },
    backLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    hero: { gap: spacing.sm },
    eyebrow: {
      fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent,
      letterSpacing: 0.8, textTransform: 'uppercase',
    },
    title: { fontFamily: fonts.heading, fontSize: 36, lineHeight: 40, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 36) },
    subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
    note: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.inkSoft },
    error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.error },
    notice: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.accent },

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
    premiumQrBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
      padding: spacing.md,
    },
    premiumQrBannerActive: {
      borderColor: colors.accent,
      backgroundColor: colors.paper,
    },
    premiumQrBannerText: {
      flex: 1,
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      lineHeight: 18,
      color: colors.inkSoft,
    },
    qrCodeText: { fontFamily: fonts.heading, fontSize: 20, color: colors.accent, letterSpacing: 3, ...protectTextFromFontClipping(fonts.heading, 20) },
    shareButton: {
      alignSelf: 'center',
      paddingHorizontal: spacing.lg, paddingVertical: spacing.xs,
      borderRadius: radius.pill, backgroundColor: colors.accent,
    },
    shareButtonLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.white },
    referralRewardBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      backgroundColor: 'rgba(245,194,66,0.18)',
    },
    referralRewardText: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },

    existingFriendList: { gap: spacing.sm, marginTop: spacing.sm },
    existingFriendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
      padding: spacing.md,
    },
    existingFriendAvatar: {
      width: 44,
      height: 44,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    existingFriendAvatarText: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white },
    existingFriendCopy: { flex: 1, gap: 2 },
    existingFriendName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    existingFriendEmail: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkSoft },

    requestList: { gap: spacing.sm },
    requestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    requestCopy: { flex: 1, gap: 2 },
    requestTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    requestSubtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.inkSoft },
    requestActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    primaryRequestButton: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
    },
    primaryRequestLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.white },
    secondaryRequestButton: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
    },
    secondaryRequestLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkSoft },
    pressed: { opacity: 0.72 },
    disabled: { opacity: 0.45 },
  });
