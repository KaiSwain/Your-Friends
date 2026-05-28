import { ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { LiquidGlassView } from './LiquidGlassView';
import { protectTextFromFontClipping } from '../theme/fontProtection';
import type { FontSet } from '../theme/typography';
import { radius, shadow, spacing } from '../theme/tokens';

interface SectionCardProps {
  children: ReactNode;
  eyebrow?: string;
  title?: string;
}

export function SectionCard({ children, eyebrow, title }: SectionCardProps) {
  const { colors, fonts, resolvedMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts, resolvedMode), [colors, fonts, resolvedMode]);

  return (
    <LiquidGlassView style={styles.card} contentStyle={styles.cardContent} borderRadius={radius.lg} intensity={resolvedMode === 'light' ? 30 : 42}>
      <View pointerEvents="none" style={styles.paperGrain} />
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </LiquidGlassView>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet, mode: 'light' | 'dark') => {
  const light = mode === 'light';
  return StyleSheet.create({
    card: {
      borderRadius: radius.lg,
      backgroundColor: withAlpha(colors.paper, light ? 0.58 : 0.48),
      borderWidth: 1,
      borderColor: withAlpha(colors.white, light ? 0.48 : 0.14),
      ...shadow.card,
      shadowOpacity: light ? 0.1 : 0.18,
      shadowRadius: light ? 24 : 32,
      elevation: light ? 4 : 7,
    },
    cardContent: {
      padding: spacing.lg,
      gap: spacing.md,
    },
    paperGrain: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: radius.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: withAlpha(colors.white, light ? 0.34 : 0.12),
      backgroundColor: withAlpha(colors.white, light ? 0.018 : 0.008),
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
      ...protectTextFromFontClipping(fonts.heading, 24),
    },
  });
};

function withAlpha(color: string, alpha: number) {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const value = match[1];
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
