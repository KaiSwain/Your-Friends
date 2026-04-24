import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import type { FontSet } from '../theme/typography';
import { radius, spacing } from '../theme/tokens';

// Define the allowed visual styles this button component supports.
type ActionButtonVariant = 'primary' | 'secondary' | 'ghost';

// Describe the props callers can pass into the button.
interface ActionButtonProps {
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
  disabled = false,
  label,
  onPress,
  variant = 'primary',
}: ActionButtonProps) {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  return (
    // Use Pressable so the button can react to touch and pressed state.
    <Pressable
      // Pass the disabled state down to the native touchable behavior.
      disabled={disabled}
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
      {/* Render the button label with variant-aware text styling. */}
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
    </Pressable>
  );
} // End ActionButton

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
  // Define the base layout shared by every button variant.
  base: {
    // Keep buttons tall enough to be comfortable to tap.
    minHeight: 52,
    // Use the pill radius token so buttons have rounded ends.
    borderRadius: radius.pill,
    // Center the label horizontally.
    alignItems: 'center',
    // Center the label vertically.
    justifyContent: 'center',
    // Add horizontal padding so labels do not touch the edges.
    paddingHorizontal: spacing.lg,
  },
  // Define the filled accent style for the main primary button.
  primary: {
    // Use the main accent color as the background.
    backgroundColor: colors.accent,
  },
  // Define the lighter outlined style for the secondary button.
  secondary: {
    // Use the paper surface color as the background.
    backgroundColor: colors.paper,
    // Add a border so the button still feels clickable.
    borderWidth: 1,
    // Use the shared line color for the border.
    borderColor: colors.line,
  },
  // Define the transparent outline style for the ghost button.
  ghost: {
    // Leave the background transparent so the parent surface shows through.
    backgroundColor: 'transparent',
    // Add a border so the button remains visible.
    borderWidth: 1,
    // Use the shared line color for that border.
    borderColor: colors.line,
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
    color: colors.inkSoft,
  },
});