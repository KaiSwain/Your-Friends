export interface ColorTokens {
  canvas: string;
  canvasAlt: string;
  paper: string;
  paperMuted: string;
  ink: string;
  inkSoft: string;
  inkMuted: string;
  line: string;
  accent: string;
  accentSoft: string;
  terracotta: string;
  apricot: string;
  gold: string;
  sage: string;
  sky: string;
  plum: string;
  white: string;
  black: string;
  success: string;
  error: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export type ThemeName =
  | 'default'
  | 'neon'
  | 'synthwave'
  | 'matcha'
  | 'bubblegum'
  | 'lava'
  | 'arctic'
  | 'vintage'
  | 'grape'
  | 'cocoa'
  | 'mint'
  | 'noir'
  | 'sunset'
  | 'forest'
  | 'peach';

export interface ThemePair {
  light: ColorTokens;
  dark: ColorTokens;
  label: string;
  swatch: string; // representative color for the theme picker
}

// Shared avatar / decorative colors re-used across all themes.
const shared = {
  terracotta: '#CC8B74',
  apricot: '#E5B28F',
  gold: '#D4B178',
  sage: '#AEBFAD',
  sky: '#9AB7C9',
  plum: '#8A6D7D',
  white: '#FFFFFF',
  black: '#000000',
  success: '#34C759',
  error: '#FF453A',
};

// ── Default (current purple accent) ─────────────────────────────────
const defaultDark: ColorTokens = {
  canvas: '#0A0A0A',
  canvasAlt: '#111111',
  paper: '#1A1A1A',
  paperMuted: '#222222',
  ink: '#F5F5F5',
  inkSoft: '#A0A0A0',
  inkMuted: '#666666',
  line: '#2A2A2A',
  accent: '#7C5CFC',
  accentSoft: '#6B4FD8',
  ...shared,
};

const defaultLight: ColorTokens = {
  canvas: '#F5F3EF',
  canvasAlt: '#EAE7E1',
  paper: '#FFFFFF',
  paperMuted: '#F0EDE8',
  ink: '#1A1A1A',
  inkSoft: '#5A5A5A',
  inkMuted: '#999999',
  line: '#E0DDD7',
  accent: '#7C5CFC',
  accentSoft: '#6B4FD8',
  ...shared,
};


// ── Neon (electric cyan on ink black) ───────────────────────────────
const neonDark: ColorTokens = {
  canvas: '#05060A',
  canvasAlt: '#0A0C14',
  paper: '#10121C',
  paperMuted: '#161A28',
  ink: '#E8FBFF',
  inkSoft: '#78D0E0',
  inkMuted: '#4E8898',
  line: '#1E2838',
  accent: '#00F0FF',
  accentSoft: '#00C4D6',
  ...shared,
};

const neonLight: ColorTokens = {
  canvas: '#EAFDFF',
  canvasAlt: '#DBF7FB',
  paper: '#FFFFFF',
  paperMuted: '#E6FAFC',
  ink: '#052028',
  inkSoft: '#337888',
  inkMuted: '#77B3C0',
  line: '#BFEAF2',
  accent: '#00BFD4',
  accentSoft: '#00A3BA',
  ...shared,
};

// ── Synthwave (magenta + violet, 80s retro) ─────────────────────────
const synthwaveDark: ColorTokens = {
  canvas: '#120826',
  canvasAlt: '#1A0C32',
  paper: '#221040',
  paperMuted: '#2C184E',
  ink: '#FFE5FF',
  inkSoft: '#D080D8',
  inkMuted: '#9048A0',
  line: '#3A2258',
  accent: '#FF2A9E',
  accentSoft: '#E01888',
  ...shared,
};

const synthwaveLight: ColorTokens = {
  canvas: '#FFF0FB',
  canvasAlt: '#FBE0F4',
  paper: '#FFFFFF',
  paperMuted: '#FCE8F6',
  ink: '#2A0A38',
  inkSoft: '#7A2A88',
  inkMuted: '#BA78C0',
  line: '#F2C8E8',
  accent: '#E01888',
  accentSoft: '#C8157A',
  ...shared,
};

// ── Matcha (soft green + cream) ─────────────────────────────────────
const matchaDark: ColorTokens = {
  canvas: '#0C100A',
  canvasAlt: '#121810',
  paper: '#1A2218',
  paperMuted: '#222C1E',
  ink: '#EEF5E0',
  inkSoft: '#9FB88A',
  inkMuted: '#6A8458',
  line: '#2A3424',
  accent: '#A8C66C',
  accentSoft: '#93B058',
  ...shared,
};

const matchaLight: ColorTokens = {
  canvas: '#F6F8EE',
  canvasAlt: '#EDF0DF',
  paper: '#FFFFFF',
  paperMuted: '#F2F5E6',
  ink: '#1E2814',
  inkSoft: '#556A38',
  inkMuted: '#92A878',
  line: '#D8E0C0',
  accent: '#7DA042',
  accentSoft: '#6B8C38',
  ...shared,
};

// ── Bubblegum (hot pink + mint) ─────────────────────────────────────
const bubblegumDark: ColorTokens = {
  canvas: '#120A12',
  canvasAlt: '#1A101A',
  paper: '#241628',
  paperMuted: '#2E1C34',
  ink: '#FFECF5',
  inkSoft: '#E098C0',
  inkMuted: '#A0607C',
  line: '#3A2238',
  accent: '#FF6FB7',
  accentSoft: '#E85AA0',
  ...shared,
};

const bubblegumLight: ColorTokens = {
  canvas: '#FFF2F8',
  canvasAlt: '#FFE4EE',
  paper: '#FFFFFF',
  paperMuted: '#FFECF2',
  ink: '#2A0E20',
  inkSoft: '#8A3868',
  inkMuted: '#C88AA8',
  line: '#FACDDE',
  accent: '#FF4D9E',
  accentSoft: '#E6388C',
  ...shared,
};

// ── Lava (molten red + charcoal) ────────────────────────────────────
const lavaDark: ColorTokens = {
  canvas: '#0C0604',
  canvasAlt: '#140A06',
  paper: '#1E100A',
  paperMuted: '#28160E',
  ink: '#FFE4D0',
  inkSoft: '#D09078',
  inkMuted: '#8E5A48',
  line: '#3A1E14',
  accent: '#FF4A1C',
  accentSoft: '#E03A10',
  ...shared,
};

const lavaLight: ColorTokens = {
  canvas: '#FFF3EE',
  canvasAlt: '#FCE4D8',
  paper: '#FFFFFF',
  paperMuted: '#FFEBE0',
  ink: '#2A100A',
  inkSoft: '#8A3820',
  inkMuted: '#C07058',
  line: '#F4C8B0',
  accent: '#E53812',
  accentSoft: '#C82D0C',
  ...shared,
};

// ── Arctic (icy blue + white) ───────────────────────────────────────
const arcticDark: ColorTokens = {
  canvas: '#060A10',
  canvasAlt: '#0A1018',
  paper: '#121A24',
  paperMuted: '#1A2432',
  ink: '#EAF4FF',
  inkSoft: '#8AB0CC',
  inkMuted: '#5A7A96',
  line: '#1F2E42',
  accent: '#6FC5FF',
  accentSoft: '#4CA8E8',
  ...shared,
};

const arcticLight: ColorTokens = {
  canvas: '#F0F6FC',
  canvasAlt: '#E2EDF6',
  paper: '#FFFFFF',
  paperMuted: '#EEF4FA',
  ink: '#0A1A2A',
  inkSoft: '#456080',
  inkMuted: '#8AA0BA',
  line: '#D0DCEA',
  accent: '#2E8EDC',
  accentSoft: '#247CC4',
  ...shared,
};

// ── Vintage (sepia film tones) ──────────────────────────────────────
const vintageDark: ColorTokens = {
  canvas: '#120C08',
  canvasAlt: '#1A140E',
  paper: '#241C14',
  paperMuted: '#2E241A',
  ink: '#F0E4CC',
  inkSoft: '#B89C78',
  inkMuted: '#7E6850',
  line: '#33281A',
  accent: '#C89455',
  accentSoft: '#B0803E',
  ...shared,
};

const vintageLight: ColorTokens = {
  canvas: '#F6EED8',
  canvasAlt: '#EDE2C4',
  paper: '#FBF5E4',
  paperMuted: '#F2E8D0',
  ink: '#2E2414',
  inkSoft: '#78603E',
  inkMuted: '#B09870',
  line: '#E0D2AE',
  accent: '#9A6D2E',
  accentSoft: '#865C20',
  ...shared,
};

// ── Grape (deep purple + gold) ──────────────────────────────────────
const grapeDark: ColorTokens = {
  canvas: '#0A0612',
  canvasAlt: '#120A20',
  paper: '#1C122E',
  paperMuted: '#28183E',
  ink: '#F0E8FF',
  inkSoft: '#B090D0',
  inkMuted: '#705090',
  line: '#2E1E48',
  accent: '#F5C94A',
  accentSoft: '#E0B83C',
  ...shared,
};

const grapeLight: ColorTokens = {
  canvas: '#F5F0FB',
  canvasAlt: '#E8DEF4',
  paper: '#FFFFFF',
  paperMuted: '#EEE6F8',
  ink: '#1A0E2A',
  inkSoft: '#583890',
  inkMuted: '#9680B8',
  line: '#DDCDEC',
  accent: '#7B3FC8',
  accentSoft: '#6930B0',
  ...shared,
};

// ── Cocoa (warm chocolate + cream) ──────────────────────────────────
const cocoaDark: ColorTokens = {
  canvas: '#0E0806',
  canvasAlt: '#160E0A',
  paper: '#20160E',
  paperMuted: '#2A1C14',
  ink: '#F5E4CC',
  inkSoft: '#C09878',
  inkMuted: '#856048',
  line: '#32221A',
  accent: '#D4914A',
  accentSoft: '#BC7C38',
  ...shared,
};

const cocoaLight: ColorTokens = {
  canvas: '#FAF2E8',
  canvasAlt: '#F0E4D4',
  paper: '#FFFFFF',
  paperMuted: '#F6EADC',
  ink: '#2A1A0E',
  inkSoft: '#7A5030',
  inkMuted: '#AE8862',
  line: '#E8D4B8',
  accent: '#A8621E',
  accentSoft: '#8E5018',
  ...shared,
};

// ── Mint (airy teal + cream) ────────────────────────────────────────
const mintDark: ColorTokens = {
  canvas: '#06100E',
  canvasAlt: '#0C1816',
  paper: '#122220',
  paperMuted: '#1A2E2A',
  ink: '#E6F8F2',
  inkSoft: '#8ACABA',
  inkMuted: '#5A8E82',
  line: '#1E3832',
  accent: '#4FD6B0',
  accentSoft: '#3EBE9A',
  ...shared,
};

const mintLight: ColorTokens = {
  canvas: '#EEFAF5',
  canvasAlt: '#DCF2E8',
  paper: '#FFFFFF',
  paperMuted: '#E8F6EF',
  ink: '#0E2420',
  inkSoft: '#3E7868',
  inkMuted: '#80B0A0',
  line: '#C8E8DA',
  accent: '#2EB58A',
  accentSoft: '#229A72',
  ...shared,
};

// ── Noir (monochrome film, high contrast) ───────────────────────────
const noirDark: ColorTokens = {
  canvas: '#050505',
  canvasAlt: '#0C0C0C',
  paper: '#141414',
  paperMuted: '#1C1C1C',
  ink: '#F8F8F8',
  inkSoft: '#A8A8A8',
  inkMuted: '#6A6A6A',
  line: '#242424',
  accent: '#E8E8E8',
  accentSoft: '#BFBFBF',
  ...shared,
};

const noirLight: ColorTokens = {
  canvas: '#FAFAFA',
  canvasAlt: '#F0F0F0',
  paper: '#FFFFFF',
  paperMuted: '#F5F5F5',
  ink: '#0A0A0A',
  inkSoft: '#3A3A3A',
  inkMuted: '#7A7A7A',
  line: '#D8D8D8',
  accent: '#1A1A1A',
  accentSoft: '#3A3A3A',
  ...shared,
};

// ── Sunset (warm pink → orange) ─────────────────────────────────────
const sunsetDark: ColorTokens = {
  canvas: '#140A10',
  canvasAlt: '#1C0E14',
  paper: '#26121A',
  paperMuted: '#321824',
  ink: '#FFE8D8',
  inkSoft: '#E89890',
  inkMuted: '#A06670',
  line: '#3A1E2A',
  accent: '#FF7A5C',
  accentSoft: '#E85F4A',
  ...shared,
};

const sunsetLight: ColorTokens = {
  canvas: '#FFF1EA',
  canvasAlt: '#FDE0D2',
  paper: '#FFFFFF',
  paperMuted: '#FFE8DC',
  ink: '#2A100E',
  inkSoft: '#94403A',
  inkMuted: '#CC8878',
  line: '#F6CCB8',
  accent: '#F0542A',
  accentSoft: '#D8421C',
  ...shared,
};

// ── Forest (deep greens + moss) ─────────────────────────────────────
const forestDark: ColorTokens = {
  canvas: '#060E0A',
  canvasAlt: '#0A160F',
  paper: '#102018',
  paperMuted: '#172A20',
  ink: '#E0F0D8',
  inkSoft: '#8EB090',
  inkMuted: '#58785A',
  line: '#1E3224',
  accent: '#68A860',
  accentSoft: '#538C4C',
  ...shared,
};

const forestLight: ColorTokens = {
  canvas: '#EEF4EC',
  canvasAlt: '#DCE8D8',
  paper: '#FFFFFF',
  paperMuted: '#E8F0E4',
  ink: '#0E2014',
  inkSoft: '#3E6440',
  inkMuted: '#84A088',
  line: '#C8D8C4',
  accent: '#3C7A3A',
  accentSoft: '#2E6430',
  ...shared,
};

// ── Peach (soft pastel cream + coral) ───────────────────────────────
const peachDark: ColorTokens = {
  canvas: '#1A1210',
  canvasAlt: '#221816',
  paper: '#2C201C',
  paperMuted: '#382A24',
  ink: '#FFEAD8',
  inkSoft: '#D8A898',
  inkMuted: '#987268',
  line: '#402C24',
  accent: '#FFB38C',
  accentSoft: '#E89572',
  ...shared,
};

const peachLight: ColorTokens = {
  canvas: '#FFF6EC',
  canvasAlt: '#FDE8D8',
  paper: '#FFFFFF',
  paperMuted: '#FFEEDE',
  ink: '#2A1810',
  inkSoft: '#8A5A42',
  inkMuted: '#C8A080',
  line: '#F4D4B8',
  accent: '#EF8A5A',
  accentSoft: '#D87048',
  ...shared,
};

// ── Exported themes map ─────────────────────────────────────────────
export const themes: Record<ThemeName, ThemePair> = {
  default: { light: defaultLight, dark: defaultDark, label: 'Default', swatch: '#7C5CFC' },
  neon: { light: neonLight, dark: neonDark, label: 'Neon', swatch: '#00F0FF' },
  synthwave: { light: synthwaveLight, dark: synthwaveDark, label: 'Synthwave', swatch: '#FF2A9E' },
  matcha: { light: matchaLight, dark: matchaDark, label: 'Matcha', swatch: '#A8C66C' },
  bubblegum: { light: bubblegumLight, dark: bubblegumDark, label: 'Bubblegum', swatch: '#FF6FB7' },
  lava: { light: lavaLight, dark: lavaDark, label: 'Lava', swatch: '#FF4A1C' },
  arctic: { light: arcticLight, dark: arcticDark, label: 'Arctic', swatch: '#6FC5FF' },
  vintage: { light: vintageLight, dark: vintageDark, label: 'Vintage', swatch: '#C89455' },
  grape: { light: grapeLight, dark: grapeDark, label: 'Grape', swatch: '#F5C94A' },
  cocoa: { light: cocoaLight, dark: cocoaDark, label: 'Cocoa', swatch: '#D4914A' },
  mint: { light: mintLight, dark: mintDark, label: 'Mint', swatch: '#4FD6B0' },
  noir: { light: noirLight, dark: noirDark, label: 'Noir', swatch: '#1A1A1A' },
  sunset: { light: sunsetLight, dark: sunsetDark, label: 'Sunset', swatch: '#FF7A5C' },
  forest: { light: forestLight, dark: forestDark, label: 'Forest', swatch: '#3C7A3A' },
  peach: { light: peachLight, dark: peachDark, label: 'Peach', swatch: '#EF8A5A' },
};

export const themeNames = Object.keys(themes) as ThemeName[];
