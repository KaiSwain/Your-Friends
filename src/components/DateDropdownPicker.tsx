import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import type { FontSet } from '../theme/typography';
import { radius, spacing } from '../theme/tokens';

interface DateDropdownPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minDate?: Date;
  maxYearOffset?: number;
}

interface DateParts {
  month: number;
  day: number;
  year: number;
}

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function DateDropdownPicker({
  label,
  value,
  onChange,
  minDate = new Date(),
  maxYearOffset = 10,
}: DateDropdownPickerProps) {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const minParts = useMemo(() => dateToParts(startOfDay(minDate)), [minDate]);
  const maxYear = minParts.year + maxYearOffset;
  const [parts, setParts] = useState<DateParts>(() => parseDateParts(value) ?? minParts);
  const [openField, setOpenField] = useState<'month' | 'day' | 'year' | null>(null);

  useEffect(() => {
    setParts(clampDateParts(parseDateParts(value) ?? minParts, minParts, maxYear));
  }, [maxYear, minParts, value]);

  const clampedParts = clampDateParts(parts, minParts, maxYear);
  const minMonth = clampedParts.year === minParts.year ? minParts.month : 1;
  const minDay = clampedParts.year === minParts.year && clampedParts.month === minParts.month ? minParts.day : 1;
  const maxDay = getDaysInMonth(clampedParts.year, clampedParts.month);
  const monthOptions = useMemo(
    () => Array.from({ length: 12 - minMonth + 1 }, (_, index) => {
      const month = minMonth + index;
      return { label: MONTH_LABELS[month - 1], value: month };
    }),
    [minMonth],
  );
  const dayOptions = useMemo(
    () => Array.from({ length: maxDay - minDay + 1 }, (_, index) => {
      const day = minDay + index;
      return { label: String(day), value: day };
    }),
    [maxDay, minDay],
  );
  const yearOptions = useMemo(
    () => Array.from({ length: maxYear - minParts.year + 1 }, (_, index) => {
      const year = minParts.year + index;
      return { label: String(year), value: year };
    }),
    [maxYear, minParts.year],
  );

  function updateParts(next: Partial<DateParts>) {
    const clamped = clampDateParts({ ...parts, ...next }, minParts, maxYear);
    setParts(clamped);
    onChange(formatDateKey(clamped));
  }

  function selectPart(field: 'month' | 'day' | 'year', selectedValue: number) {
    updateParts({ [field]: selectedValue });
    setOpenField(null);
  }

  return (
    <View style={styles.container}>
      <View style={styles.previewCard}>
        <Text style={styles.previewLabel}>{label}</Text>
        <Text style={styles.previewValue}>
          {MONTH_LABELS[clampedParts.month - 1]} {clampedParts.day}, {clampedParts.year}
        </Text>
      </View>

      <DropdownControl
        label="Month"
        valueLabel={MONTH_LABELS[clampedParts.month - 1]}
        value={clampedParts.month}
        options={monthOptions}
        open={openField === 'month'}
        onToggle={() => setOpenField(openField === 'month' ? null : 'month')}
        onSelect={(month) => selectPart('month', month)}
        styles={styles}
        colors={colors}
      />
      <DropdownControl
        label="Day"
        valueLabel={String(clampedParts.day)}
        value={clampedParts.day}
        options={dayOptions}
        open={openField === 'day'}
        onToggle={() => setOpenField(openField === 'day' ? null : 'day')}
        onSelect={(day) => selectPart('day', day)}
        styles={styles}
        colors={colors}
      />
      <DropdownControl
        label="Year"
        valueLabel={String(clampedParts.year)}
        value={clampedParts.year}
        options={yearOptions}
        open={openField === 'year'}
        onToggle={() => setOpenField(openField === 'year' ? null : 'year')}
        onSelect={(year) => selectPart('year', year)}
        styles={styles}
        colors={colors}
      />
    </View>
  );
}

function DropdownControl({
  label,
  valueLabel,
  value,
  options,
  open,
  onToggle,
  onSelect,
  styles,
  colors,
}: {
  label: string;
  valueLabel: string;
  value: number;
  options: { label: string; value: number }[];
  open: boolean;
  onToggle: () => void;
  onSelect: (value: number) => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ColorTokens;
}) {
  return (
    <View style={styles.dropdownGroup}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.dropdownButton, pressed && styles.dropdownButtonPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${valueLabel}`}
      >
        <Text style={styles.dropdownLabel}>{label}</Text>
        <View style={styles.dropdownValueRow}>
          <Text style={styles.dropdownValue}>{valueLabel}</Text>
          <Text style={styles.dropdownChevron}>{open ? '^' : 'v'}</Text>
        </View>
      </Pressable>
      {open ? (
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator
          style={styles.optionList}
          contentContainerStyle={styles.optionListContent}
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={option.value}
                onPress={() => onSelect(option.value)}
                style={({ pressed }) => [
                  styles.option,
                  selected && styles.optionSelected,
                  pressed && styles.optionPressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.optionText, selected && { color: colors.accent }]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateToParts(date: Date): DateParts {
  return { month: date.getMonth() + 1, day: date.getDate(), year: date.getFullYear() };
}

function parseDateParts(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  const date = new Date(parts.year, parts.month - 1, parts.day);
  if (date.getFullYear() !== parts.year || date.getMonth() !== parts.month - 1 || date.getDate() !== parts.day) return null;
  return parts;
}

function clampDateParts(parts: DateParts, minParts: DateParts, maxYear: number): DateParts {
  const year = clamp(Math.round(parts.year), minParts.year, maxYear);
  const minMonth = year === minParts.year ? minParts.month : 1;
  const month = clamp(Math.round(parts.month), minMonth, 12);
  const minDay = year === minParts.year && month === minParts.month ? minParts.day : 1;
  const day = clamp(Math.round(parts.day), minDay, getDaysInMonth(year, month));
  return { year, month, day };
}

function formatDateKey(parts: DateParts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    container: { gap: spacing.md },
    previewCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.accent + '35',
      backgroundColor: colors.accent + '10',
      padding: spacing.md,
      gap: spacing.xs,
    },
    previewLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.inkSoft,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    previewValue: {
      fontFamily: fonts.heading,
      fontSize: 24,
      color: colors.ink,
    },
    dropdownGroup: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      overflow: 'hidden',
    },
    dropdownButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    dropdownButtonPressed: { backgroundColor: colors.paperMuted },
    dropdownLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.inkSoft,
    },
    dropdownValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    dropdownValue: {
      fontFamily: fonts.bodyBold,
      fontSize: 16,
      color: colors.ink,
    },
    dropdownChevron: {
      width: 12,
      fontFamily: fonts.bodyBold,
      fontSize: 14,
      color: colors.inkSoft,
      textAlign: 'center',
    },
    optionList: {
      maxHeight: 190,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      backgroundColor: colors.paperMuted,
    },
    optionListContent: { paddingVertical: spacing.xs },
    option: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    optionSelected: { backgroundColor: colors.accent + '14' },
    optionPressed: { backgroundColor: colors.accent + '0F' },
    optionText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 15,
      color: colors.ink,
    },
  });
