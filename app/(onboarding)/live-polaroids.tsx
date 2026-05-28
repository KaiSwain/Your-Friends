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

const POLAROID_FRAME = '#F5F2EA';
const POLAROID_BORDER = 'rgba(180,170,155,0.4)';
const FRAME_INK = '#2A2218';
const FRAME_INK_SOFT = '#6B6052';

const LIVE_POINTS = [
  {
    icon: 'videocam-outline' as const,
    title: 'Hold to capture movement',
    body: 'A Live Memory saves a short video moment, not just a still photo.',
  },
  {
    icon: 'image-outline' as const,
    title: 'It still looks like a memory card',
    body: 'The wall shows a clean cover photo first, so the scrapbook stays calm and pretty.',
  },
  {
    icon: 'volume-mute-outline' as const,
    title: 'Sound is under control',
    body: 'Live Memories can stay muted until someone chooses to play them.',
  },
];

export default function OnboardingLivePolaroidsScreen() {
  const router = useRouter();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <OnboardingFrame
      step={4}
      totalSteps={13}
      eyebrow="Live Memory Cards"
      title="Some memories can move."
      subtitle="A Live Memory is a memory card with a short video tucked inside. It keeps the classic photo-memory look, but lets the moment move when you open it."
      footer={<ActionButton label="Next" onPress={() => pushOnce(router, '/(onboarding)/prompts-movies')} />}
      scrollable
    >
      <View style={styles.previewSurface}>
        <LiveMemoryExplainer colors={colors} fonts={fonts} />
      </View>
      <View style={styles.hintRow}>
        {LIVE_POINTS.map((point) => (
          <View key={point.title} style={styles.hintPill}>
            <Ionicons name={point.icon} size={15} color={colors.accent} />
            <View style={styles.hintCopy}>
              <Text style={styles.hintTitle}>{point.title}</Text>
              <Text style={styles.hintText}>{point.body}</Text>
            </View>
          </View>
        ))}
      </View>
    </OnboardingFrame>
  );
}

function LiveMemoryExplainer({ colors, fonts }: { colors: ColorTokens; fonts: FontSet }) {
  return (
    <View style={previewStyles.stage}>
      <View style={previewStyles.tape} />
      <View style={previewStyles.polaroidCard}>
        <View style={previewStyles.photoFrame}>
          <View style={[previewStyles.thumbnail, { backgroundColor: colors.accent }]}>
            <PersonScene />
          </View>
          <View style={previewStyles.playBadge}>
            <Ionicons name="play" size={18} color="#fff" />
          </View>
          <View style={previewStyles.soundButton}>
            <Ionicons name="volume-mute" size={14} color="#fff" />
          </View>
        </View>
        <Text style={[previewStyles.caption, { fontFamily: fonts.handwrittenBold }, protectTextFromFontClipping(fonts.handwrittenBold, 34)]}>live memory</Text>
        <Text style={[previewStyles.note, { fontFamily: fonts.handwritten }, protectTextFromFontClipping(fonts.handwritten, 20)]}>video inside, photo outside</Text>
        <Ionicons name="flower-outline" size={18} color={FRAME_INK_SOFT} style={previewStyles.flourish} />
      </View>
      <View style={previewStyles.cameraControls}>
        <View style={[previewStyles.shutterButton, { borderColor: colors.accent }]}>
          <View style={[previewStyles.shutterCore, { backgroundColor: colors.accent }]} />
        </View>
        <Text style={[previewStyles.cameraControlText, { color: FRAME_INK_SOFT }]}>hold shutter to make one</Text>
      </View>
    </View>
  );
}

function PersonScene() {
  return (
    <View style={previewStyles.personScene}>
      <View style={previewStyles.personHead} />
      <View style={previewStyles.personBody} />
    </View>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    previewSurface: {
      minHeight: 388,
      borderRadius: radius.lg,
      backgroundColor: colors.paperMuted,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    hintRow: { gap: spacing.sm },
    hintPill: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    hintCopy: { flex: 1, gap: 2 },
    hintTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
    hintText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.inkSoft },
  });

const previewStyles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 18,
  },
  tape: {
    width: 54,
    height: 16,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,220,0.45)',
    marginBottom: -8,
    zIndex: 2,
    transform: [{ rotate: '-2deg' }],
  },
  polaroidCard: {
    width: 230,
    minHeight: 316,
    borderRadius: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: POLAROID_BORDER,
    backgroundColor: POLAROID_FRAME,
    paddingTop: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },
  photoFrame: {
    width: 210,
    height: 210,
    borderRadius: 1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.045)',
    backgroundColor: '#2A2218',
  },
  thumbnail: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personScene: {
    width: 118,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personHead: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.72)',
    marginBottom: -4,
  },
  personBody: {
    width: 78,
    height: 92,
    borderRadius: 39,
    backgroundColor: 'rgba(255,255,255,0.58)',
  },
  playBadge: {
    position: 'absolute',
    alignSelf: 'center',
    top: 86,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  soundButton: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  caption: {
    marginTop: 20,
    fontSize: 34,
    color: FRAME_INK,
    textAlign: 'center',
  },
  note: {
    marginTop: 6,
    fontSize: 20,
    color: FRAME_INK_SOFT,
    textAlign: 'center',
  },
  flourish: {
    position: 'absolute',
    right: 14,
    bottom: 18,
    opacity: 0.5,
  },
  cameraControls: {
    alignItems: 'center',
    gap: 7,
    marginTop: 14,
  },
  shutterButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: POLAROID_FRAME,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 9,
    elevation: 4,
  },
  shutterCore: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  cameraControlText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
