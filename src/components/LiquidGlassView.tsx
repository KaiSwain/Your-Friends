import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useMemo } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import { radius } from '../theme/tokens';

interface LiquidGlassViewProps {
  borderRadius?: number;
  blurred?: boolean;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  intensity?: number;
  style?: StyleProp<ViewStyle>;
}

export function LiquidGlassView({
  borderRadius = radius.lg,
  blurred = false,
  children,
  contentStyle,
  intensity = 34,
  style,
}: LiquidGlassViewProps) {
  const { colors, resolvedMode } = useTheme();
  const light = resolvedMode === 'light';
  const styles = useMemo(() => makeStyles(borderRadius), [borderRadius]);
  const glassTint = resolvedMode === 'dark' ? 'dark' : 'light';

  return (
    <View style={[styles.shell, style]}>
      {blurred ? <BlurView intensity={intensity} tint={glassTint} style={StyleSheet.absoluteFill} pointerEvents="none" /> : null}
      <View pointerEvents="none" style={[styles.materialTint, { backgroundColor: withAlpha(colors.paper, light ? 0.28 : 0.18) }]} />
      <LinearGradient
        pointerEvents="none"
        colors={[
          withAlpha(colors.white, light ? 0.44 : 0.14),
          withAlpha(colors.white, light ? 0.1 : 0.05),
          withAlpha(colors.paper, light ? 0.04 : 0.08),
        ]}
        locations={[0, 0.42, 1]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.92, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={[styles.topRim, { borderTopColor: withAlpha(colors.white, light ? 0.82 : 0.24) }]} />
      <View pointerEvents="none" style={[styles.bottomRim, { borderBottomColor: withAlpha(colors.black, light ? 0.08 : 0.24) }]} />
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

const makeStyles = (borderRadius: number) =>
  StyleSheet.create({
    shell: {
      borderRadius,
      overflow: 'hidden',
    },
    materialTint: {
      ...StyleSheet.absoluteFillObject,
    },
    topRim: {
      ...StyleSheet.absoluteFillObject,
      borderRadius,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    bottomRim: {
      ...StyleSheet.absoluteFillObject,
      borderRadius,
      borderBottomWidth: StyleSheet.hairlineWidth,
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
