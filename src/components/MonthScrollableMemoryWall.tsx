import { ReactNode, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import type { FontSet } from '../theme/typography';
import { radius, spacing } from '../theme/tokens';
import type { WallPost } from '../types/domain';

export interface DayGroup {
  label: string;
  posts: WallPost[];
}

export interface MonthGroup {
  key: string;
  label: string;
  dayGroups: DayGroup[];
}

interface MonthScrollableMemoryWallProps {
  emptyHint: string;
  posts: WallPost[];
  renderPost: (post: WallPost) => ReactNode;
  themeColors?: ColorTokens;
}

function groupPostsByMonth(posts: WallPost[]): MonthGroup[] {
  const monthGroups: MonthGroup[] = [];
  let currentMonthKey = '';
  let currentDayLabel = '';

  for (const post of posts) {
    const date = new Date(post.createdAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const dayLabel = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    if (monthKey !== currentMonthKey) {
      currentMonthKey = monthKey;
      currentDayLabel = '';
      monthGroups.push({ key: monthKey, label: monthLabel, dayGroups: [] });
    }

    const monthGroup = monthGroups[monthGroups.length - 1];
    if (dayLabel !== currentDayLabel) {
      currentDayLabel = dayLabel;
      monthGroup.dayGroups.push({ label: dayLabel, posts: [] });
    }

    monthGroup.dayGroups[monthGroup.dayGroups.length - 1].posts.push(post);
  }

  return monthGroups;
}

export function useMonthScrollableMemoryWall(posts: WallPost[]) {
  const monthGroups = useMemo(() => groupPostsByMonth(posts), [posts]);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const activeMonth = monthGroups.find((group) => group.key === selectedMonthKey) ?? monthGroups[0] ?? null;

  return {
    monthGroups,
    activeMonth,
    selectedMonthKey,
    setSelectedMonthKey,
  };
}

interface MonthMemoryWallPickerProps {
  monthGroups: MonthGroup[];
  activeMonthKey: string;
  onSelectMonth: (key: string) => void;
  themeColors?: ColorTokens;
}

export function MonthMemoryWallPicker({ monthGroups, activeMonthKey, onSelectMonth, themeColors }: MonthMemoryWallPickerProps) {
  const { colors: appColors, fonts } = useTheme();
  const colors = themeColors ?? appColors;
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  if (monthGroups.length <= 1) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.monthScroller}
    >
      {monthGroups.map((group) => {
        const active = group.key === activeMonthKey;
        return (
          <Pressable
            key={group.key}
            onPress={() => onSelectMonth(group.key)}
            style={[styles.monthChip, active && styles.monthChipActive]}
            accessibilityRole="button"
            accessibilityLabel={`Show memories from ${group.label}`}
          >
            <Text style={[styles.monthChipLabel, active && styles.monthChipLabelActive]}>{group.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

interface MonthMemoryWallStickyHeaderProps {
  label: string;
  themeColors?: ColorTokens;
}

export function MonthMemoryWallStickyHeader({ label, themeColors }: MonthMemoryWallStickyHeaderProps) {
  const { colors: appColors, fonts } = useTheme();
  const colors = themeColors ?? appColors;
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <View style={styles.activeMonthHeader}>
      <View style={styles.dateLine} />
      <Text style={styles.activeMonthLabel}>{label}</Text>
      <View style={styles.dateLine} />
    </View>
  );
}

interface MonthMemoryWallContentProps {
  dayGroups: DayGroup[];
  renderPost: (post: WallPost) => ReactNode;
  themeColors?: ColorTokens;
}

export function MonthMemoryWallContent({ dayGroups, renderPost, themeColors }: MonthMemoryWallContentProps) {
  const { colors: appColors, fonts } = useTheme();
  const colors = themeColors ?? appColors;
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <View style={styles.wallList}>
      {dayGroups.map((group) => (
        <View key={group.label}>
          <View style={styles.dateHeader}>
            <View style={styles.dateLine} />
            <Text style={styles.dateLabel}>{group.label}</Text>
            <View style={styles.dateLine} />
          </View>
          {group.posts.map((post) => renderPost(post))}
        </View>
      ))}
    </View>
  );
}

export function MonthScrollableMemoryWall({ emptyHint, posts, renderPost, themeColors }: MonthScrollableMemoryWallProps) {
  const { colors: appColors, fonts } = useTheme();
  const colors = themeColors ?? appColors;
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { monthGroups, activeMonth, setSelectedMonthKey } = useMonthScrollableMemoryWall(posts);

  if (monthGroups.length === 0) {
    return <Text style={styles.emptyHint}>{emptyHint}</Text>;
  }

  if (!activeMonth) {
    return <Text style={styles.emptyHint}>{emptyHint}</Text>;
  }

  return (
    <View style={styles.wallList}>
      <MonthMemoryWallPicker
        monthGroups={monthGroups}
        activeMonthKey={activeMonth.key}
        onSelectMonth={setSelectedMonthKey}
        themeColors={colors}
      />
      <MonthMemoryWallStickyHeader label={activeMonth.label} themeColors={colors} />
      <MonthMemoryWallContent dayGroups={activeMonth.dayGroups} renderPost={renderPost} themeColors={colors} />
    </View>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    emptyHint: { fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted },
    wallList: { gap: spacing.sm },
    monthScroller: { gap: spacing.xs, paddingBottom: spacing.xs },
    monthChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.line,
    },
    monthChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    monthChipLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.ink,
    },
    monthChipLabelActive: {
      color: colors.white,
    },
    activeMonthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingTop: spacing.xs,
      paddingBottom: spacing.xs,
      backgroundColor: 'transparent',
    },
    activeMonthLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.8 },
    dateHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
    dateLine: { flex: 1, height: 1, backgroundColor: colors.line },
    dateLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  });