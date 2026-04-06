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
  | 'warm'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'midnight'
  | 'rose'
  | 'monochrome';

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

// ── Warm (earthy amber) ─────────────────────────────────────────────
const warmDark: ColorTokens = {
  canvas: '#0F0B08',
  canvasAlt: '#16120E',
  paper: '#1E1814',
  paperMuted: '#26201A',
  ink: '#F5EDE5',
  inkSoft: '#B8A898',
  inkMuted: '#7A6A5A',
  line: '#302820',
  accent: '#E5983E',
  accentSoft: '#CC8530',
  ...shared,
};

const warmLight: ColorTokens = {
  canvas: '#FAF6F0',
  canvasAlt: '#F0EBE3',
  paper: '#FFFFFF',
  paperMuted: '#F5F0E8',
  ink: '#2A2018',
  inkSoft: '#6B5D50',
  inkMuted: '#A09080',
  line: '#E8E0D5',
  accent: '#D48830',
  accentSoft: '#C07A28',
  ...shared,
};

// ── Ocean (navy teal) ───────────────────────────────────────────────
const oceanDark: ColorTokens = {
  canvas: '#060D12',
  canvasAlt: '#0C1518',
  paper: '#121E24',
  paperMuted: '#1A2830',
  ink: '#E5F0F5',
  inkSoft: '#8AABB8',
  inkMuted: '#5A7A8A',
  line: '#1E3038',
  accent: '#2EC4B6',
  accentSoft: '#22A89C',
  ...shared,
};

const oceanLight: ColorTokens = {
  canvas: '#F0F7FA',
  canvasAlt: '#E5F0F5',
  paper: '#FFFFFF',
  paperMuted: '#EAF4F8',
  ink: '#0C1518',
  inkSoft: '#4A6A78',
  inkMuted: '#88A0AA',
  line: '#D0E0E8',
  accent: '#2EC4B6',
  accentSoft: '#22A89C',
  ...shared,
};

// ── Forest (dark green sage) ────────────────────────────────────────
const forestDark: ColorTokens = {
  canvas: '#080C08',
  canvasAlt: '#0E140E',
  paper: '#152015',
  paperMuted: '#1E2A1E',
  ink: '#E5F0E5',
  inkSoft: '#8AB08A',
  inkMuted: '#5A805A',
  line: '#203020',
  accent: '#5CAA5C',
  accentSoft: '#4A964A',
  ...shared,
};

const forestLight: ColorTokens = {
  canvas: '#F2F7F0',
  canvasAlt: '#E8F0E5',
  paper: '#FFFFFF',
  paperMuted: '#ECF2EA',
  ink: '#141E14',
  inkSoft: '#4A6A4A',
  inkMuted: '#88A888',
  line: '#D0E0D0',
  accent: '#4A964A',
  accentSoft: '#3E8A3E',
  ...shared,
};

// ── Sunset (orange coral) ───────────────────────────────────────────
const sunsetDark: ColorTokens = {
  canvas: '#100808',
  canvasAlt: '#181010',
  paper: '#201616',
  paperMuted: '#2A1E1E',
  ink: '#F5EAEA',
  inkSoft: '#C09898',
  inkMuted: '#886868',
  line: '#352828',
  accent: '#FF6B4A',
  accentSoft: '#E55A3A',
  ...shared,
};

const sunsetLight: ColorTokens = {
  canvas: '#FFF6F2',
  canvasAlt: '#FAECE6',
  paper: '#FFFFFF',
  paperMuted: '#FFF0EA',
  ink: '#2A1818',
  inkSoft: '#7A5050',
  inkMuted: '#AA8888',
  line: '#F0DDD5',
  accent: '#FF6B4A',
  accentSoft: '#E55A3A',
  ...shared,
};

// ── Midnight (deep blue purple) ─────────────────────────────────────
const midnightDark: ColorTokens = {
  canvas: '#08081A',
  canvasAlt: '#0E0E24',
  paper: '#141430',
  paperMuted: '#1C1C3A',
  ink: '#E8E8FA',
  inkSoft: '#9898CC',
  inkMuted: '#6060AA',
  line: '#222248',
  accent: '#8B6CFF',
  accentSoft: '#7A58EE',
  ...shared,
};

const midnightLight: ColorTokens = {
  canvas: '#F2F2FA',
  canvasAlt: '#E8E8F5',
  paper: '#FFFFFF',
  paperMuted: '#EEEEFA',
  ink: '#141430',
  inkSoft: '#5555AA',
  inkMuted: '#8888CC',
  line: '#D5D5F0',
  accent: '#7A58EE',
  accentSoft: '#6A48DD',
  ...shared,
};

// ── Rose (pink blush) ───────────────────────────────────────────────
const roseDark: ColorTokens = {
  canvas: '#100810',
  canvasAlt: '#180E18',
  paper: '#201420',
  paperMuted: '#2A1C2A',
  ink: '#F5E8F5',
  inkSoft: '#C098C0',
  inkMuted: '#886088',
  line: '#352835',
  accent: '#E86AAF',
  accentSoft: '#D45A9E',
  ...shared,
};

const roseLight: ColorTokens = {
  canvas: '#FBF2F8',
  canvasAlt: '#F5E8F0',
  paper: '#FFFFFF',
  paperMuted: '#F8EEF5',
  ink: '#201420',
  inkSoft: '#8A5080',
  inkMuted: '#BB88B0',
  line: '#F0D8E8',
  accent: '#E86AAF',
  accentSoft: '#D45A9E',
  ...shared,
};

// ── Monochrome (pure grayscale) ─────────────────────────────────────
const monoDark: ColorTokens = {
  canvas: '#0A0A0A',
  canvasAlt: '#121212',
  paper: '#1C1C1C',
  paperMuted: '#252525',
  ink: '#EEEEEE',
  inkSoft: '#999999',
  inkMuted: '#666666',
  line: '#2E2E2E',
  accent: '#CCCCCC',
  accentSoft: '#AAAAAA',
  ...shared,
};

const monoLight: ColorTokens = {
  canvas: '#F5F5F5',
  canvasAlt: '#EBEBEB',
  paper: '#FFFFFF',
  paperMuted: '#F0F0F0',
  ink: '#1A1A1A',
  inkSoft: '#666666',
  inkMuted: '#999999',
  line: '#DDDDDD',
  accent: '#444444',
  accentSoft: '#555555',
  ...shared,
};

// ── Exported themes map ─────────────────────────────────────────────
export const themes: Record<ThemeName, ThemePair> = {
  default: { light: defaultLight, dark: defaultDark, label: 'Default', swatch: '#7C5CFC' },
  warm: { light: warmLight, dark: warmDark, label: 'Warm', swatch: '#E5983E' },
  ocean: { light: oceanLight, dark: oceanDark, label: 'Ocean', swatch: '#2EC4B6' },
  forest: { light: forestLight, dark: forestDark, label: 'Forest', swatch: '#5CAA5C' },
  sunset: { light: sunsetLight, dark: sunsetDark, label: 'Sunset', swatch: '#FF6B4A' },
  midnight: { light: midnightLight, dark: midnightDark, label: 'Midnight', swatch: '#8B6CFF' },
  rose: { light: roseLight, dark: roseDark, label: 'Rose', swatch: '#E86AAF' },
  monochrome: { light: monoLight, dark: monoDark, label: 'Mono', swatch: '#999999' },
};

export const themeNames = Object.keys(themes) as ThemeName[];
