import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { radius, shadow, spacing } from '../theme/tokens';
import type { FontSet } from '../theme/typography';
import type { AppUser, GiftNote } from '../types/domain';

interface LockedGiftNoteCardProps {
  giftNote: GiftNote;
  themeColors?: ColorTokens;
  tint?: string;
  person: AppUser | null;
  viewerUserId: string;
  onCancel?: () => void;
}

export function LockedGiftNoteCard({ giftNote, themeColors, tint, person, viewerUserId, onCancel }: LockedGiftNoteCardProps) {
  const { colors: appColors, fonts } = useTheme();
  const colors = themeColors ?? appColors;
  const activeTint = tint ?? colors.accent;
  const isAuthor = giftNote.authorUserId === viewerUserId;
  const isRevealed = giftNote.status === 'revealed';
  const styles = makeStyles(colors, fonts, activeTint);

  const targetName = person?.displayName ?? 'your friend';
  const unlockText = formatUnlockText(giftNote.unlockDate, giftNote.unlockTime);

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Ionicons name={isRevealed ? 'gift-outline' : 'lock-closed-outline'} size={20} color={activeTint} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>{isRevealed ? 'Gift revealed' : 'Locked gift note'}</Text>
          <Text style={styles.title}>{giftNote.title}</Text>
          <Text style={styles.subtitle}>
            {isRevealed
              ? 'This surprise has become a memory on the wall.'
              : isAuthor
                ? `Your note for ${targetName} unlocks ${unlockText}.`
                : `A surprise from ${targetName} unlocks ${unlockText}.`}
          </Text>
        </View>
      </View>
      {isAuthor && giftNote.status === 'locked' && onCancel ? (
        <Pressable onPress={onCancel} style={styles.cancelButton} accessibilityRole="button" accessibilityLabel="Cancel gift note">
          <Text style={styles.cancelText}>Cancel gift note</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet, tint: string) => StyleSheet.create({
    card: {
      gap: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: withAlpha(colors.line, 0.42),
      backgroundColor: colors.paper,
      padding: spacing.md,
      ...shadow.card,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    icon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paper,
    },
    copy: {
      flex: 1,
      gap: 3,
    },
    eyebrow: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: tint,
    },
    title: {
      fontFamily: fonts.bodyBold,
      fontSize: 15,
      color: colors.ink,
    },
    subtitle: {
      fontFamily: fonts.body,
      fontSize: 13,
      lineHeight: 18,
      color: colors.ink,
    },
    cancelButton: {
      alignSelf: 'flex-start',
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.error,
      backgroundColor: colors.paper,
      paddingHorizontal: spacing.md,
      paddingVertical: 7,
    },
    cancelText: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: colors.error,
    },
});

function withAlpha(color: string, alpha: number) {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const value = match[1];
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function formatUnlockText(dateKey: string, timeKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return 'soon';
  const [hour = 9, minute = 0] = timeKey.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
