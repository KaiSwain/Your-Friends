import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useMemo } from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { spacing } from '../theme/tokens';

interface AppScreenProps {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
  scroll?: boolean;
}

export function AppScreen({ children, contentContainerStyle, footer, scroll = true }: AppScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const body = scroll ? (
    <ScrollView
      style={styles.body}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.body, styles.staticContent, contentContainerStyle]}>{children}</View>
  );

  return (
    <LinearGradient colors={[colors.canvas, colors.canvasAlt, colors.canvas]} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        {body}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (_colors: ColorTokens) =>
  StyleSheet.create({
    gradient: { flex: 1 },
    safeArea: { flex: 1 },
    body: { flex: 1 },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      gap: spacing.lg,
    },
    staticContent: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      gap: spacing.lg,
    },
    footer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.lg,
    },
  });