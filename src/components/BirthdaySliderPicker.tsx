import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import {
  birthdayPartsToIso,
  clampBirthdayParts,
  getDefaultBirthdayParts,
  getDaysInMonth,
  parseBirthdayParts,
  type BirthdayParts,
} from '../lib/birthday';
import type { FontSet } from '../theme/typography';
import { radius, spacing } from '../theme/tokens';

interface BirthdaySliderPickerProps {
  value: string | null;
  onChange: (value: string) => void;
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

export function BirthdaySliderPicker({ value, onChange }: BirthdaySliderPickerProps) {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [parts, setParts] = useState<BirthdayParts>(() => parseBirthdayParts(value) ?? getDefaultBirthdayParts());
  const [openField, setOpenField] = useState<'month' | 'day' | 'year' | null>(null);

  useEffect(() => {
    const parsed = parseBirthdayParts(value);
    if (parsed) setParts(parsed);
  }, [value]);

  const today = new Date();
  const currentYear = today.getFullYear();
  const maxMonth = parts.year === currentYear ? today.getMonth() + 1 : 12;
  const maxDay = parts.year === currentYear && parts.month === today.getMonth() + 1
    ? today.getDate()
    : getDaysInMonth(parts.year, parts.month);
  const monthOptions = useMemo(
    () => Array.from({ length: maxMonth }, (_, index) => ({
      label: MONTH_LABELS[index],
      value: index + 1,
    })),
    [maxMonth],
  );
  const dayOptions = useMemo(
    () => Array.from({ length: maxDay }, (_, index) => ({
      label: String(index + 1),
      value: index + 1,
    })),
    [maxDay],
  );
  const yearOptions = useMemo(
    () => Array.from({ length: currentYear - 1900 + 1 }, (_, index) => {
      const year = currentYear - index;
      return { label: String(year), value: year };
    }),
    [currentYear],
  );

  function updateParts(next: Partial<BirthdayParts>) {
    const clamped = clampBirthdayParts({ ...parts, ...next });
    setParts(clamped);
    const iso = birthdayPartsToIso(clamped);
    if (iso) onChange(iso);
  }

  function selectPart(field: 'month' | 'day' | 'year', value: number) {
    updateParts({ [field]: value });
    setOpenField(null);
  }

  return (
    <View style={styles.container}>
      <View style={styles.previewCard}>
        <Text style={styles.previewLabel}>Birthday</Text>
        <Text style={styles.previewValue}>
          {MONTH_LABELS[parts.month - 1]} {parts.day}, {parts.year}
        </Text>
      </View>

      <DropdownControl
        label="Month"
        valueLabel={MONTH_LABELS[parts.month - 1]}
        value={parts.month}
        options={monthOptions}
        open={openField === 'month'}
        onToggle={() => setOpenField(openField === 'month' ? null : 'month')}
        onSelect={(month) => selectPart('month', month)}
        styles={styles}
        colors={colors}
      />
      <DropdownControl
        label="Day"
        valueLabel={String(parts.day)}
        value={parts.day}
        options={dayOptions}
        open={openField === 'day'}
        onToggle={() => setOpenField(openField === 'day' ? null : 'day')}
        onSelect={(day) => selectPart('day', day)}
        styles={styles}
        colors={colors}
      />
      <DropdownControl
        label="Year"
        valueLabel={String(parts.year)}
        value={parts.year}
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

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    previewCard: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
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
    dropdownButtonPressed: {
      backgroundColor: colors.paperMuted,
    },
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
    optionListContent: {
      paddingVertical: spacing.xs,
    },
    option: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    optionSelected: {
      backgroundColor: colors.accent + '14',
    },
    optionPressed: {
      backgroundColor: colors.accent + '0F',
    },
    optionText: {
      fontFamily: fonts.bodyMedium,
      fontSize: 15,
      color: colors.ink,
    },
  });
