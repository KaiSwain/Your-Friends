import { StyleSheet, Text, Pressable, View } from 'react-native';

import type { ColorTokens } from '../../features/theme/themes';
import { contrastText } from '../../lib/contrastText';
import { radius, spacing } from '../../theme/tokens';
import type { FontSet } from '../../theme/typography';

interface WallModeToggleOption<T extends string> {
  key: T;
  label: string;
}

interface WallModeToggleProps<T extends string> {
  colors: ColorTokens;
  fonts: FontSet;
  onChange: (value: T) => void;
  options: WallModeToggleOption<T>[];
  tint: string;
  value: T;
}

export function WallModeToggle<T extends string>({ colors, fonts, onChange, options, tint, value }: WallModeToggleProps<T>) {
  const styles = makeStyles(colors, fonts, tint);
  return (
    <View style={styles.toggle} accessibilityRole="tablist">
      {options.map((option) => {
        const active = value === option.key;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet, tint: string) =>
  StyleSheet.create({
    toggle: {
      flexDirection: 'row',
      gap: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: colors.paper,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.line,
    },
    chip: {
      flex: 1,
      alignItems: 'center',
      borderRadius: radius.pill,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
    },
    chipActive: {
      backgroundColor: tint,
    },
    label: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.inkSoft,
    },
    labelActive: {
      color: contrastText(tint),
    },
  });
