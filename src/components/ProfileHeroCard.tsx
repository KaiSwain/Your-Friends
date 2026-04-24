import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import type { FontSet } from '../theme/typography';
import { spacing } from '../theme/tokens';
import { CardFlourish } from './CardFlourish';

interface ProfileHeroCardProps {
  accentColor: string;
  name: string;
  subtitle: string;
  imageUri?: string | null;
  tags?: string[];
  onPressPhoto?: () => void;
}

export function ProfileHeroCard({ accentColor, name, subtitle, imageUri, tags, onPressPhoto }: ProfileHeroCardProps) {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const photoContent = imageUri ? (
    <>
      <Image source={{ uri: imageUri }} style={styles.photoImage} fadeDuration={0} />
      <View style={styles.warmBaseTint} />
      <LinearGradient
        colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.06)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.photoSheen}
      />
      <View style={styles.insetShadowTop} />
      <View style={styles.insetShadowLeft} />
    </>
  ) : (
    <View style={[styles.photoSurface, { backgroundColor: accentColor }]}>
      <Text style={styles.initials}>{getInitials(name)}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.stack}>
        <View style={[styles.sheet, styles.sheetBack]} />
        <View style={styles.ambientShadow}>
          <View style={styles.tape} />
          <View style={styles.card}>
            {onPressPhoto ? (
              <Pressable onPress={onPressPhoto} style={styles.photoFrame}>
                {photoContent}
                <View style={styles.photoOverlay}>
                  <Text style={styles.photoOverlayText}>Change</Text>
                </View>
              </Pressable>
            ) : (
              <View style={styles.photoFrame}>
                {photoContent}
              </View>
            )}
            <View style={styles.bottomStrip}>
              <Text style={styles.cardName} numberOfLines={1}>{name}</Text>
            </View>
            <CardFlourish size={14} color={FRAME_INK} opacity={0.22} inset={10} />
          </View>
        </View>
      </View>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

function getInitials(value: string) {
  return value.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

const PHOTO_SIZE = 120;
const CARD_PAD_TOP = 8;
const CARD_PAD_SIDE = 8;
const STRIP_HEIGHT = 44;
const CARD_WIDTH = PHOTO_SIZE + CARD_PAD_SIDE * 2;
const CARD_HEIGHT = PHOTO_SIZE + CARD_PAD_TOP + STRIP_HEIGHT;

// Warm ivory — real Polaroid frames are never pure white.
const POLAROID_FRAME = '#F5F2EA';
const FRAME_INK = '#2A2218';

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    container: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md },
    stack: { width: CARD_WIDTH + 20, height: CARD_HEIGHT + 20 },
    sheet: {
      position: 'absolute',
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      borderRadius: 2,
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
      borderWidth: 1,
      borderColor: colors.line,
      left: 10,
      top: 10,
    },
    sheetBack: { transform: [{ rotate: '6deg' }] },
    card: {
      position: 'absolute',
      left: 10,
      top: 10,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      borderRadius: 3,
      backgroundColor: POLAROID_FRAME,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(180,170,155,0.4)',
      paddingTop: CARD_PAD_TOP,
      paddingHorizontal: CARD_PAD_SIDE,
      paddingBottom: 0,
      alignItems: 'center',
      transform: [{ rotate: '-3deg' }],
      // Contact shadow (tight, dark)
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.25,
      shadowRadius: 3,
      elevation: 5,
    },
    tape: {
      position: 'absolute',
      top: 3,
      alignSelf: 'center',
      width: 36,
      height: 10,
      backgroundColor: 'rgba(255,255,220,0.35)',
      borderRadius: 2,
      zIndex: 2,
      transform: [{ rotate: '-3deg' }],
    },
    ambientShadow: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
    },
    photoFrame: {
      width: PHOTO_SIZE,
      height: PHOTO_SIZE,
      borderRadius: 1,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.045)',
    },
    photoSurface: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoImage: {
      width: '100%',
      height: '100%',
      transform: [{ scale: 1.01 }],
    },
    photoOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0,0,0,0.45)',
      paddingVertical: 3,
      alignItems: 'center',
    },
    photoOverlayText: { fontFamily: fonts.bodyBold, fontSize: 11, color: '#fff' },
    initials: { fontFamily: fonts.heading, fontSize: 38, color: colors.white },
    bottomStrip: {
      width: '100%',
      height: STRIP_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible' as const,
    },
    cardName: {
      fontFamily: fonts.handwrittenBold,
      fontSize: 16,
      color: FRAME_INK,
      textAlign: 'center',
      width: '100%',
      paddingHorizontal: 8,
      overflow: 'visible' as const,
    },
    warmBaseTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(210,180,140,0.04)',
      zIndex: 4,
      pointerEvents: 'none' as const,
    },
    photoSheen: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 5,
      pointerEvents: 'none' as const,
    },
    insetShadowTop: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      height: 6,
      backgroundColor: 'transparent',
      zIndex: 6,
      pointerEvents: 'none' as const,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.15,
      shadowRadius: 3,
    },
    insetShadowLeft: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      bottom: 0,
      width: 4,
      backgroundColor: 'transparent',
      zIndex: 6,
      pointerEvents: 'none' as const,
      shadowColor: '#000',
      shadowOffset: { width: 3, height: 0 },
      shadowOpacity: 0.1,
      shadowRadius: 3,
    },
    name: {
      fontFamily: fonts.handwrittenBold,
      fontSize: 40,
      color: colors.ink,
      textAlign: 'center',
      width: '100%',
      paddingHorizontal: 10,
      overflow: 'visible' as const,
    },
    subtitle: {
      fontFamily: fonts.body,
      fontSize: 14,
      lineHeight: 20,
      color: colors.inkSoft,
      textAlign: 'center',
    },
    tagRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: 6,
    },
    tag: {
      backgroundColor: colors.accent + '1A',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 999,
    },
    tagText: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: colors.accent,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
  });
