import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme/ThemeContext';
import type { ColorTokens } from '../theme/themes';
import type { FontSet } from '../../theme/typography';
import { radius, spacing } from '../../theme/tokens';

interface OnboardingFrameProps {
  step: number;
  totalSteps: number;
  eyebrow: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
  footer: ReactNode;
  // When true, hides the back arrow (e.g. the very first step).
  hideBack?: boolean;
  // When set, renders a top-right close (X) button that calls this handler.
  onClose?: () => void;
}

export function OnboardingFrame({
  step,
  totalSteps,
  eyebrow,
  title,
  subtitle,
  children,
  footer,
  hideBack,
  onClose,
}: OnboardingFrameProps) {
  const router = useRouter();
  const { colors, fonts } = useTheme();
  const styles = makeStyles(colors, fonts);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        {hideBack ? (
          <View style={styles.backPlaceholder} />
        ) : (
          <Ionicons
            name="chevron-back"
            size={24}
            color={colors.inkSoft}
            onPress={() => router.back()}
            suppressHighlighting
          />
        )}
        <View style={styles.dots}>
          {Array.from({ length: totalSteps }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                { backgroundColor: index <= step ? colors.accent : colors.line },
              ]}
            />
          ))}
        </View>
        {onClose ? (
          <Ionicons
            name="close"
            size={24}
            color={colors.inkSoft}
            onPress={onClose}
            suppressHighlighting
            accessibilityLabel="Close"
            accessibilityRole="button"
          />
        ) : (
          <View style={styles.backPlaceholder} />
        )}
      </View>

      <View style={styles.body}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children ? <View style={styles.content}>{children}</View> : null}
      </View>

      <View style={styles.footer}>{footer}</View>
    </View>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.canvas,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
    },
    backPlaceholder: { width: 24, height: 24 },
    dots: { flexDirection: 'row', gap: 6 },
    dot: { width: 18, height: 4, borderRadius: radius.pill },
    body: { flex: 1, gap: spacing.sm },
    eyebrow: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
      color: colors.accent,
    },
    title: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink, lineHeight: 34 },
    subtitle: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft, lineHeight: 22 },
    content: { marginTop: spacing.lg, gap: spacing.md },
    footer: { gap: spacing.sm },
  });
