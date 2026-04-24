// Themed decorative glyphs — vector replacements for emoji. Unlike <ThemedIcon>
// which is optimized for small UI affordances (back, search, bell), glyphs are
// the warmer, decorative slots (home, profile, flower, heart, sparkle) that
// used to be emojis. They render as SVG so they stay crisp, on-brand, and
// consistent across iOS/Android/Web — no Apple emoji renderer.
//
// Each glyph respects the active theme's personality (icon library + weight /
// stroke) so switching themes also changes the vibe of the decorative glyphs.

import { Feather, Ionicons } from '@expo/vector-icons';
import * as Lucide from 'lucide-react-native';
import * as Phosphor from 'phosphor-react-native';
import React from 'react';

import { useTheme } from '../features/theme/ThemeContext';

// Semantic glyph slots (mirrors EmojiSet keys in personality.ts + extras).
export type GlyphName =
  | 'home'
  | 'profile'
  | 'settings'
  | 'store'
  | 'addFriend'
  | 'camera'
  | 'polaroid'
  | 'sparkle'
  | 'heart'
  | 'flower'
  | 'leaf'
  | 'moon'
  | 'sun'
  | 'fire'
  | 'star'
  | 'bookmark'
  | 'gift'
  | 'coffee';

// Phosphor (primary — widest set, best for Etsy-style decorative vibe).
const phosphorMap: Record<GlyphName, keyof typeof Phosphor> = {
  home: 'House',
  profile: 'UserCircle',
  settings: 'GearSix',
  store: 'Storefront',
  addFriend: 'UserPlus',
  camera: 'Camera',
  polaroid: 'ImageSquare',
  sparkle: 'Sparkle',
  heart: 'Heart',
  flower: 'Flower',
  leaf: 'Leaf',
  moon: 'Moon',
  sun: 'Sun',
  fire: 'Fire',
  star: 'Star',
  bookmark: 'BookmarkSimple',
  gift: 'Gift',
  coffee: 'Coffee',
};

const lucideMap: Record<GlyphName, keyof typeof Lucide> = {
  home: 'Home',
  profile: 'UserCircle',
  settings: 'Settings',
  store: 'Store',
  addFriend: 'UserPlus',
  camera: 'Camera',
  polaroid: 'ImagePlus',
  sparkle: 'Sparkles',
  heart: 'Heart',
  flower: 'Flower2',
  leaf: 'Leaf',
  moon: 'Moon',
  sun: 'Sun',
  fire: 'Flame',
  star: 'Star',
  bookmark: 'Bookmark',
  gift: 'Gift',
  coffee: 'Coffee',
};

const featherMap: Record<GlyphName, React.ComponentProps<typeof Feather>['name']> = {
  home: 'home',
  profile: 'user',
  settings: 'settings',
  store: 'shopping-bag',
  addFriend: 'user-plus',
  camera: 'camera',
  polaroid: 'image',
  sparkle: 'star',
  heart: 'heart',
  flower: 'feather',
  leaf: 'feather',
  moon: 'moon',
  sun: 'sun',
  fire: 'zap',
  star: 'star',
  bookmark: 'bookmark',
  gift: 'gift',
  coffee: 'coffee',
};

const ionMap: Record<GlyphName, React.ComponentProps<typeof Ionicons>['name']> = {
  home: 'home-outline',
  profile: 'person-circle-outline',
  settings: 'settings-outline',
  store: 'storefront-outline',
  addFriend: 'person-add-outline',
  camera: 'camera-outline',
  polaroid: 'image-outline',
  sparkle: 'sparkles-outline',
  heart: 'heart-outline',
  flower: 'flower-outline',
  leaf: 'leaf-outline',
  moon: 'moon-outline',
  sun: 'sunny-outline',
  fire: 'flame-outline',
  star: 'star-outline',
  bookmark: 'bookmark-outline',
  gift: 'gift-outline',
  coffee: 'cafe-outline',
};

export interface ThemedGlyphProps {
  name: GlyphName;
  size?: number;
  color?: string;
}

export function ThemedGlyph({ name, size = 20, color }: ThemedGlyphProps) {
  const { personality, colors } = useTheme();
  const resolvedColor = color ?? colors.accent;

  switch (personality.iconLib) {
    case 'phosphor': {
      const Cmp = Phosphor[phosphorMap[name]] as React.ComponentType<Phosphor.IconProps>;
      return <Cmp size={size} color={resolvedColor} weight={personality.phosphorWeight ?? 'duotone'} />;
    }
    case 'feather':
      return <Feather name={featherMap[name]} size={size} color={resolvedColor} />;
    case 'ionicons':
      return <Ionicons name={ionMap[name]} size={size} color={resolvedColor} />;
    case 'lucide':
    default: {
      const Cmp = Lucide[lucideMap[name]] as React.ComponentType<Lucide.LucideProps>;
      return <Cmp size={size} color={resolvedColor} strokeWidth={personality.strokeWidth ?? 1.75} />;
    }
  }
}
