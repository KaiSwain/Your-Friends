import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { fonts } from '../theme/typography';
import { spacing } from '../theme/tokens';

interface ProfileHeroCardProps {
  accentColor: string;
  name: string;
  subtitle: string;
  imageUri?: string | null;
  tags?: string[];
  onPressPhoto?: () => void;
}

export function ProfileHeroCard({ accentColor, name, subtitle, imageUri, tags, onPressPhoto }: ProfileHeroCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const photoContent = imageUri ? (
    <Image source={{ uri: imageUri }} style={styles.photoImage} />
  ) : (
    <View style={[styles.photoSurface, { backgroundColor: accentColor }]}>
      <Text style={styles.initials}>{getInitials(name)}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.stack}>
        <View style={[styles.sheet, styles.sheetBack]} />
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
        </View>
      </View>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {tags && tags.length > 0 && (
        <View style={styles.tagRow}>
          {tags.map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function getInitials(value: string) {
  return value.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

const PHOTO_SIZE = 120;
const CARD_PADDING = 12;
const CARD_WIDTH = PHOTO_SIZE + CARD_PADDING * 2;
const STRIP_HEIGHT = 36;
const CARD_HEIGHT = PHOTO_SIZE + CARD_PADDING + STRIP_HEIGHT;

const makeStyles = (colors: ColorTokens) =>
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
      borderRadius: 2,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.line,
      padding: CARD_PADDING,
      paddingBottom: 0,
      alignItems: 'center',
      transform: [{ rotate: '-3deg' }],
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 4,
    },
    photoFrame: {
      width: PHOTO_SIZE,
      height: PHOTO_SIZE,
      borderRadius: 1,
      overflow: 'hidden',
    },
    photoSurface: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoImage: {
      width: '100%',
      height: '100%',
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
    },
    cardName: {
      fontFamily: fonts.heading,
      fontSize: 14,
      color: colors.ink,
      textAlign: 'center',
    },
    name: {
      fontFamily: fonts.heading,
      fontSize: 28,
      color: colors.ink,
      textAlign: 'center',
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
