import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { WallPost } from '../types/domain';
import { fonts } from '../theme/typography';
import { radius, shadow, spacing } from '../theme/tokens';

interface WallPostCardProps {
  authorName: string;
  post: WallPost;
}

export function WallPostCard({ authorName, post }: WallPostCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const date = new Date(post.createdAt);
  const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <View style={styles.wrapper}>
      <View style={[styles.card, styles.tilt]}>
        {post.imageUri ? (
          <Image source={{ uri: post.imageUri }} style={styles.image} />
        ) : (
          <View style={styles.photoArea}>
            <Text style={styles.photoPlaceholder}>📸</Text>
          </View>
        )}
        <View style={styles.body}>
          <Text style={styles.date}>{formatted}</Text>
          <Text style={styles.text} numberOfLines={3}>{post.body}</Text>
          <Text style={styles.author}>— {authorName}</Text>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    wrapper: { paddingVertical: spacing.xs },
    card: {
      backgroundColor: colors.paper,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.line,
      overflow: 'hidden',
      ...shadow.card,
    },
    tilt: { transform: [{ rotate: '-1.5deg' }] },
    photoArea: {
      height: 80,
      backgroundColor: colors.canvasAlt,
      alignItems: 'center',
      justifyContent: 'center',
    },
    image: { height: 160, width: '100%' },
    photoPlaceholder: { fontSize: 28 },
    body: { padding: spacing.md, gap: spacing.xs },
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
