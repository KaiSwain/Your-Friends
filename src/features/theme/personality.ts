// Per-theme "personality": icon library + decorative emojis.
// Pairs with ColorTokens (themes.ts) and FontSet (typography.ts) so changing
// a theme flips colors, typography, icon style, AND emojis together.

export type IconLib = 'lucide' | 'phosphor' | 'feather' | 'ionicons';
export type PhosphorWeight = 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';

export interface EmojiSet {
  home: string;
  profile: string;
  settings: string;
  store: string;
  addFriend: string;
  camera: string;
  polaroid: string;
  sparkle: string;
  heart: string;
  flower: string;
}

export interface ThemePersonality {
  iconLib: IconLib;
  // Used when iconLib === 'phosphor'. Ignored otherwise.
  phosphorWeight?: PhosphorWeight;
  // Used by Lucide/Feather for stroke thickness.
  strokeWidth?: number;
  emojis: EmojiSet;
}

// ── Emoji sets (mix & match across themes) ──────────────────────────
const classicEmoji: EmojiSet = {
  home: '🏠',
  profile: '👤',
  settings: '⚙️',
  store: '🛍️',
  addFriend: '➕',
  camera: '📸',
  polaroid: '📷',
  sparkle: '✨',
  heart: '❤️',
  flower: '🌸',
};

const neonEmoji: EmojiSet = {
  home: '⚡️',
  profile: '🦾',
  settings: '🛠️',
  store: '💎',
  addFriend: '🔗',
  camera: '🎥',
  polaroid: '🖼️',
  sparkle: '💠',
  heart: '💜',
  flower: '🪩',
};

const synthwaveEmoji: EmojiSet = {
  home: '🌆',
  profile: '🕶️',
  settings: '🎛️',
  store: '💿',
  addFriend: '📡',
  camera: '📼',
  polaroid: '🎞️',
  sparkle: '🌠',
  heart: '💗',
  flower: '🌺',
};

const natureEmoji: EmojiSet = {
  home: '🏡',
  profile: '🌿',
  settings: '🧭',
  store: '🪴',
  addFriend: '🌱',
  camera: '📸',
  polaroid: '🖼️',
  sparkle: '☘️',
  heart: '💚',
  flower: '🌸',
};

const playfulEmoji: EmojiSet = {
  home: '🍭',
  profile: '🧁',
  settings: '🎀',
  store: '🎁',
  addFriend: '💌',
  camera: '📸',
  polaroid: '💖',
  sparkle: '✨',
  heart: '💕',
  flower: '🌷',
};

const fireEmoji: EmojiSet = {
  home: '🔥',
  profile: '😎',
  settings: '⚙️',
  store: '💰',
  addFriend: '🤝',
  camera: '📸',
  polaroid: '🎆',
  sparkle: '💥',
  heart: '❤️‍🔥',
  flower: '🌋',
};

const iceEmoji: EmojiSet = {
  home: '🏔️',
  profile: '🧊',
  settings: '❄️',
  store: '💎',
  addFriend: '🫂',
  camera: '📸',
  polaroid: '🖼️',
  sparkle: '✨',
  heart: '💙',
  flower: '🪷',
};

const vintageEmoji: EmojiSet = {
  home: '🏛️',
  profile: '🎩',
  settings: '📜',
  store: '📯',
  addFriend: '✉️',
  camera: '📷',
  polaroid: '🗞️',
  sparkle: '🕯️',
  heart: '🤎',
  flower: '🥀',
};

const grapeEmoji: EmojiSet = {
  home: '🍇',
  profile: '🔮',
  settings: '🪄',
  store: '👑',
  addFriend: '🧿',
  camera: '📸',
  polaroid: '🖼️',
  sparkle: '🌟',
  heart: '💜',
  flower: '🪻',
};

const cocoaEmoji: EmojiSet = {
  home: '☕️',
  profile: '🍪',
  settings: '🧈',
  store: '🍫',
  addFriend: '🤗',
  camera: '📸',
  polaroid: '🖼️',
  sparkle: '✨',
  heart: '🤎',
  flower: '🌻',
};

const noirEmoji: EmojiSet = {
  home: '⬛️',
  profile: '🎭',
  settings: '🎬',
  store: '🖤',
  addFriend: '🕴️',
  camera: '📽️',
  polaroid: '🎞️',
  sparkle: '🤍',
  heart: '🖤',
  flower: '🏴',
};

const sunsetEmoji: EmojiSet = {
  home: '🌅',
  profile: '🏄',
  settings: '🧴',
  store: '🛒',
  addFriend: '🌴',
  camera: '📸',
  polaroid: '🖼️',
  sparkle: '🌞',
  heart: '🧡',
  flower: '🌺',
};

const peachEmoji: EmojiSet = {
  home: '🍑',
  profile: '🌼',
  settings: '🎀',
  store: '🍰',
  addFriend: '💐',
  camera: '📸',
  polaroid: '🖼️',
  sparkle: '🌸',
  heart: '💗',
  flower: '🌷',
};

// ── Per-theme personality ───────────────────────────────────────────
// Keep keys in sync with `ThemeName` in themes.ts.
export const personalities: Record<string, ThemePersonality> = {
  default: { iconLib: 'lucide', strokeWidth: 1.75, emojis: classicEmoji },
  neon: { iconLib: 'phosphor', phosphorWeight: 'bold', emojis: neonEmoji },
  synthwave: { iconLib: 'phosphor', phosphorWeight: 'duotone', emojis: synthwaveEmoji },
  matcha: { iconLib: 'feather', strokeWidth: 1.75, emojis: natureEmoji },
  bubblegum: { iconLib: 'phosphor', phosphorWeight: 'fill', emojis: playfulEmoji },
  lava: { iconLib: 'phosphor', phosphorWeight: 'fill', emojis: fireEmoji },
  arctic: { iconLib: 'lucide', strokeWidth: 1.25, emojis: iceEmoji },
  vintage: { iconLib: 'ionicons', emojis: vintageEmoji },
  grape: { iconLib: 'phosphor', phosphorWeight: 'duotone', emojis: grapeEmoji },
  cocoa: { iconLib: 'ionicons', emojis: cocoaEmoji },
  mint: { iconLib: 'phosphor', phosphorWeight: 'regular', emojis: natureEmoji },
  noir: { iconLib: 'feather', strokeWidth: 2, emojis: noirEmoji },
  sunset: { iconLib: 'phosphor', phosphorWeight: 'duotone', emojis: sunsetEmoji },
  forest: { iconLib: 'feather', strokeWidth: 1.75, emojis: natureEmoji },
  peach: { iconLib: 'phosphor', phosphorWeight: 'light', emojis: peachEmoji },
};

export function getPersonality(themeName: string): ThemePersonality {
  return personalities[themeName] ?? personalities.default;
}
