import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { OnboardingFrame } from '../../src/features/onboarding/OnboardingFrame';
import { useTheme } from '../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../src/features/theme/themes';
import { pushOnce } from '../../src/lib/navigationGuard';
import { protectTextFromFontClipping } from '../../src/theme/fontProtection';
import type { FontSet } from '../../src/theme/typography';
import { radius, spacing } from '../../src/theme/tokens';

const EXAMPLES = [
  { icon: 'gift-outline' as const, title: 'Birthdays', body: "Remember the dates that matter without keeping them in your head." },
  { icon: 'heart-outline' as const, title: 'Anniversaries', body: 'Save friendship moments, traditions, and yearly reminders.' },
  { icon: 'calendar-outline' as const, title: 'Plans', body: 'Keep friend-specific plans next to the memories and profile details.' },
];

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAYS = Array.from({ length: 35 }, (_, index) => index - 2).map((day) => (day > 0 && day <= 31 ? day : null));
const MARKED_DAYS: Record<number, string[]> = {
  5: ['birthday'],
  12: ['photo'],
  14: ['anniversary', 'note'],
  21: ['custom'],
  27: ['birthday', 'custom'],
};

export default function OnboardingCalendarIntroScreen() {
  const router = useRouter();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <OnboardingFrame
      step={3}
      totalSteps={12}
      eyebrow="Remember"
      title="Your calendar is for friendship moments."
      subtitle="Use it for birthdays, plans, anniversaries, and reminders tied to specific people, not just random dates."
      footer={<ActionButton label="Got it" onPress={() => pushOnce(router, '/(onboarding)/live-polaroids')} />}
    >
      <ScrollView style={styles.scroller} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.calendarShell}>
          <View style={styles.monthHeader}>
            <View style={styles.monthButton}>
              <Ionicons name="chevron-back" size={16} color={colors.inkSoft} />
            </View>
            <Text style={styles.monthTitle}>May 2026</Text>
            <View style={styles.monthButton}>
              <Ionicons name="chevron-forward" size={16} color={colors.inkSoft} />
            </View>
          </View>

          <View style={styles.legendRow}>
            {([
              { key: 'birthday', label: 'Birthday' },
              { key: 'anniversary', label: 'Anniversary' },
              { key: 'custom', label: 'Event' },
              { key: 'photo', label: 'Photo' },
            ] as const).map((item) => (
              <View key={item.key} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: getCategoryColor(item.key, colors) }]} />
                <Text style={styles.legendText}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((day, index) => (
              <Text key={`${day}-${index}`} style={styles.weekday}>{day}</Text>
            ))}
          </View>

          <View style={styles.grid}>
            {DAYS.map((day, index) => {
              if (!day) return <View key={`blank-${index}`} style={styles.dayCell} />;
              const selected = day === 14;
              const today = day === 18;
              const marks = MARKED_DAYS[day] ?? [];
              return (
                <View key={day} style={[styles.dayCell, selected && styles.dayCellSelected, today && !selected && styles.dayCellToday]}>
                  <Text style={[styles.dayNumber, selected && styles.dayNumberSelected]}>{day}</Text>
                  <View style={styles.dotRow}>
                    {marks.slice(0, 3).map((mark) => (
                      <View key={mark} style={[styles.dot, { backgroundColor: getCategoryColor(mark, colors) }]} />
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.list}>
          {EXAMPLES.map((item) => (
            <View key={item.title} style={styles.row}>
              <View style={styles.iconBubble}>
                <Ionicons name={item.icon} size={18} color={colors.accent} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowText}>{item.body}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </OnboardingFrame>
  );
}

function getCategoryColor(category: string, colors: ColorTokens) {
  if (category === 'birthday') return colors.plum;
  if (category === 'anniversary') return colors.accent;
  if (category === 'custom') return colors.gold;
  if (category === 'photo') return colors.terracotta;
  return colors.inkSoft;
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    scroller: { flex: 1 },
    content: { gap: spacing.md, paddingBottom: spacing.xl },
    calendarShell: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      padding: spacing.md,
      gap: spacing.sm,
    },
    monthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    monthButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paperMuted,
    },
    monthTitle: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 20) },
    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      paddingHorizontal: spacing.xs,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendText: { fontFamily: fonts.body, fontSize: 10, color: colors.inkMuted },
    weekdayRow: { flexDirection: 'row' },
    weekday: {
      width: `${100 / 7}%`,
      textAlign: 'center',
      fontFamily: fonts.bodyBold,
      fontSize: 10,
      color: colors.inkMuted,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayCell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      borderRadius: 13,
    },
    dayCellSelected: { backgroundColor: colors.accent },
    dayCellToday: { borderWidth: 1, borderColor: colors.accent + '80' },
    dayNumber: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink },
    dayNumberSelected: { color: colors.white },
    dotRow: { flexDirection: 'row', minHeight: 5, gap: 3, alignItems: 'center' },
    dot: { width: 5, height: 5, borderRadius: 3 },
    list: { gap: spacing.sm },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
      borderRadius: radius.md,
      padding: spacing.md,
    },
    iconBubble: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.accent + '18',
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowBody: { flex: 1, gap: 3 },
    rowTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    rowText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.inkSoft },
  });
