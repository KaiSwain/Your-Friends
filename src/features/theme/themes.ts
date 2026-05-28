import { createCustomThemePair, DEFAULT_CUSTOM_THEME_SETTINGS } from './customTheme';

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
  accentAlt?: string;
  accentTertiary?: string;
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
  | 'custom'
  | 'yourFriends'
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

export const themeComplementColors: Record<ThemeName, { accentAlt: string; accentTertiary: string }> = {
  default: { accentAlt: '#2EC4B6', accentTertiary: '#FFB86B' },
  custom: { accentAlt: '#A992EE', accentTertiary: '#D0A56E' },
  yourFriends: { accentAlt: '#9A83F8', accentTertiary: '#D8CCFF' },
  neon: { accentAlt: '#FF3DF2', accentTertiary: '#FFE66D' },
  synthwave: { accentAlt: '#00E5FF', accentTertiary: '#FFB000' },
  matcha: { accentAlt: '#E9A66A', accentTertiary: '#D8C95F' },
  bubblegum: { accentAlt: '#4FD6B0', accentTertiary: '#B28CFF' },
  lava: { accentAlt: '#FFC857', accentTertiary: '#7BDFF2' },
  arctic: { accentAlt: '#B28CFF', accentTertiary: '#FFB4A2' },
  vintage: { accentAlt: '#6F9E8C', accentTertiary: '#B58ACB' },
  grape: { accentAlt: '#70D6C7', accentTertiary: '#FF9F68' },
  cocoa: { accentAlt: '#7DAF8B', accentTertiary: '#C58ED8' },
  mint: { accentAlt: '#F2B56B', accentTertiary: '#9FA8FF' },
  noir: { accentAlt: '#B23A48', accentTertiary: '#6C8EAD' },
  sunset: { accentAlt: '#7BDFF2', accentTertiary: '#F6C85F' },
  forest: { accentAlt: '#D6A85F', accentTertiary: '#79B7C7' },
  peach: { accentAlt: '#7BC6A4', accentTertiary: '#B894E6' },
};

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

// ── Your Friends (house palette: meaning-based color system) ─────────
const yourFriendsDark: ColorTokens = {
  canvas: '#100D18',
  canvasAlt: '#1A1524',
  paper: '#241E30',
  paperMuted: '#30283E',
  ink: '#FFF7EC',
  inkSoft: '#D4C8DC',
  inkMuted: '#9F93AC',
  line: '#3A3148',
  accent: '#8E72F2',
  accentSoft: '#7359D6',
  accentAlt: '#B7A6FF',
  accentTertiary: '#D9C7A6',
  ...shared,
};

const yourFriendsLight: ColorTokens = {
  canvas: '#FFF7ED',
  canvasAlt: '#F5E8D8',
  paper: '#FFFFFB',
  paperMuted: '#F7EEE2',
  ink: '#251C2D',
  inkSoft: '#655B70',
  inkMuted: '#A2949F',
  line: '#E8DCCB',
  accent: '#7359D6',
  accentSoft: '#8E72F2',
  accentAlt: '#A992EE',
  accentTertiary: '#D0A56E',
  ...shared,
};

// ── Default (current purple accent) ─────────────────────────────────
const defaultDark: ColorTokens = {
  canvas: '#0D0D12',
  canvasAlt: '#15151C',
  paper: '#20202A',
  paperMuted: '#2A2A35',
  ink: '#F7F3EA',
  inkSoft: '#CBC4D0',
  inkMuted: '#928B9A',
  line: '#34323D',
  accent: '#8370D8',
  accentSoft: '#6E5BC2',
  accentAlt: '#AFA0EA',
  accentTertiary: '#BDA67D',
  ...shared,
};

const defaultLight: ColorTokens = {
  canvas: '#FAF7F1',
  canvasAlt: '#EFE9DF',
  paper: '#FFFFFF',
  paperMuted: '#F2EDE5',
  ink: '#24222A',
  inkSoft: '#66616E',
  inkMuted: '#A09AA7',
  line: '#E3DDD3',
  accent: '#7561D8',
  accentSoft: '#8A78E0',
  accentAlt: '#A79BE5',
  accentTertiary: '#C4A36F',
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
  canvas: '#171018',
  canvasAlt: '#221723',
  paper: '#2D2031',
  paperMuted: '#39283D',
  ink: '#FFF0F7',
  inkSoft: '#E3C1D2',
  inkMuted: '#A8899B',
  line: '#443448',
  accent: '#E879B1',
  accentSoft: '#CC629B',
  accentAlt: '#F0A4C8',
  accentTertiary: '#B9A7E8',
  ...shared,
};

const bubblegumLight: ColorTokens = {
  canvas: '#FFF4F8',
  canvasAlt: '#FCE5EE',
  paper: '#FFFFFC',
  paperMuted: '#FBEAF1',
  ink: '#2C1B27',
  inkSoft: '#765A69',
  inkMuted: '#B99AA9',
  line: '#EBD6E0',
  accent: '#D86B9F',
  accentSoft: '#E58AB6',
  accentAlt: '#C897E9',
  accentTertiary: '#F0B7C9',
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
  canvas: '#15100A',
  canvasAlt: '#21190F',
  paper: '#2B2116',
  paperMuted: '#362A1D',
  ink: '#F4E8CF',
  inkSoft: '#C9AD83',
  inkMuted: '#8E7658',
  line: '#443421',
  accent: '#C18A46',
  accentSoft: '#A9783B',
  accentAlt: '#D4AA6F',
  accentTertiary: '#7FA08A',
  ...shared,
};

const vintageLight: ColorTokens = {
  canvas: '#F8EFD8',
  canvasAlt: '#EBDDBD',
  paper: '#FFF8E8',
  paperMuted: '#F2E5C8',
  ink: '#302514',
  inkSoft: '#765E3B',
  inkMuted: '#AA936B',
  line: '#DECDA8',
  accent: '#8F642B',
  accentSoft: '#B5813D',
  accentAlt: '#6E8B76',
  accentTertiary: '#C49A5B',
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
  canvasAlt: '#0F0F0F',
  paper: '#191919',
  paperMuted: '#232323',
  ink: '#FAFAF7',
  inkSoft: '#BDBDB8',
  inkMuted: '#7C7C78',
  line: '#303030',
  accent: '#EFECE5',
  accentSoft: '#C7C3B8',
  accentAlt: '#FFFFFF',
  accentTertiary: '#9A9386',
  ...shared,
};

const noirLight: ColorTokens = {
  canvas: '#F8F7F3',
  canvasAlt: '#EBE9E3',
  paper: '#FFFFFF',
  paperMuted: '#F0EEE8',
  ink: '#111111',
  inkSoft: '#45433F',
  inkMuted: '#85817A',
  line: '#DCD8CF',
  accent: '#161616',
  accentSoft: '#3D3A35',
  accentAlt: '#777168',
  accentTertiary: '#B8B0A0',
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
const customThemePair = createCustomThemePair(DEFAULT_CUSTOM_THEME_SETTINGS);

export const themes: Record<ThemeName, ThemePair> = {
  yourFriends: { light: yourFriendsLight, dark: yourFriendsDark, label: 'Your Friends', swatch: '#7C5CFC' },
  custom: { light: customThemePair.light, dark: customThemePair.dark, label: 'Custom', swatch: customThemePair.light.accent },
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

export const featuredThemeNames = ['yourFriends', 'custom', 'default', 'vintage', 'bubblegum', 'noir'] as const satisfies readonly ThemeName[];
const featuredThemeNameSet = new Set<ThemeName>(featuredThemeNames);
export const legacyThemeNames = themeNames.filter((name) => !featuredThemeNameSet.has(name));
