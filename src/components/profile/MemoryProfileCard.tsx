import { ReactNode, useMemo, useState } from 'react';
import { Animated, Image, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { useTheme } from '../../features/theme/ThemeContext';
import type { ColorTokens } from '../../features/theme/themes';
import { useFlipCard } from '../../hooks/useFlipCard';
import { usePolaroidImageReady } from '../../hooks/usePolaroidImageReady';
import { contrastText, contrastTextSoft } from '../../lib/contrastText';
import { protectTextFromFontClipping } from '../../theme/fontProtection';
import type { FontSet } from '../../theme/typography';
import { CardFlourish } from '../CardFlourish';
import { LivePolaroidLayer } from '../LivePolaroidLayer';
import { AvatarInitials, MemoryPhotoEffects, MemoryPhotoGhost } from '../memory-card';

const POLAROID_FRAME = '#F5F2EA';
const FRAME_INK = '#2A2218';
const FRAME_INK_SOFT = '#6B6052';

interface MemoryProfileCardProps {
  accentColor: string;
  backHint?: string;
  backPlaceholder?: string;
  backText?: string | null;
  bottomMinHeight?: number;
  cardColor?: string | null;
  colors?: ColorTokens;
  disabled?: boolean;
  flourishColor?: string;
  glow?: boolean;
  imageUri?: string | null;
  initialsSize?: number;
  name: string;
  nameSize?: number;
  note?: string | null;
  noteLineHeight?: number;
  noteLines?: number;
  onFlip?: (showBack: boolean) => void;
  onPress?: () => void;
  photoSize?: number;
  style?: StyleProp<ViewStyle>;
  videoMuted?: boolean;
  videoUri?: string | null;
}

export function MemoryProfileCard({
  accentColor,
  backHint = 'tap to flip back',
  backPlaceholder = 'Nothing written on the back',
  backText,
  bottomMinHeight = 104,
  cardColor,
  colors: overrideColors,
  disabled,
  flourishColor,
  glow = false,
  imageUri,
  initialsSize = 52,
  name,
  nameSize = 26,
  note,
  noteLineHeight = 18,
  noteLines = 2,
  onFlip,
  onPress,
  photoSize = 200,
  style,
  videoMuted,
  videoUri,
}: MemoryProfileCardProps) {
  const { colors: themeColors, fonts } = useTheme();
  const colors = overrideColors ?? themeColors;
  const styles = useMemo(
    () => makeStyles(colors, fonts, photoSize, bottomMinHeight, noteLines * noteLineHeight, noteLineHeight, nameSize),
    [bottomMinHeight, colors, fonts, nameSize, noteLineHeight, noteLines, photoSize],
  );
  const [frontHeight, setFrontHeight] = useState(0);
  const image = usePolaroidImageReady(imageUri);
  const isGhost = !!imageUri && !image.imageReady;
  const { showBack, frontRotateY, backRotateY, flip } = useFlipCard({
    disabled,
    duration: 360,
    mode: 'continuous',
    onFlip,
  });
  const frameInk = cardColor ? contrastText(cardColor) : FRAME_INK;
  const frameInkSoft = cardColor ? contrastTextSoft(cardColor) : FRAME_INK_SOFT;
  const frameColor = cardColor ?? POLAROID_FRAME;

  function handlePress() {
    if (onPress) {
      onPress();
      return;
    }
    flip();
  }

  return (
    <Pressable onPress={handlePress} disabled={disabled && !onPress} style={style}>
      <View style={[styles.ambientShadow, glow && styles.premiumGlow]} renderToHardwareTextureAndroid>
        <View
          onLayout={(event) => {
            const height = event.nativeEvent.layout.height;
            if (height > 0) setFrontHeight(height);
          }}
          style={styles.faceHost}
        >
          <Animated.View pointerEvents={showBack ? 'none' : 'auto'} style={[styles.face, { transform: [{ perspective: 1000 }, { rotateY: frontRotateY }] }]}>
            <ProfileCardFace
              accentColor={accentColor}
              cardColor={frameColor}
              colors={colors}
              flourishColor={flourishColor ?? frameInkSoft}
              frameInk={frameInk}
              frameInkSoft={frameInkSoft}
              image={image}
              imageUri={imageUri}
              initialsSize={initialsSize}
              isGhost={isGhost}
              name={name}
              note={note}
              styles={styles}
              videoMuted={videoMuted}
              videoUri={videoUri}
            />
          </Animated.View>

          <Animated.View pointerEvents={showBack ? 'auto' : 'none'} style={[styles.faceOverlay, styles.face, { transform: [{ perspective: 1000 }, { rotateY: backRotateY }] }]}>
            <View style={styles.tape} />
            <View style={[styles.card, styles.cardBack, { backgroundColor: frameColor }, frontHeight > 0 && { height: frontHeight }]}>
              {backText ? (
                <Text style={[styles.backText, { color: frameInk }]}>{backText}</Text>
              ) : (
                <Text style={[styles.backPlaceholder, { color: frameInkSoft }]}>{backPlaceholder}</Text>
              )}
              <Text style={[styles.backHint, { color: frameInkSoft }]}>{backHint}</Text>
            </View>
          </Animated.View>
        </View>
      </View>
    </Pressable>
  );
}

function ProfileCardFace({
  accentColor,
  cardColor,
  colors,
  flourishColor,
  frameInk,
  frameInkSoft,
  image,
  imageUri,
  initialsSize,
  isGhost,
  name,
  note,
  styles,
  videoMuted,
  videoUri,
}: {
  accentColor: string;
  cardColor: string;
  colors: ColorTokens;
  flourishColor: string;
  frameInk: string;
  frameInkSoft: string;
  image: ReturnType<typeof usePolaroidImageReady>;
  imageUri?: string | null;
  initialsSize: number;
  isGhost: boolean;
  name: string;
  note?: string | null;
  styles: ReturnType<typeof makeStyles>;
  videoMuted?: boolean;
  videoUri?: string | null;
}) {
  return (
    <>
      <View style={[styles.tape, isGhost && styles.tapeGhost]} />
      <View style={[styles.card, { backgroundColor: cardColor }, isGhost && styles.cardGhost]}>
        <View style={[styles.photoFrame, isGhost && styles.photoFrameGhost]}>
          {image.showImage ? (
            <>
              {isGhost ? <MemoryPhotoGhost style={styles.photoGhostSurface} /> : null}
              <Image
                source={{ uri: imageUri! }}
                style={[styles.photo, isGhost && styles.photoLoading]}
                fadeDuration={0}
                onLoad={image.handleImageLoad}
                onError={image.handleImageError}
              />
              {!isGhost ? (
                <>
                  {videoUri ? <LivePolaroidLayer videoUri={videoUri} colors={colors} forceMuted={videoMuted} /> : null}
                  <MemoryPhotoEffects />
                </>
              ) : null}
            </>
          ) : (
            <View style={[styles.photoSurface, { backgroundColor: accentColor }]}>
              <AvatarInitials name={name} size={initialsSize} />
            </View>
          )}
        </View>
        <View style={styles.bottom}>
          <Text style={[styles.name, { color: frameInk }]} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.noteSlot}>
            {note ? (
              <Text style={[styles.note, { color: frameInkSoft }]} numberOfLines={2}>
                {note}
              </Text>
            ) : null}
          </View>
        </View>
        <CardFlourish size={16} color={flourishColor} opacity={0.28} inset={12} />
      </View>
    </>
  );
}

const makeStyles = (
  colors: ColorTokens,
  fonts: FontSet,
  photoSize: number,
  bottomMinHeight: number,
  noteSlotHeight: number,
  noteLineHeight: number,
  nameSize: number,
) => {
  const padSide = 10;
  return StyleSheet.create({
    ambientShadow: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.16,
      shadowRadius: 24,
    },
    premiumGlow: {
      shadowColor: '#F5C242',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.95,
      shadowRadius: 24,
      elevation: 14,
    },
    faceHost: { alignItems: 'center', justifyContent: 'flex-start' },
    face: { alignItems: 'center', backfaceVisibility: 'hidden' },
    faceOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
    tape: {
      width: 54,
      height: 16,
      backgroundColor: 'rgba(255,255,220,0.35)',
      borderRadius: 3,
      alignSelf: 'center',
      marginBottom: -8,
      zIndex: 1,
      transform: [{ rotate: '-2deg' }],
    },
    tapeGhost: { backgroundColor: 'rgba(255,255,220,0.18)' },
    card: {
      width: photoSize + padSide * 2,
      borderRadius: 3,
      backgroundColor: POLAROID_FRAME,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(180,170,155,0.4)',
      paddingTop: 10,
      paddingHorizontal: padSide,
      paddingBottom: 0,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.25,
      shadowRadius: 3,
      elevation: 5,
    },
    cardGhost: {
      borderColor: 'rgba(180,170,155,0.22)',
      shadowOpacity: 0.12,
      shadowRadius: 8,
      opacity: 0.82,
    },
    photoFrame: {
      width: photoSize,
      height: photoSize,
      borderRadius: 1,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.045)',
    },
    photoFrameGhost: {
      borderColor: 'rgba(0,0,0,0.025)',
      backgroundColor: 'rgba(237,232,221,0.58)',
    },
    photo: { width: '100%', height: '100%', transform: [{ scale: 1.01 }] },
    photoLoading: { opacity: 0 },
    photoGhostSurface: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
      backgroundColor: '#DCD7CC',
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoSurface: {
      flex: 1,
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bottom: {
      width: '100%',
      paddingTop: 6,
      paddingBottom: 28,
      alignItems: 'center',
      gap: 4,
      overflow: 'visible',
      minHeight: bottomMinHeight,
      justifyContent: 'flex-start',
    },
    noteSlot: { width: '100%', minHeight: noteSlotHeight, justifyContent: 'flex-start' },
    name: {
      fontFamily: fonts.handwrittenBold,
      fontSize: nameSize,
      color: FRAME_INK,
      textAlign: 'center',
      width: '100%',
      paddingHorizontal: 10,
      overflow: 'visible',
      ...protectTextFromFontClipping(fonts.handwrittenBold, nameSize),
    },
    note: {
      fontFamily: fonts.handwritten,
      fontSize: 15,
      lineHeight: noteLineHeight,
      color: FRAME_INK_SOFT,
      textAlign: 'center',
      width: '100%',
      paddingHorizontal: 10,
      overflow: 'visible',
      ...protectTextFromFontClipping(fonts.handwritten, 15),
    },
    cardBack: {
      paddingTop: 24,
      paddingHorizontal: padSide + 6,
      paddingBottom: 24,
      justifyContent: 'center',
      gap: 8,
    },
    backText: {
      fontFamily: fonts.handwritten,
      fontSize: 17,
      lineHeight: 24,
      textAlign: 'center',
      color: FRAME_INK,
      flex: 1,
      ...protectTextFromFontClipping(fonts.handwritten, 17),
    },
    backPlaceholder: {
      fontFamily: fonts.handwritten,
      fontSize: 17,
      textAlign: 'center',
      color: FRAME_INK_SOFT,
      flex: 1,
      opacity: 0.5,
      ...protectTextFromFontClipping(fonts.handwritten, 17),
    },
    backHint: {
      fontFamily: fonts.body,
      fontSize: 10,
      textAlign: 'center',
      color: FRAME_INK_SOFT,
      opacity: 0.5,
      paddingTop: 2,
    },
  });
};

export function MemoryProfileCardPreview(props: MemoryProfileCardProps & { liveBadge?: ReactNode }) {
  return <MemoryProfileCard photoSize={140} bottomMinHeight={92} initialsSize={38} nameSize={20} {...props} />;
}
