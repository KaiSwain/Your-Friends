import { colors } from '../../theme/tokens';
import { themes, type ThemeName } from './themes';

/**
 * Every card color is tied to a theme. There is no neutral/base set — swatches only
 * appear in the picker when their owning theme is unlocked.
 */

/**
 * Each theme owns a curated set of 4 card colors drawn from its aesthetic palette.
 * The first color is always the theme's signature tone.
 */
export const themeCardUnlocks: Record<ThemeName, string[]> = {
  default:   [colors.lavender, colors.plum,       colors.rose,       colors.sky],
  neon:      [colors.teal,     colors.mint,       colors.sky,        colors.slate],
  synthwave: [colors.rose,     colors.plum,       colors.burgundy,   colors.lavender],
  matcha:    [colors.sage,     colors.forest,     colors.mint,       colors.gold],
  bubblegum: [colors.rose,     colors.coral,      colors.peach,      colors.lavender],
  lava:      [colors.red,      colors.burgundy,   colors.terracotta, colors.coral],
  arctic:    [colors.sky,      colors.navy,       colors.slate,      colors.teal],
  vintage:   [colors.apricot,  colors.gold,       colors.terracotta, colors.cream],
  grape:     [colors.plum,     colors.lavender,   colors.burgundy,   colors.rose],
  cocoa:     [colors.terracotta, colors.apricot,  colors.gold,       colors.charcoal],
  mint:      [colors.mint,     colors.sage,       colors.teal,       colors.sky],
  noir:      [colors.charcoal, colors.grey,       colors.slate,      colors.cream],
  sunset:    [colors.coral,    colors.peach,      colors.terracotta, colors.apricot],
  forest:    [colors.forest,   colors.sage,       colors.mint,       colors.gold],
  peach:     [colors.peach,    colors.coral,      colors.apricot,    colors.rose],
};

/** Return the card colors unlocked by the given set of purchased themes. */
export function getUnlockedCardColors(purchasedThemes: readonly ThemeName[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of purchasedThemes) {
    for (const c of themeCardUnlocks[name] ?? []) {
      if (!seen.has(c)) { seen.add(c); out.push(c); }
    }
  }
  return out;
}

/** True when the color is unlocked by any purchased theme. */
export function isCardColorUnlocked(color: string, purchasedThemes: readonly ThemeName[]): boolean {
  for (const name of purchasedThemes) {
    if ((themeCardUnlocks[name] ?? []).includes(color)) return true;
  }
  return false;
}

/** Return the list of theme keys that unlock the given color. */
export function getThemesForColor(color: string): ThemeName[] {
  const result: ThemeName[] = [];
  for (const [name, list] of Object.entries(themeCardUnlocks) as [ThemeName, string[]][]) {
    if (list.includes(color)) result.push(name);
  }
  return result;
}

/** Build a user-facing message describing which themes unlock this color. */
export function getCardColorLockMessage(color: string): string {
  const names = getThemesForColor(color).map((n) => themes[n]?.label ?? n);
  if (names.length === 0) return 'This color is not available in any theme.';
  if (names.length === 1) return `Purchase the ${names[0]} theme to unlock this color.`;
  return `Unlocked by any of: ${names.join(', ')}.`;
}
