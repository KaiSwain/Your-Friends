import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { PeopleListItem } from '../types/domain';
import type { FontSet } from '../theme/typography';
import { radius, shadow, spacing } from '../theme/tokens';

interface PersonCardProps {
  item: PeopleListItem;
  onPress: () => void;
}

export function PersonCard({ item, onPress }: PersonCardProps) {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}>
        <Text style={styles.avatarLabel}>{getInitials(item.title)}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.caption}>{item.caption}</Text>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </View>
      <Ionicons color={colors.inkSoft} name="chevron-forward" size={18} />
    </Pressable>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.paperMuted,
      borderWidth: 1,
      borderColor: colors.line,
      padding: spacing.md,
      ...shadow.card,
    },
    pressed: { transform: [{ scale: 0.99 }] },
    avatar: {
      width: 54,
      height: 54,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 18,
      color: colors.white,
    },
    body: { flex: 1, gap: 2 },
    caption: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: colors.accent,
      textTransform: 'uppercase',
      letterSpacing: 0.7,
    },
    title: {
      fontFamily: fonts.heading,
      fontSize: 22,
      color: colors.ink,
    },
    subtitle: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.inkSoft,
    },
  });

function getInitials(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
