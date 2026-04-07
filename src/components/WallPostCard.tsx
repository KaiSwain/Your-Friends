import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { contrastText, contrastTextSoft, contrastAccent } from '../lib/contrastText';
import { WallPost } from '../types/domain';
import { fonts } from '../theme/typography';
import { spacing } from '../theme/tokens';

interface WallPostCardProps {
  authorName: string;
  post: WallPost;
  cardColor?: string | null;
  onPress?: () => void;
}

export function WallPostCard({ authorName, post, cardColor, onPress }: WallPostCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [frameWidth, setFrameWidth] = useState(0);

  // Stable random tilt per card instance.
  const tilt = useRef((Math.random() - 0.5) * 5).current;

  useEffect(() => {
    if (post.imageUri) {
      Image.getSize(
        post.imageUri,
        (w, h) => { if (h > 0) setAspectRatio(w / h); },
        () => setAspectRatio(null),
      );
    }
  }, [post.imageUri]);

  const onFrameLayout = (e: LayoutChangeEvent) => {
    setFrameWidth(e.nativeEvent.layout.width);
  };

  const date = new Date(post.createdAt);
  const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const imageHeight = aspectRatio && frameWidth > 0
    ? frameWidth / aspectRatio
    : 260;

  const bg = cardColor || colors.paper;
  const ct = contrastText(cardColor);
  const ctSoft = contrastTextSoft(cardColor);
  const ctAccent = contrastAccent(cardColor, colors.accent);

  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.wrapper, pressed && onPress && styles.pressed]}>
      {/* Tape strip at the top */}
      <View style={styles.tape} />
      <View style={[styles.card, { backgroundColor: bg, transform: [{ rotate: `${tilt}deg` }] }]}>
        {post.imageUri ? (
          <View style={styles.photoFrame} onLayout={onFrameLayout}>
            <Image source={{ uri: post.imageUri }} style={[styles.image, { height: imageHeight }]} />
          </View>
        ) : (
          <View style={styles.photoFrame}>
            <View style={styles.photoPlaceholderArea}>
              <Text style={styles.photoPlaceholder}>📸</Text>
            </View>
          </View>
        )}
        <View style={styles.bottomStrip}>
          <Text style={[styles.date, cardColor && { color: ctAccent }]}>{formatted}</Text>
          {post.body ? <Text style={[styles.text, cardColor && { color: ct }]} numberOfLines={3}>{post.body}</Text> : null}
          <Text style={[styles.author, cardColor && { color: ctSoft }]}>— {authorName}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const CARD_PADDING = 16;

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    wrapper: { paddingVertical: spacing.sm, alignItems: 'center' },
    pressed: { transform: [{ scale: 0.985 }] },
    tape: {
      width: 48,
      height: 14,
      backgroundColor: 'rgba(255,255,220,0.35)',
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: -7,
      zIndex: 1,
    },
    card: {
      width: 260,
      borderRadius: 2,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.line,
      padding: CARD_PADDING,
      paddingBottom: 0,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 12,
      elevation: 5,
    },
    photoFrame: {
      borderRadius: 1,
      overflow: 'hidden',
    },
    photoPlaceholderArea: {
      height: 200,
      backgroundColor: colors.canvasAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    image: { width: '100%' },
    photoPlaceholder: { fontSize: 36 },
    bottomStrip: {
      paddingVertical: spacing.md,
      gap: spacing.xs,
    },
    date: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: colors.accent,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
    text: {
      fontFamily: fonts.body,
      fontSize: 15,
      lineHeight: 22,
      color: colors.ink,
    },
    author: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.inkSoft,
    },
  });
