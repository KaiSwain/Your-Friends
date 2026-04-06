import { ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { fonts } from '../theme/typography';
import { radius, shadow, spacing } from '../theme/tokens';

interface SectionCardProps {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
}

export function SectionCard({ children, eyebrow, title }: SectionCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.card}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    card: {
      borderRadius: radius.lg,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.line,
      padding: spacing.lg,
      gap: spacing.md,
      ...shadow.card,
    },
    eyebrow: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: colors.accent,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    title: {
      fontFamily: fonts.heading,
      fontSize: 24,
      color: colors.ink,
    },
  });
