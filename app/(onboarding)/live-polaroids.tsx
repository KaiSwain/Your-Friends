import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

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

export default function OnboardingLivePolaroidsScreen() {
  const router = useRouter();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <OnboardingFrame
      step={4}
      totalSteps={12}
      eyebrow="Live Memory Cards"
      title="Some memories can move."
      subtitle="Hold the shutter to record up to 5 seconds. When you release, the camera counts down and captures a high-quality photo thumbnail automatically."
      footer={<ActionButton label="Show me more" onPress={() => pushOnce(router, '/(onboarding)/tutorial')} />}
      scrollable
    >
      <View style={styles.previewSurface}>
        <LivePolaroidPreview colors={colors} fonts={fonts} />
      </View>
      <View style={styles.hintRow}>
        <View style={styles.hintPill}>
          <Ionicons name="radio-button-on" size={13} color={colors.accent} />
          <Text style={styles.hintText}>Hold to record the video</Text>
        </View>
        <View style={styles.hintPill}>
          <Ionicons name="timer-outline" size={13} color={colors.accent} />
          <Text style={styles.hintText}>Then hold still for the thumbnail countdown</Text>
        </View>
      </View>
    </OnboardingFrame>
  );
}

function LivePolaroidPreview({ colors, fonts }: { colors: ColorTokens; fonts: FontSet }) {
  const playback = useRef(new Animated.Value(0)).current;
  const recordingPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(playback, { toValue: 0, duration: 650, easing: Easing.linear, useNativeDriver: true }),
        Animated.delay(850),
        Animated.timing(playback, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(2100),
        Animated.timing(playback, { toValue: 3, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(640),
        Animated.timing(playback, { toValue: 4, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(640),
        Animated.timing(playback, { toValue: 5, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(640),
        Animated.timing(playback, { toValue: 6, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(1500),
      ]),
    ).start();
  }, [playback]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(recordingPulse, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(recordingPulse, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ).start();
  }, [recordingPulse]);

  const videoOpacity = playback.interpolate({ inputRange: [0, 0.85, 1, 2.72, 3, 6], outputRange: [0, 0, 1, 1, 0, 0], extrapolate: 'clamp' });
  const coverOpacity = playback.interpolate({ inputRange: [0, 0.85, 1, 2.72, 3, 6], outputRange: [1, 1, 0, 0, 1, 1], extrapolate: 'clamp' });
  const shutterPromptOpacity = playback.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0], extrapolate: 'clamp' });
  const recordingOpacity = playback.interpolate({ inputRange: [0.9, 1, 2.72, 3], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
  const countdownOpacity = playback.interpolate({ inputRange: [2.72, 3, 5.2, 5.35], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
  const finishedOpacity = playback.interpolate({ inputRange: [5.25, 5.45, 6], outputRange: [0, 1, 1], extrapolate: 'clamp' });
  const countThreeOpacity = playback.interpolate({ inputRange: [2.9, 3.05, 3.7, 3.85], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
  const countTwoOpacity = playback.interpolate({ inputRange: [3.7, 3.85, 4.5, 4.65], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
  const countOneOpacity = playback.interpolate({ inputRange: [4.5, 4.65, 5.25, 5.35], outputRange: [0, 1, 1, 0], extrapolate: 'clamp' });
  const recDotOpacity = recordingPulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  const shutterScale = recordingPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] });

  return (
    <View style={previewStyles.stage}>
      <View style={previewStyles.tape} />
      <View style={previewStyles.polaroidCard}>
        <View style={previewStyles.photoFrame}>
          <Animated.View style={[previewStyles.thumbnail, { opacity: coverOpacity, backgroundColor: colors.accent }]}>
            <PersonScene />
          </Animated.View>
          <Animated.View style={[previewStyles.videoFrame, { opacity: videoOpacity }]}>
            <View style={[previewStyles.videoSky, { backgroundColor: colors.accent }]} />
            <PersonScene />
          </Animated.View>
          <Animated.View style={[previewStyles.shutterPromptOverlay, { opacity: shutterPromptOpacity }]}>
            <Text style={previewStyles.shutterPromptTitle}>Hold the shutter</Text>
            <Text style={previewStyles.shutterPromptSubtitle}>Your video starts first.</Text>
          </Animated.View>
          <Animated.View style={[previewStyles.recordingOverlay, { opacity: recordingOpacity }]}>
            <View style={previewStyles.recBadge}>
              <Animated.View style={[previewStyles.recDot, { opacity: recDotOpacity, backgroundColor: colors.error }]} />
              <Text style={previewStyles.recText}>REC</Text>
            </View>
            <Text style={previewStyles.recordingTitle}>Recording video</Text>
            <Text style={previewStyles.recordingSubtitle}>Keep holding. This is the moving part.</Text>
          </Animated.View>
          <Animated.View style={[previewStyles.countdownOverlay, { opacity: countdownOpacity }]}>
            <View style={previewStyles.countdownNumberSlot}>
              <Animated.Text style={[previewStyles.countdownNumber, { opacity: countThreeOpacity }]}>3</Animated.Text>
              <Animated.Text style={[previewStyles.countdownNumber, previewStyles.countdownNumberOverlay, { opacity: countTwoOpacity }]}>2</Animated.Text>
              <Animated.Text style={[previewStyles.countdownNumber, previewStyles.countdownNumberOverlay, { opacity: countOneOpacity }]}>1</Animated.Text>
            </View>
            <Text style={previewStyles.countdownTitle}>Taking thumbnail</Text>
            <Text style={previewStyles.countdownSubtitle}>Hold still for the cover photo</Text>
          </Animated.View>
          <Animated.View style={[previewStyles.soundButton, { opacity: finishedOpacity }]}>
            <Ionicons name="volume-mute" size={14} color="#fff" />
          </Animated.View>
        </View>
        <Text style={[previewStyles.caption, { fontFamily: fonts.handwrittenBold }, protectTextFromFontClipping(fonts.handwrittenBold, 34)]}>best moment</Text>
        <Text style={[previewStyles.note, { fontFamily: fonts.handwritten }, protectTextFromFontClipping(fonts.handwritten, 20)]}>tap to flip later</Text>
        <Ionicons name="flower-outline" size={18} color={FRAME_INK_SOFT} style={previewStyles.flourish} />
      </View>
      <View style={previewStyles.cameraControls}>
        <Animated.View style={[previewStyles.shutterButton, { borderColor: colors.accent, transform: [{ scale: shutterScale }] }]}>
          <View style={[previewStyles.shutterCore, { backgroundColor: colors.accent }]} />
        </Animated.View>
        <Text style={[previewStyles.cameraControlText, { color: FRAME_INK_SOFT }]}>recording, then thumbnail countdown</Text>
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
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    hintText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
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
  videoFrame: {
    position: 'absolute',
    top: -4,
    right: -4,
    bottom: -4,
    left: -4,
    overflow: 'hidden',
  },
  videoSky: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.85,
  },
  shutterPromptOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.12)',
    paddingHorizontal: 16,
  },
  shutterPromptTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.22)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  shutterPromptSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  recordingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  recBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  recordingTitle: {
    marginTop: 'auto',
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  recordingSubtitle: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: 5,
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.38)',
    paddingHorizontal: 16,
  },
  countdownNumberSlot: {
    width: 76,
    height: 66,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    color: '#fff',
    fontSize: 56,
    fontWeight: '900',
    lineHeight: 60,
  },
  countdownNumberOverlay: {
    position: 'absolute',
  },
  countdownTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
  },
  countdownSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
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
