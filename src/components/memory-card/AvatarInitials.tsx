import { useMemo } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle } from 'react-native';

import { useTheme } from '../../features/theme/ThemeContext';

interface AvatarInitialsProps {
  color?: string;
  name: string;
  size?: number;
  style?: StyleProp<TextStyle>;
}

export function AvatarInitials({ color, name, size = 32, style }: AvatarInitialsProps) {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(fonts.bodyBold, color ?? colors.white, size), [color, colors.white, fonts.bodyBold, size]);
  return <Text style={[styles.text, style]}>{getInitials(name) || '?'}</Text>;
}

export function getInitials(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

const makeStyles = (fontFamily: string, color: string, size: number) =>
  StyleSheet.create({
    text: {
      color,
      fontFamily,
      fontSize: size,
      lineHeight: Math.ceil(size * 1.12),
      textAlign: 'center',
      includeFontPadding: false,
    },
  });
