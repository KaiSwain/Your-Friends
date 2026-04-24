import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { ActionButton } from '../../../src/components/ActionButton';
import { AppScreen } from '../../../src/components/AppScreen';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../src/features/theme/themes';
import { contrastText, contrastTextSoft } from '../../../src/lib/contrastText';
import { createFriendInviteLink } from '../../../src/lib/friendCode';
import type { FontSet } from '../../../src/theme/typography';
import { radius, spacing } from '../../../src/theme/tokens';

export default function MyProfileScreen() {
  const router = useRouter();
  const { currentUser, updateProfile } = useAuth();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? '');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [facts, setFacts] = useState<string[]>(currentUser?.profileFacts ?? []);
  const [newFact, setNewFact] = useState('');
  const [saving, setSaving] = useState(false);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  const displayImage = localImageUri ?? currentUser.avatarPath ?? null;
  const previewName = displayName.trim() || currentUser.displayName;
  const inviteLink = createFriendInviteLink(currentUser.friendCode);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setLocalImageUri(result.assets[0].uri);
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { Alert.alert('Camera permission required'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) setLocalImageUri(result.assets[0].uri);
  }

  function addFact() {
    const t = newFact.trim();
    if (!t || facts.includes(t)) return;
    setFacts((prev) => [...prev, t]);
    setNewFact('');
  }

  function removeFact(fact: string) {
    setFacts((prev) => prev.filter((f) => f !== fact));
  }

  async function handleSave() {
    if (!previewName) return;
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim() || undefined,
        avatarLocalUri: localImageUri,
        profileFacts: facts,
      });
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
    setSaving(false);
  }

  return (
    <AppScreen
      floatingHeaderOnScroll
      footer={
        <ActionButton label={saving ? 'Saving…' : 'Save Profile'} onPress={handleSave} disabled={saving} />
      }
    >
      <Text style={styles.title}>Your Profile</Text>
      <Text style={styles.subtitle}>This is how friends see you when they add you.</Text>

      {/* Avatar */}
      <View style={styles.avatarSection}>
        <Pressable onPress={pickPhoto} style={styles.avatarFrame} accessibilityRole="button" accessibilityLabel="Change profile photo">
          {displayImage ? (
            <Image source={{ uri: displayImage }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: currentUser.avatarColor }]}>
              <Text style={styles.avatarInitials}>
                {previewName.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')}
              </Text>
            </View>
          )}
          <View style={styles.avatarOverlay}>
            <Text style={styles.avatarOverlayText}>Change</Text>
          </View>
        </Pressable>
        <View style={styles.photoActions}>
          <Pressable onPress={pickPhoto} style={styles.photoPill} accessibilityRole="button" accessibilityLabel="Choose from gallery">
            <Text style={styles.photoPillLabel}>Gallery</Text>
          </Pressable>
          <Pressable onPress={takePhoto} style={styles.photoPill} accessibilityRole="button" accessibilityLabel="Take a photo">
            <Text style={styles.photoPillLabel}>Camera</Text>
          </Pressable>
        </View>
      </View>

      {/* Display Name */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Display Name</Text>
        <TextInput
          style={styles.textInput}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder={currentUser.displayName}
          placeholderTextColor={colors.inkMuted}
        />
      </View>

      {/* Friend Code QR */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Friend Code</Text>
        <View style={styles.qrCard}>
          <View style={styles.qrWrapper}>
            <QRCode
              value={inviteLink}
              size={160}
              backgroundColor={colors.paper}
              color={colors.ink}
            />
          </View>
          <Text style={styles.codeValue}>{currentUser.friendCode}</Text>
          <Text style={styles.codeHint}>Friends can scan this or open your shared link to add you</Text>
          <Pressable
            onPress={() => Share.share({ message: `Add me on Your Friends!\n${inviteLink}\nFriend code: ${currentUser.friendCode}` })}
            style={styles.sharePill}
          >
            <Text style={styles.sharePillLabel}>Share Link</Text>
          </Pressable>
        </View>
      </View>

      {/* Profile Facts */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Profile Facts</Text>
        <Text style={styles.fieldHint}>Quick facts visible to friends who add you.</Text>
        {facts.length > 0 && (
          <View style={styles.factList}>
            {facts.map((f) => (
              <View key={f} style={styles.factChip}>
                <Text style={styles.factChipText}>{f}</Text>
                <Pressable onPress={() => removeFact(f)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove fact: ${f}`}>
                  <Ionicons name="close" size={14} color={colors.error} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <View style={styles.addFactRow}>
          <TextInput
            style={styles.addFactInput}
            value={newFact}
            onChangeText={setNewFact}
            placeholder="Add a fact…"
            placeholderTextColor={colors.inkMuted}
            onSubmitEditing={addFact}
            returnKeyType="done"
          />
          <Pressable onPress={addFact} style={styles.addFactButton} accessibilityRole="button" accessibilityLabel="Add fact">
            <Text style={styles.addFactButtonLabel}>+</Text>
          </Pressable>
        </View>
      </View>
    </AppScreen>
  );
}

const AVATAR_SIZE = 100;
const PREVIEW_WIDTH = 160;

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    backButton: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
    backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
    title: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink, marginTop: spacing.sm },
    subtitle: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, marginBottom: spacing.lg },

    avatarSection: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
    avatarFrame: {
      width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
      overflow: 'hidden', position: 'relative',
    },
    avatarImage: { width: '100%', height: '100%' },
    avatarPlaceholder: {
      width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center',
    },
    avatarInitials: { fontFamily: fonts.heading, fontSize: 36, color: colors.white },
    avatarOverlay: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: 'rgba(0,0,0,0.45)', paddingVertical: 4, alignItems: 'center',
    },
    avatarOverlayText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: '#fff' },
    photoActions: { flexDirection: 'row', gap: spacing.sm },
    photoPill: {
      paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
      borderRadius: radius.pill, backgroundColor: colors.paper,
    },
    photoPillLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },

    fieldGroup: { marginBottom: spacing.lg },
    fieldLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
    fieldHint: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted, marginBottom: spacing.sm },
    textInput: {
      fontFamily: fonts.body, fontSize: 16, color: colors.ink,
      backgroundColor: colors.paper, borderRadius: radius.md,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    },

    qrCard: {
      backgroundColor: colors.paper, borderRadius: radius.lg,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.lg,
      alignItems: 'center', gap: spacing.sm,
    },
    qrWrapper: {
      padding: spacing.md, backgroundColor: colors.paper,
      borderRadius: radius.md,
    },
    codeValue: { fontFamily: fonts.heading, fontSize: 22, color: colors.accent, letterSpacing: 3 },
    codeHint: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted },
    sharePill: {
      marginTop: spacing.xs,
      paddingHorizontal: spacing.lg, paddingVertical: spacing.xs,
      borderRadius: radius.pill, backgroundColor: colors.accent,
    },
    sharePillLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.white },

    factList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
    factChip: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      backgroundColor: colors.paper, borderRadius: radius.pill,
      paddingHorizontal: spacing.sm, paddingVertical: 4,
    },
    factChipText: { fontFamily: fonts.body, fontSize: 13, color: colors.ink },
    factChipRemove: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.inkMuted },

    addFactRow: { flexDirection: 'row', gap: spacing.xs },
    addFactInput: {
      flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink,
      backgroundColor: colors.paper, borderRadius: radius.md,
      paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    },
    addFactButton: {
      width: 40, height: 40, borderRadius: 20,
      backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    },
    addFactButtonLabel: { fontFamily: fonts.heading, fontSize: 20, color: colors.white },

    previewCard: {
      width: PREVIEW_WIDTH, borderRadius: radius.lg, overflow: 'hidden',
      alignSelf: 'center', paddingBottom: spacing.sm,
    },
    previewImage: { width: PREVIEW_WIDTH, height: PREVIEW_WIDTH, resizeMode: 'cover' },
    previewImagePlaceholder: {
      width: PREVIEW_WIDTH, height: PREVIEW_WIDTH,
      alignItems: 'center', justifyContent: 'center',
    },
    previewInitials: { fontFamily: fonts.heading, fontSize: 44 },
    previewName: { fontFamily: fonts.heading, fontSize: 16, textAlign: 'center', marginTop: spacing.xs, paddingHorizontal: spacing.xs },
    previewCaption: { fontFamily: fonts.body, fontSize: 11, textAlign: 'center', paddingHorizontal: spacing.xs },
  });
