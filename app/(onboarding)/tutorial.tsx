import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { OnboardingFrame } from '../../src/features/onboarding/OnboardingFrame';
import { useOnboarding } from '../../src/features/onboarding/OnboardingContext';
import { useTheme } from '../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../src/features/theme/themes';
import type { FontSet } from '../../src/theme/typography';
import { radius, spacing } from '../../src/theme/tokens';

interface TutorialSlide {
  eyebrow: string;
  title: string;
  body: string;
  // Drives the kind of animation we render in the preview area.
  preview: 'develop' | 'wall' | 'shuffle' | 'share';
}

const SLIDES: TutorialSlide[] = [
  {
    eyebrow: 'Capture',
    title: 'Snap a polaroid memory.',
    body: 'Photos develop right in the app — give them a moment to come to life, just like the real thing.',
    preview: 'develop',
  },
  {
    eyebrow: 'A timeline',
    title: 'Watch your friendship take shape.',
    body: 'Your memory wall is a running timeline of polaroids and notes. Tap any card to flip it over and write the why behind the moment.',
    preview: 'wall',
  },
  {
    eyebrow: 'Collect',
    title: 'Swipe through the people you love.',
    body: 'Your friends and saved profiles appear as a stack of cards. Tap one to dive into their wall.',
    preview: 'shuffle',
  },
  {
    eyebrow: 'Just for two',
    title: 'A shared diary, only between you.',
    body: 'Memories you share become a private journal you and your friend keep together \u2014 nobody else can see it. Add to it whenever something matters.',
    preview: 'share',
  },
];

export default function OnboardingTutorialScreen() {
  const router = useRouter();
  const { completeOnboarding } = useOnboarding();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const slide = SLIDES[index];

  async function handleNext() {
    if (index < SLIDES.length - 1) {
      setIndex(index + 1);
      return;
    }
    // After the final tutorial slide, continue into the personalize-your-profile
    // steps (photo → fact → paywall). Onboarding only completes at the paywall.
    router.push('/(onboarding)/profile-photo');
  }

  return (
    <OnboardingFrame
      step={3}
      totalSteps={7}
      eyebrow={slide.eyebrow}
      title={slide.title}
      subtitle={slide.body}
      footer={
        <ActionButton
          label={index < SLIDES.length - 1 ? 'Next' : busy ? 'Setting up…' : 'Continue'}
          onPress={handleNext}
          disabled={busy}
        />
      }
    >
      <View style={styles.previewSurface}>
        <PreviewAnimation key={slide.preview} kind={slide.preview} colors={colors} fonts={fonts} />
      </View>

      <View style={styles.tutorialDots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.tutorialDot,
              { backgroundColor: i === index ? colors.accent : colors.line },
              i === index && styles.tutorialDotActive,
            ]}
          />
        ))}
      </View>
    </OnboardingFrame>
  );
}

interface PreviewAnimationProps {
  kind: 'develop' | 'wall' | 'shuffle' | 'share';
  colors: ColorTokens;
  fonts: FontSet;
}

function PreviewAnimation({ kind, colors, fonts }: PreviewAnimationProps) {
  if (kind === 'develop') return <DevelopAnimation colors={colors} fonts={fonts} />;
  if (kind === 'wall') return <WallAnimation colors={colors} fonts={fonts} />;
  if (kind === 'shuffle') return <ShuffleAnimation colors={colors} fonts={fonts} />;
  return <ShareAnimation colors={colors} fonts={fonts} />;
}

// Real-app polaroid styling, scaled down to fit the onboarding preview surface.
// Source: src/components/WallPostCard.tsx (width 260, padding 14/12/38, frame #F5F2EA).
// Scaled by ~0.6 so it fits the 220px preview frame.
const POLAROID_FRAME = '#F5F2EA';
const POLAROID_BORDER = 'rgba(180,170,155,0.4)';
const TAPE_COLOR = 'rgba(255,255,220,0.45)';
const FRAME_INK = '#2A2218';
const FRAME_INK_SOFT = '#6B6052';
const POLAROID_WIDTH = 156;
const POLAROID_PAD_SIDE = 8;
const POLAROID_PAD_TOP = 7;
const POLAROID_PAD_BOTTOM = 23;
const POLAROID_PHOTO = POLAROID_WIDTH - POLAROID_PAD_SIDE * 2;

function PolaroidTape({ rotate = '-2deg' }: { rotate?: string }) {
  return <View style={[animStyles.tape, { transform: [{ rotate }] }]} />;
}

function DevelopAnimation({ colors, fonts }: { colors: ColorTokens; fonts: FontSet }) {
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = () => {
      reveal.setValue(0);
      Animated.timing(reveal, {
        toValue: 1,
        duration: 2400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: false,
      }).start(() => setTimeout(loop, 1200));
    };
    loop();
  }, [reveal]);

  const overlayOpacity = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0] });
  const photoOpacity = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });

  return (
    <View style={animStyles.polaroidStage}>
      <PolaroidTape rotate="-3deg" />
      <View style={[animStyles.polaroidCard, { transform: [{ rotate: '-3deg' }] }]}>
        <View style={[animStyles.photoArea, { backgroundColor: '#1F1B17' }]}>
          <Animated.View
            style={[animStyles.photoFill, { opacity: photoOpacity, backgroundColor: colors.accent }]}
          />
          <Animated.View
            style={[animStyles.photoOverlay, { opacity: overlayOpacity, backgroundColor: '#1F1B17' }]}
          />
          <Ionicons name="image" size={36} color="#FAF6EC" style={animStyles.photoGlyph} />
        </View>
        <Text style={[animStyles.polaroidCaption, { fontFamily: fonts.handwritten }]}>
          A new memory…
        </Text>
      </View>
    </View>
  );
}

function WallAnimation({ colors, fonts }: { colors: ColorTokens; fonts: FontSet }) {
  const drop = useRef(new Animated.Value(0)).current;
  const flip = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = () => {
      drop.setValue(0);
      Animated.timing(drop, {
        toValue: 1,
        duration: 2200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setTimeout(loop, 1600));
    };
    loop();
  }, [drop]);

  useEffect(() => {
    // Flip the bottom polaroid on a longer loop so users see what tapping a memory does.
    Animated.loop(
      Animated.sequence([
        Animated.delay(1400),
        Animated.timing(flip, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(1600),
        Animated.timing(flip, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]),
    ).start();
  }, [flip]);

  // Newest item drops in at the *top* of the timeline (most-recent-first feed order).
  const incomingTranslate = drop.interpolate({
    inputRange: [0, 1],
    outputRange: [-32, 0],
  });
  const incomingOpacity = drop.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 1, 1],
  });

  // Side flip for the bottom polaroid: rotateY 0 → 180, with front/back face swap at the midpoint.
  const flipRotateY = flip.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const flipFrontOpacity = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [1, 1, 0, 0] });
  const flipBackOpacity = flip.interpolate({ inputRange: [0, 0.49, 0.5, 1], outputRange: [0, 0, 1, 1] });

  return (
    <View style={animStyles.timelineStage}>
      {/* Vertical timeline line */}
      <View style={[animStyles.timelineLine, { backgroundColor: colors.line }]} />

      {/* Newest at top: incoming polaroid (today) */}
      <Animated.View
        style={[
          animStyles.timelineRow,
          { opacity: incomingOpacity, transform: [{ translateY: incomingTranslate }] },
        ]}
      >
        <View style={[animStyles.timelineDot, { backgroundColor: colors.accent }]} />
        <View style={animStyles.timelineDateBox}>
          <Text style={[animStyles.timelineDate, { fontFamily: fonts.bodyBold, color: colors.accent }]}>
            TODAY
          </Text>
        </View>
        <View style={[animStyles.timelinePolaroid, { transform: [{ rotate: '4deg' }] }]}>
          <View style={animStyles.timelineTape} />
          <View style={[animStyles.timelinePhoto, { backgroundColor: colors.accent }]}>
            <Ionicons name="image" size={14} color="#FAF6EC" />
          </View>
          <Text style={[animStyles.timelinePolaroidCaption, { fontFamily: fonts.handwritten }]}>
            beach day
          </Text>
        </View>
      </Animated.View>

      {/* Middle: text-only memory */}
      <View style={animStyles.timelineRow}>
        <View style={[animStyles.timelineDot, { backgroundColor: colors.accent }]} />
        <View style={animStyles.timelineDateBox}>
          <Text style={[animStyles.timelineDate, { fontFamily: fonts.bodyBold, color: colors.inkSoft }]}>
            APR 18
          </Text>
        </View>
        <View style={animStyles.timelineNote}>
          <Text style={[animStyles.timelineNoteText, { fontFamily: fonts.handwritten, color: colors.ink }]}>
            “you remembered the salt”
          </Text>
        </View>
      </View>

      {/* Oldest at bottom: first polaroid — flips on a loop to show "tap to flip" */}
      <View style={animStyles.timelineRow}>
        <View style={[animStyles.timelineDot, { backgroundColor: colors.accent }]} />
        <View style={animStyles.timelineDateBox}>
          <Text style={[animStyles.timelineDate, { fontFamily: fonts.bodyBold, color: colors.inkSoft }]}>
            APR 12
          </Text>
        </View>
        {/* Outer wrapper: owns layout footprint and the static -3deg polaroid tilt. */}
        <View style={[animStyles.timelineFlipOuter, { transform: [{ rotate: '-3deg' }] }]}>
          {/* Inner wrapper: owns perspective + rotateY so the 3D context is isolated from layout. */}
          <Animated.View
            style={[
              animStyles.timelineFlipInner,
              { transform: [{ perspective: 600 }, { rotateY: flipRotateY }] },
            ]}
          >
            {/* Front face */}
            <Animated.View
              style={[animStyles.timelineFlipFace, { opacity: flipFrontOpacity }]}
            >
              <View style={animStyles.timelinePolaroid}>
                <View style={animStyles.timelineTape} />
                <View style={[animStyles.timelinePhoto, { backgroundColor: colors.accent + 'CC' }]} />
                <Text
                  style={[
                    animStyles.timelinePolaroidCaption,
                    { fontFamily: fonts.handwritten, marginTop: 4, textAlign: 'center' },
                  ]}
                >
                  first hike
                </Text>
              </View>
            </Animated.View>
            {/* Back face — counter-rotated so text reads forward when visible */}
            <Animated.View
              pointerEvents="none"
              style={[
                animStyles.timelineFlipFace,
                animStyles.timelineFlipFaceBack,
                { opacity: flipBackOpacity, transform: [{ rotateY: '180deg' }] },
              ]}
            >
              <View style={animStyles.timelinePolaroid}>
                <View style={animStyles.timelineTape} />
                <View style={animStyles.timelineFlipBackPhotoArea}>
                  <Text style={[animStyles.timelineFlipBackTitle, { fontFamily: fonts.bodyBold, color: FRAME_INK }]}>
                    why I love this
                  </Text>
                  <View style={[animStyles.timelineFlipLine, { backgroundColor: FRAME_INK_SOFT }]} />
                  <View style={[animStyles.timelineFlipLine, animStyles.timelineFlipLineShort, { backgroundColor: FRAME_INK_SOFT }]} />
                  <View style={[animStyles.timelineFlipLine, { backgroundColor: FRAME_INK_SOFT }]} />
                </View>
                {/* Invisible caption stub: keeps back-face height identical to front. */}
                <Text
                  style={[
                    animStyles.timelinePolaroidCaption,
                    { fontFamily: fonts.handwritten, marginTop: 4, textAlign: 'center', opacity: 0 },
                  ]}
                >
                  first hike
                </Text>
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

function ShuffleAnimation({ colors, fonts }: { colors: ColorTokens; fonts: FontSet }) {
  const offset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(offset, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(offset, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      ]),
    ).start();
  }, [offset]);

  const cardATranslate = offset.interpolate({ inputRange: [0, 1], outputRange: [-44, -28] });
  const cardCTranslate = offset.interpolate({ inputRange: [0, 1], outputRange: [44, 28] });
  const cardARotate = offset.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '-4deg'] });
  const cardCRotate = offset.interpolate({ inputRange: [0, 1], outputRange: ['8deg', '4deg'] });
  const centerScale = offset.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.04, 1] });

  const cards: {
    photoColor: string;
    name: string;
    rotate: Animated.AnimatedInterpolation<string>;
    tx: Animated.AnimatedInterpolation<number>;
    z: number;
    isCenter?: boolean;
  }[] = [
    { photoColor: colors.accent + '99', name: 'mom', rotate: cardARotate, tx: cardATranslate, z: 1 },
    {
      photoColor: colors.accent,
      name: 'sam',
      rotate: offset.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '0deg'] }),
      tx: offset.interpolate({ inputRange: [0, 1], outputRange: [0, 0] }),
      z: 2,
      isCenter: true,
    },
    { photoColor: colors.accent + '99', name: 'jordan', rotate: cardCRotate, tx: cardCTranslate, z: 1 },
  ];

  return (
    <View style={animStyles.shuffleStage}>
      {cards.map((card, i) => (
        <Animated.View
          key={i}
          style={[
            animStyles.shufflePolaroid,
            {
              zIndex: card.z,
              transform: [
                { translateX: card.tx },
                { rotate: card.rotate },
                ...(card.isCenter ? [{ scale: centerScale }] : []),
              ],
            },
          ]}
        >
          <View style={animStyles.shufflePolaroidTape} />
          <View style={[animStyles.shufflePolaroidPhoto, { backgroundColor: card.photoColor }]}>
            <Ionicons name="person" size={28} color="#FAF6EC" />
          </View>
          <Text style={[animStyles.shufflePolaroidName, { fontFamily: fonts.handwritten, color: FRAME_INK }]}>
            {card.name}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
}

function ShareAnimation({ colors, fonts }: { colors: ColorTokens; fonts: FontSet }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 3600, easing: Easing.linear, useNativeDriver: true }),
      ]),
    ).start();
  }, [t]);

  // Two memories drop onto the open journal in sequence:
  //  • You add a polaroid to the left page  (phase 0.05 → 0.30)
  //  • Friend writes a note on the right page (phase 0.45 → 0.70)
  // Then both rest in place until the loop restarts.
  const youDrop = t.interpolate({
    inputRange: [0, 0.05, 0.30, 1],
    outputRange: [-40, -40, 0, 0],
    extrapolate: 'clamp',
  });
  const youOpacity = t.interpolate({
    inputRange: [0, 0.05, 0.12, 1],
    outputRange: [0, 0, 1, 1],
    extrapolate: 'clamp',
  });

  const friendDrop = t.interpolate({
    inputRange: [0, 0.45, 0.70, 1],
    outputRange: [-40, -40, 0, 0],
    extrapolate: 'clamp',
  });
  const friendOpacity = t.interpolate({
    inputRange: [0, 0.45, 0.55, 1],
    outputRange: [0, 0, 1, 1],
    extrapolate: 'clamp',
  });

  return (
    <View style={animStyles.journalStage}>
      {/* "You" label above the left page */}
      <View style={animStyles.journalLabelsRow}>
        <View style={[animStyles.journalNamePill, { backgroundColor: colors.accent + '18' }]}>
          <Ionicons name="person" size={11} color={colors.accent} />
          <Text style={[animStyles.journalNameLabel, { color: colors.accent, fontFamily: fonts.bodyBold }]}>You</Text>
        </View>
        <View style={[animStyles.journalNamePill, { backgroundColor: colors.paperMuted, borderColor: colors.line, borderWidth: 1 }]}>
          <Ionicons name="people" size={11} color={colors.inkSoft} />
          <Text style={[animStyles.journalNameLabel, { color: colors.inkSoft, fontFamily: fonts.bodyBold }]}>Friend</Text>
        </View>
      </View>

      {/* Open journal — two facing pages with a center spine. */}
      <View style={[animStyles.journalBook, { backgroundColor: POLAROID_FRAME, borderColor: POLAROID_BORDER }]}>
        {/* Subtle page-fold shadow down the middle */}
        <View style={animStyles.journalSpineShadow} />

        {/* Left page — "You" adds a polaroid */}
        <View style={animStyles.journalPage}>
          <Animated.View
            style={[
              animStyles.journalPolaroid,
              {
                opacity: youOpacity,
                transform: [{ translateY: youDrop }, { rotate: '-5deg' }],
              },
            ]}
          >
            <View style={[animStyles.journalPolaroidPhoto, { backgroundColor: colors.accent }]}>
              <Ionicons name="image" size={11} color="#FAF6EC" />
            </View>
            <Text style={[animStyles.journalPolaroidCaption, { fontFamily: fonts.handwritten }]}>us</Text>
          </Animated.View>
        </View>

        {/* Right page — Friend adds a written note */}
        <View style={animStyles.journalPage}>
          <Animated.View
            style={[
              animStyles.journalNote,
              {
                opacity: friendOpacity,
                transform: [{ translateY: friendDrop }, { rotate: '3deg' }],
              },
            ]}
          >
            <Text style={[animStyles.journalNoteText, { fontFamily: fonts.handwritten, color: FRAME_INK }]}>
              proud of you
            </Text>
            <View style={[animStyles.journalNoteUnderline, { backgroundColor: FRAME_INK_SOFT }]} />
          </Animated.View>
        </View>
      </View>

      <Text style={[animStyles.journalCaption, { color: colors.inkSoft, fontFamily: fonts.body }]}>
        only the two of you can see this
      </Text>
    </View>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    previewSurface: {
      borderRadius: radius.lg,
      backgroundColor: colors.paperMuted,
      borderWidth: 1,
      borderColor: colors.line,
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 220,
    },
    tutorialDots: {
      marginTop: spacing.md,
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    tutorialDot: { width: 8, height: 8, borderRadius: 4 },
    tutorialDotActive: { width: 24, borderRadius: 4 },
    skipButton: { alignSelf: 'center', padding: spacing.sm },
    skipLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: colors.inkSoft,
      textDecorationLine: 'underline',
    },
  });

const animStyles = StyleSheet.create({
  // ── Real polaroid (used by Develop + Flip) ──
  polaroidStage: { alignItems: 'center', justifyContent: 'center' },
  polaroidCard: {
    width: POLAROID_WIDTH,
    paddingHorizontal: POLAROID_PAD_SIDE,
    paddingTop: POLAROID_PAD_TOP,
    paddingBottom: POLAROID_PAD_BOTTOM,
    borderRadius: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: POLAROID_BORDER,
    backgroundColor: POLAROID_FRAME,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 4,
  },
  tape: {
    width: 36,
    height: 11,
    backgroundColor: TAPE_COLOR,
    borderRadius: 1,
    alignSelf: 'center',
    marginBottom: -5,
    zIndex: 2,
  },
  photoArea: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFill: { ...StyleSheet.absoluteFillObject },
  photoOverlay: { ...StyleSheet.absoluteFillObject },
  photoGlyph: { opacity: 0.85 },
  polaroidCaption: { fontSize: 14, color: FRAME_INK },

  // ── Wall (vertical timeline) ──
  timelineStage: {
    width: '100%',
    minHeight: 220,
    paddingVertical: spacing.xs,
    justifyContent: 'space-between',
  },
  timelineLine: {
    position: 'absolute',
    top: 14,
    bottom: 14,
    left: 18,
    width: 1.5,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    gap: 10,
    minHeight: 56,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 1,
    borderWidth: 2,
    borderColor: '#FFFFFFAA',
  },
  timelineDateBox: {
    width: 44,
  },
  timelineDate: {
    fontSize: 9,
    letterSpacing: 0.8,
  },
  timelinePolaroid: {
    width: 88,
    paddingHorizontal: 5,
    paddingTop: 5,
    paddingBottom: 13,
    backgroundColor: POLAROID_FRAME,
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: POLAROID_BORDER,
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 3,
  },
  timelineTape: {
    position: 'absolute',
    top: -4,
    width: 24,
    height: 8,
    backgroundColor: TAPE_COLOR,
    borderRadius: 1,
    transform: [{ rotate: '-4deg' }],
    zIndex: 2,
  },
  timelinePhoto: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelinePolaroidCaption: { fontSize: 10, color: FRAME_INK },
  timelineNote: {
    flex: 1,
    paddingVertical: 2,
  },
  timelineNoteText: { fontSize: 17, lineHeight: 20 },

  // ── Timeline polaroid flip (used by the wall animation) ──
  timelineFlipOuter: {
    width: 88,
  },
  timelineFlipInner: {
    width: '100%',
    position: 'relative',
  },
  // Front face stays in flow so it gives the inner wrapper its height.
  timelineFlipFace: {
    width: '100%',
  },
  // Back face is stacked on top; opacity (not backfaceVisibility) handles the swap.
  timelineFlipFaceBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  timelineFlipBackPhotoArea: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 1,
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 2,
  },
  timelineFlipBackTitle: { fontSize: 9, marginBottom: 2, textAlign: 'center' },
  timelineFlipLine: { height: 2, borderRadius: 1, alignSelf: 'stretch', opacity: 0.5 },
  timelineFlipLineShort: { width: '60%' },

  // ── Shuffle ──
  shuffleStage: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 170,
    position: 'relative',
  },
  shufflePolaroid: {
    position: 'absolute',
    width: 110,
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 44,
    backgroundColor: POLAROID_FRAME,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: POLAROID_BORDER,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  shufflePolaroidTape: {
    position: 'absolute',
    top: -4,
    width: 32,
    height: 10,
    backgroundColor: TAPE_COLOR,
    transform: [{ rotate: '-4deg' }],
  },
  shufflePolaroidPhoto: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shufflePolaroidName: {
    position: 'absolute',
    bottom: 14,
    fontSize: 16,
    color: FRAME_INK,
  },

  // ── Share: open journal ──
  journalStage: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  journalLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 220,
    paddingHorizontal: 4,
  },
  journalNamePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  journalNameLabel: { fontSize: 11 },
  journalBook: {
    flexDirection: 'row',
    width: 220,
    height: 140,
    borderRadius: 3,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 5,
  },
  journalSpineShadow: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 8,
    marginLeft: -4,
    backgroundColor: 'rgba(0,0,0,0.07)',
  },
  journalPage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  journalPolaroid: {
    width: 70,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: POLAROID_BORDER,
    alignItems: 'center',
    gap: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 2,
    elevation: 3,
  },
  journalPolaroidPhoto: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  journalPolaroidCaption: { fontSize: 9, color: FRAME_INK },
  journalNote: {
    alignItems: 'flex-start',
    gap: 3,
  },
  journalNoteText: { fontSize: 18, lineHeight: 22 },
  journalNoteUnderline: {
    height: 1.5,
    width: '70%',
    opacity: 0.5,
    marginTop: 2,
  },
  journalCaption: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
});
