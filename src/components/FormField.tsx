import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import type { FontSet } from '../theme/typography';
import { radius, spacing } from '../theme/tokens';

interface FormFieldProps {
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address';
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  value: string;
}

export function FormField({
  autoCapitalize = 'sentences',
  keyboardType = 'default',
  label,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  value,
}: FormFieldProps) {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkSoft}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    wrapper: {
      gap: spacing.xs,
    },
    label: {
      fontFamily: fonts.bodyMedium,
      fontSize: 13,
      color: colors.inkSoft,
    },
    input: {
      fontFamily: fonts.body,
      fontSize: 16,
      color: colors.ink,
      backgroundColor: colors.paperMuted,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 4,
    },
  });
