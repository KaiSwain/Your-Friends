// Re-export the ColorTokens type so other files can reference it via the theme module.
export type { ColorTokens } from '../features/theme/themes';

// Static default-dark palette kept as a fallback for files that cannot use the hook
// (e.g., the root layout before ThemeProvider mounts).
export const colors = {
  // Use this as the main full-screen background color.
  canvas: '#0A0A0A',
  // Use this as a slightly different dark background to create subtle gradients and depth.
  canvasAlt: '#111111',
  // Use this as the main card and surface background color.
  paper: '#1A1A1A',
  // Use this for secondary surfaces that need to feel slightly different from standard cards.
  paperMuted: '#222222',
  // Use this as the brightest text color on dark backgrounds.
  ink: '#F5F5F5',
  // Use this for supporting text that should be readable but less dominant.
  inkSoft: '#A0A0A0',
  // Use this for low-emphasis text such as hints and placeholders.
  inkMuted: '#666666',
  // Use this as the border and divider color across the app.
  line: '#2A2A2A',
  // Use this as the primary brand accent color for actions and highlights.
  accent: '#7C5CFC',
  // Use this as a softer variation of the main accent color.
  accentSoft: '#6B4FD8',
  // Keep this warm terracotta color available for avatars and decorative accents.
  terracotta: '#CC8B74',
  // Keep this apricot color available for avatars and decorative accents.
  apricot: '#E5B28F',
  // Keep this gold color available for avatars and decorative accents.
  gold: '#D4B178',
  // Keep this sage color available for avatars and decorative accents.
  sage: '#AEBFAD',
  // Keep this sky color available for avatars and decorative accents.
  sky: '#9AB7C9',
  // Keep this plum color available for avatars and decorative accents.
  plum: '#8A6D7D',
  // Use pure white when UI text or elements need the strongest possible contrast.
  white: '#FFFFFF',
  // Keep pure black available for shadows or absolute contrast cases.
  black: '#000000',
  // Use this green tone for success feedback.
  success: '#34C759',
  // Use this red tone for error feedback.
  error: '#FF453A',
}; // End the shared color token object.

// Export spacing tokens so components can share the same rhythm and padding scale.
export const spacing = {
  // Extra-small spacing for tight gaps.
  xs: 6,
  // Small spacing for compact layouts.
  sm: 10,
  // Medium spacing for standard padding and gaps.
  md: 16,
  // Large spacing for section-level breathing room.
  lg: 22,
  // Extra-large spacing for bigger layout separation.
  xl: 28,
  // Use this for the biggest standard spacing token in the design system.
  xxl: 36,
}; // End the shared spacing scale.

// Export border-radius tokens so rounded corners stay consistent across the app.
export const radius = {
  // Small radius for compact elements.
  sm: 12,
  // Medium radius for most cards and inputs.
  md: 20,
  // Large radius for more prominent containers.
  lg: 28,
  // Very large radius used for pill-shaped UI like badges and buttons.
  pill: 999,
}; // End the shared radius token object.

// Export reusable shadow presets so surfaces feel consistent on iOS and Android.
export const shadow = {
  // This preset is for regular cards and surfaces.
  card: {
    // Use black as the base shadow color.
    shadowColor: '#000',
    // Offset the shadow slightly downward.
    shadowOffset: { width: 0, height: 4 },
    // Keep the card shadow subtle.
    shadowOpacity: 0.3,
    // Blur the shadow enough to feel soft.
    shadowRadius: 12,
    // Provide the Android elevation equivalent.
    elevation: 4,
  }, // End the standard card shadow preset.
  // This preset is for elements that should feel more raised than normal cards.
  elevated: {
    // Use black as the base shadow color here as well.
    shadowColor: '#000',
    // Push the shadow farther downward to increase the lifted feel.
    shadowOffset: { width: 0, height: 8 },
    // Make the shadow slightly stronger than the regular card preset.
    shadowOpacity: 0.4,
    // Increase the blur radius so the shadow feels softer and broader.
    shadowRadius: 24,
    // Provide the stronger Android elevation equivalent.
    elevation: 8,
  }, // End the elevated shadow preset.
}; // End the shared shadow preset object.

// Export a small palette of accent colors so the app can assign consistent decorative colors to people.
export const accentPalette = [
  // Include the terracotta accent in the reusable palette.
  colors.terracotta,
  // Include the apricot accent in the reusable palette.
  colors.apricot,
  // Include the gold accent in the reusable palette.
  colors.gold,
  // Include the sage accent in the reusable palette.
  colors.sage,
  // Include the sky accent in the reusable palette.
  colors.sky,
  // Include the plum accent in the reusable palette.
  colors.plum,
]; // End the shared accent palette array.