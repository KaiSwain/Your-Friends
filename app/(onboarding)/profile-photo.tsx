import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { useAuth } from '../../src/features/auth/AuthContext';
import { OnboardingFrame } from '../../src/features/onboarding/OnboardingFrame';
import { useTheme } from '../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../src/features/theme/themes';
import { onCapturedUri } from '../../src/lib/cameraHandoff';
import type { FontSet } from '../../src/theme/typography';
import { radius, spacing } from '../../src/theme/tokens';

export default function OnboardingProfilePhotoScreen() {
  const router = useRouter();
  const { currentUser, updateProfile } = useAuth();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const [localUri, setLocalUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Receive the URI captured by the polaroid camera screen when it pops back.
  useEffect(() => onCapturedUri((uri) => setLocalUri(uri)), []);

  const initials = (currentUser?.displayName ?? '?')
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  function takePhoto() {
    router.push({ pathname: '/(app)/camera', params: { handoff: '1' } });
  }

  async function handleContinue() {
    if (busy) return;
    setBusy(true);
    try {
      if (localUri) {
        await updateProfile({ avatarLocalUri: localUri });
      }
      router.push('/(onboarding)/fact');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save your photo.';
      Alert.alert('Hmm', message);
      setBusy(false);
    }
  }

  function handleSkip() {
    if (busy) return;
    router.push('/(onboarding)/fact');
  }

  return (
    <OnboardingFrame
      step={4}
      totalSteps={7}
      eyebrow="Your face"
      title="Add a profile photo."
      subtitle="A photo helps your friends spot you when they connect. You can change it anytime."
      footer={
        <>
          <ActionButton
            label={busy ? 'Saving…' : localUri ? 'Looks good — continue' : 'Continue'}
            onPress={handleContinue}
            disabled={busy || !localUri}
          />
          <Pressable onPress={handleSkip} style={styles.skipButton} accessibilityRole="button" disabled={busy}>
            <Text style={styles.skipLabel}>Skip for now</Text>
          </Pressable>
        </>
      }
    >
      <View style={styles.avatarWrap}>
        <View style={styles.avatarCircle}>
          {localUri ? (
            <Image source={{ uri: localUri }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitials}>{initials || '?'}</Text>
          )}
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable onPress={takePhoto} style={styles.actionTile} accessibilityRole="button">
          <Ionicons name="camera-outline" size={26} color={colors.ink} />
          <Text style={styles.actionTileLabel}>Take photo</Text>
        </Pressable>
      </View>

      {localUri ? (
        <Pressable onPress={() => setLocalUri(null)} accessibilityRole="button">
          <Text style={styles.removeLabel}>Remove photo</Text>
        </Pressable>
      ) : null}
    </OnboardingFrame>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    avatarWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
    },
    avatarCircle: {
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: colors.paperMuted,
      borderWidth: 2,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImage: { width: '100%', height: '100%' },
    avatarInitials: {
      fontFamily: fonts.heading,
      fontSize: 48,
      color: colors.inkSoft,
    },
    actionRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    actionTile: {
      flex: 1,
      gap: 6,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
      borderRadius: radius.md,
    },
    actionTileLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: colors.ink,
    },
    lockBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 999,
      backgroundColor: colors.ink,
      marginTop: 2,
    },
    lockBadgeLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 9,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.canvas,
    },
    removeLabel: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.inkSoft,
      textAlign: 'center',
      textDecorationLine: 'underline',
    },
    skipButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm,
    },
    skipLabel: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.inkSoft,
      textDecorationLine: 'underline',
    },
  });
