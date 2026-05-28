import { Ionicons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import { protectTextFromFontClipping } from '../theme/fontProtection';
import { radius, shadow, spacing } from '../theme/tokens';
import type { AppUser } from '../types/domain';

interface BirthdayMomentCardProps {
  friend: AppUser;
  onAddMemory: () => void;
}

export function BirthdayMomentCard({ friend, onAddMemory }: BirthdayMomentCardProps) {
  const { colors, fonts } = useTheme();
  const styles = StyleSheet.create({
    card: {
      gap: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.paper,
      padding: spacing.md,
      ...shadow.card,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    avatar: {
      width: 54,
      height: 54,
      borderRadius: 27,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: friend.avatarColor || colors.accent,
      borderWidth: 2,
      borderColor: colors.white,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
    },
    initials: {
      fontFamily: fonts.bodyBold,
      fontSize: 17,
      color: colors.white,
    },
    copy: {
      flex: 1,
      gap: 3,
    },
    eyebrow: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: colors.accent,
    },
    title: {
      fontFamily: fonts.heading,
      fontSize: 22,
      lineHeight: 27,
      color: colors.ink,
      ...protectTextFromFontClipping(fonts.heading, 22),
    },
    subtitle: {
      fontFamily: fonts.body,
      fontSize: 13,
      lineHeight: 19,
      color: colors.ink,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      alignSelf: 'stretch',
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
    },
    buttonPressed: {
      opacity: 0.86,
      transform: [{ scale: 0.99 }],
    },
    buttonText: {
      fontFamily: fonts.bodyBold,
      fontSize: 14,
      color: colors.white,
    },
  });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          {friend.avatarPath ? (
            <Image source={{ uri: friend.avatarPath }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.initials}>{getInitials(friend.displayName)}</Text>
          )}
        </View>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>Birthday moment</Text>
          <Text style={styles.title}>It’s {friend.displayName}’s birthday</Text>
          <Text style={styles.subtitle}>
            Add a memory, note, photo, or song to make their wall feel special today.
          </Text>
        </View>
      </View>
      <Pressable
        onPress={onAddMemory}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        accessibilityRole="button"
        accessibilityLabel={`Add a birthday memory for ${friend.displayName}`}
      >
        <Ionicons name="gift-outline" size={17} color={colors.white} />
        <Text style={styles.buttonText}>Add a birthday memory</Text>
      </Pressable>
    </View>
  );
}

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';
}
