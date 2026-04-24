// Per-role font family map. Themes can pick different families for the same role
// to give each theme its own typographic personality (not just colors).
export interface FontSet {
  heading: string;
  body: string;
  bodyMedium: string;
  bodyBold: string;
  handwritten: string;
  handwrittenBold: string;
}

// Available font face IDs (must match the names registered in app/_layout.tsx via useFonts).
const face = {
  newsreader: 'Newsreader_600SemiBold',
  manrope: 'Manrope_400Regular',
  manropeMedium: 'Manrope_500Medium',
  manropeBold: 'Manrope_700Bold',
  caveat: 'Caveat_400Regular',
  caveatBold: 'Caveat_700Bold',
} as const;

// Default set: elegant serif headings + clean sans body + Caveat for handwritten polaroids.
const defaultFonts: FontSet = {
  heading: face.newsreader,
  body: face.manrope,
  bodyMedium: face.manropeMedium,
  bodyBold: face.manropeBold,
  handwritten: face.caveat,
  handwrittenBold: face.caveatBold,
};

// Modern / techy: bold sans headings — neon, synthwave, lava, mint.
const sansFonts: FontSet = {
  heading: face.manropeBold,
  body: face.manrope,
  bodyMedium: face.manropeMedium,
  bodyBold: face.manropeBold,
  handwritten: face.caveat,
  handwrittenBold: face.caveatBold,
};

// Playful: handwritten headings everywhere — bubblegum, grape.
const playfulFonts: FontSet = {
  heading: face.caveatBold,
  body: face.manrope,
  bodyMedium: face.manropeMedium,
  bodyBold: face.manropeBold,
  handwritten: face.caveat,
  handwrittenBold: face.caveatBold,
};

// Editorial: full serif vibe — vintage, cocoa.
const editorialFonts: FontSet = {
  heading: face.newsreader,
  body: face.newsreader,
  bodyMedium: face.newsreader,
  bodyBold: face.newsreader,
  handwritten: face.caveat,
  handwrittenBold: face.caveatBold,
};

// Map theme names to their font set. Keep in sync with `ThemeName` in themes.ts.
export const fontSets: Record<string, FontSet> = {
  default: defaultFonts,
  neon: sansFonts,
  synthwave: sansFonts,
  matcha: defaultFonts,
  bubblegum: playfulFonts,
  lava: sansFonts,
  arctic: defaultFonts,
  vintage: editorialFonts,
  grape: playfulFonts,
  cocoa: editorialFonts,
  mint: sansFonts,
  noir: editorialFonts,
  sunset: playfulFonts,
  forest: defaultFonts,
  peach: playfulFonts,
};

export function getFontSet(themeName: string): FontSet {
  return fontSets[themeName] ?? defaultFonts;
}

// Backward-compatible static export — equals the default set. Components should prefer
// `useTheme().fonts` so font choices follow the active theme.
export const fonts: FontSet = defaultFonts;