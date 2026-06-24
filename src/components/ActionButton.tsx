import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { LiquidGlassView } from './LiquidGlassView';
import type { FontSet } from '../theme/typography';
import { radius, spacing } from '../theme/tokens';

// Define the allowed visual styles this button component supports.
type ActionButtonVariant = 'primary' | 'secondary' | 'ghost';

// Describe the props callers can pass into the button.
interface ActionButtonProps {
  // Optionally pin the primary color for semantic actions that should ignore themes.
  accentColor?: string;
  // Allow callers to disable the button when an action is unavailable or busy.
  disabled?: boolean;
  // Require the text shown inside the button.
  label: string;
  // Optionally accept a callback for when the button is pressed.
  onPress?: () => void;
  // Optionally let callers choose the button variant.
  variant?: ActionButtonVariant;
} // End the ActionButtonProps interface.

export function ActionButton({
  accentColor,
  disabled = false,
  label,
  onPress,
  variant = 'primary',
}: ActionButtonProps) {
  const { colors, fonts, resolvedMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts, resolvedMode, accentColor), [accentColor, colors, fonts, resolvedMode]);
  const primaryGradient = useMemo(() => getPrimaryGradient(colors, accentColor), [accentColor, colors]);
  const labelElement = (
    <Text
      // Build the text style array so label color matches the button variant and disabled state.
      style={[
        // Always apply the base label typography.
        styles.label,
        // Use the primary label color when the button variant is primary.
        variant === 'primary' && styles.primaryLabel,
        // Use the non-primary label color for all non-primary variants.
        variant !== 'primary' && styles.secondaryLabel,
        // Override the label color when the button is disabled.
        disabled && styles.disabledLabel,
      ]}
    >
      {/* Render the actual text passed in through the `label` prop. */}
      {label}
    </Text>
  );

  return (
    // Use Pressable so the button can react to touch and pressed state.
    <Pressable
      // Pass the disabled state down to the native touchable behavior.
      disabled={disabled}
      // Expose the button to screen readers with its label and disabled state.
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      // Forward the optional press callback.
      onPress={onPress}
      // Build the final style array based on variant, pressed state, and disabled state.
      style={({ pressed }) => [
        // Always apply the base button layout styles.
        styles.base,
        // Add the primary background when this is a primary button.
        variant === 'primary' && styles.primary,
        // Add the secondary styling when this is a secondary button.
        variant === 'secondary' && styles.secondary,
        // Add the ghost styling when this is a ghost button.
        variant === 'ghost' && styles.ghost,
        // Add the pressed-state scale effect when the button is actively being pressed and not disabled.
        pressed && !disabled && styles.pressed,
        // Add the dimmed disabled styling when the button is disabled.
        disabled && styles.disabled,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.content}>
          <View pointerEvents="none" style={styles.primaryGlow} />
          {labelElement}
        </LinearGradient>
      ) : (
        <LiquidGlassView
          borderRadius={radius.pill}
          intensity={variant === 'secondary' ? 28 : 16}
          style={styles.glassContent}
          contentStyle={styles.content}
        >
          {labelElement}
        </LiquidGlassView>
      )}
    </Pressable>
  );
} // End ActionButton

const makeStyles = (colors: ColorTokens, fonts: FontSet, mode: 'light' | 'dark', accentColor?: string) => {
  const light = mode === 'light';
  return StyleSheet.create({
  // Define the base layout shared by every button variant.
  base: {
    // Keep buttons tall enough to be comfortable to tap.
    minHeight: 54,
    // Use the pill radius token so buttons have rounded ends.
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  content: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  // Define the filled accent style for the main primary button.
  primary: {
    // Use the main accent color as the background.
    backgroundColor: accentColor ?? colors.accent,
    shadowColor: accentColor ?? colors.accent,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: light ? 0.16 : 0.24,
    shadowRadius: light ? 16 : 22,
    elevation: light ? 4 : 6,
  },
  // Define the lighter outlined style for the secondary button.
  secondary: {
    // Use a translucent material so secondary actions feel like liquid glass.
    backgroundColor: withAlpha(colors.paper, light ? 0.36 : 0.22),
    // Add a border so the button still feels clickable.
    borderWidth: 1,
    // Use the shared line color for the border.
    borderColor: withAlpha(colors.white, light ? 0.52 : 0.16),
  },
  // Define the transparent outline style for the ghost button.
  ghost: {
    // Leave the background transparent so the parent surface shows through.
    backgroundColor: withAlpha(colors.paper, light ? 0.12 : 0.08),
    // Add a border so the button remains visible.
    borderWidth: 1,
    // Use the shared line color for that border.
    borderColor: withAlpha(colors.line, light ? 0.62 : 0.78),
  },
  glassContent: {
    minHeight: 54,
  },
  primaryGlow: {
    position: 'absolute' as const,
    top: -28,
    right: -18,
    width: 120,
    height: 84,
    borderRadius: 60,
    backgroundColor: withAlpha(colors.white, light ? 0.16 : 0.22),
    transform: [{ rotate: '-12deg' }],
  },
  // Define the small scale effect shown while the user is pressing the button.
  pressed: {
    // Slightly shrink the button to create touch feedback.
    transform: [{ scale: 0.985 }],
  },
  // Define the dimmed appearance for disabled buttons.
  disabled: {
    // Reduce opacity so disabled buttons look inactive.
    opacity: 0.45,
  },
  // Define the base text styling shared by all button labels.
  label: {
    // Use the bold body font so button text feels strong and readable.
    fontFamily: fonts.bodyBold,
    // Keep the label text at a comfortable reading size.
    fontSize: 15,
  },
  // Define the label color used on primary buttons.
  primaryLabel: {
    // Use white text on the accent background for strong contrast.
    color: colors.white,
  },
  // Define the label color used on non-primary buttons.
  secondaryLabel: {
    // Use the main ink color on lighter or transparent surfaces.
    color: colors.ink,
  },
  // Define the label override used when the button is disabled.
  disabledLabel: {
    color: colors.ink,
  },
  });
};

function getPrimaryGradient(colors: ColorTokens, accentColor?: string): readonly [string, string, string] {
  const first = accentColor ?? colors.accent;
  const second = accentColor ? withAlpha(accentColor, 0.92) : colors.accentSoft;
  const third = accentColor ? withAlpha(accentColor, 0.82) : blendHex(colors.accentSoft, colors.accent, 0.24);
  return [first, second, third];
}

function blendHex(base: string, overlay: string, amount: number) {
  const baseRgb = parseHex(base);
  const overlayRgb = parseHex(overlay);
  if (!baseRgb || !overlayRgb) return base;
  const mix = (left: number, right: number) => Math.round(left + (right - left) * amount);
  return `#${toHex(mix(baseRgb.r, overlayRgb.r))}${toHex(mix(baseRgb.g, overlayRgb.g))}${toHex(mix(baseRgb.b, overlayRgb.b))}`;
}

function parseHex(value: string) {
  const normalized = value.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function toHex(value: number) {
  return value.toString(16).padStart(2, '0');
}

function withAlpha(color: string, alpha: number) {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const value = match[1];
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}