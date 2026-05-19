import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { OnboardingFrame } from '../../src/features/onboarding/OnboardingFrame';
import { useTheme } from '../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../src/features/theme/themes';
import { pushOnce } from '../../src/lib/navigationGuard';
import { protectTextFromFontClipping } from '../../src/theme/fontProtection';
import type { FontSet } from '../../src/theme/typography';
import { radius, spacing } from '../../src/theme/tokens';

const TONES = ['Witty', 'Sweet', 'Nostalgic'];
const SUGGESTIONS = [
  'proof that the smallest plans become the best memories',
  'same chaos, better lighting',
];

export default function OnboardingAiCaptionsScreen() {
  const router = useRouter();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <OnboardingFrame
      step={7}
      totalSteps={12}
      eyebrow="AI captions"
      title="When the photo says it all, AI can help with the words."
      subtitle="Add a photo, pick a tone, and get caption ideas that still feel like you."
      footer={<ActionButton label="Continue" onPress={() => pushOnce(router, '/(onboarding)/profile-photo')} />}
    >
      <View style={styles.composerCard}>
        <View style={styles.previewSection}>
          <Text style={styles.previewLabel}>Preview</Text>
          <View style={styles.polaroid}>
            <View style={[styles.photo, { backgroundColor: colors.accent }]}>
              <View style={styles.photoGlow} />
              <Ionicons name="image-outline" size={42} color={colors.white} />
            </View>
            <Text style={styles.polaroidCaption}>lake day</Text>
          </View>
        </View>

        <View style={styles.inputSection}>
          <View style={styles.inputHeaderRow}>
            <Text style={styles.inputLabel}>Caption</Text>
            <View style={styles.aiButton}>
              <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
              <Text style={styles.aiButtonText}>AI Caption</Text>
            </View>
          </View>
          <View style={styles.toneRow}>
            {TONES.map((tone, index) => (
              <View key={tone} style={[styles.toneChip, index === 0 && styles.toneChipActive]}>
                <Text style={[styles.toneChipText, index === 0 && styles.toneChipTextActive]}>{tone}</Text>
              </View>
            ))}
          </View>
          <View style={styles.textInput}>
            <Text style={styles.placeholder}>Write a caption…</Text>
          </View>
          <View style={styles.captionSuggestionList}>
            {SUGGESTIONS.map((caption, index) => (
              <View key={caption} style={[styles.captionSuggestion, index === 0 && styles.captionSuggestionActive]}>
                <Text style={styles.captionSuggestionText}>{caption}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </OnboardingFrame>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    composerCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      padding: spacing.md,
      gap: spacing.md,
    },
    previewSection: { gap: spacing.sm, alignItems: 'center' },
    previewLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: colors.inkMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    polaroid: {
      width: 154,
      borderRadius: 3,
      backgroundColor: '#F5F2EA',
      paddingTop: 8,
      paddingHorizontal: 8,
      paddingBottom: 34,
      alignItems: 'center',
      shadowColor: colors.black,
      shadowOpacity: 0.16,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
      transform: [{ rotate: '-2deg' }],
    },
    photo: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 1,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    photoGlow: {
      position: 'absolute',
      width: 92,
      height: 92,
      borderRadius: 46,
      backgroundColor: 'rgba(255,255,255,0.24)',
    },
    polaroidCaption: {
      position: 'absolute',
      bottom: 10,
      fontFamily: fonts.handwrittenBold,
      fontSize: 18,
      color: '#2A2218',
      ...protectTextFromFontClipping(fonts.handwrittenBold, 18),
    },
    inputSection: { gap: spacing.xs },
    inputHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    inputLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: colors.inkMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    aiButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: spacing.sm,
      paddingVertical: 7,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.accent + '66',
      backgroundColor: colors.accent + '12',
    },
    aiButtonText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent },
    toneRow: { flexDirection: 'row', gap: spacing.xs, paddingVertical: 2 },
    toneChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
    },
    toneChipActive: { borderColor: colors.accent, backgroundColor: colors.accent + '14' },
    toneChipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkSoft },
    toneChipTextActive: { fontFamily: fonts.bodyBold, color: colors.accent },
    textInput: {
      minHeight: 74,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    placeholder: { fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted },
    captionSuggestionList: { gap: spacing.xs },
    captionSuggestion: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    captionSuggestionActive: { borderColor: colors.accent, backgroundColor: colors.accent + '10' },
    captionSuggestionText: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 19, color: colors.ink },
  });
