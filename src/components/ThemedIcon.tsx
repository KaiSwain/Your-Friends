// Theme-aware icon. Pass a semantic icon name and it renders using the icon
// library chosen by the active theme's personality (lucide / phosphor /
// feather / ionicons). Keep the name map below in sync across all libs.

import { Feather, Ionicons } from '@expo/vector-icons';
import * as Lucide from 'lucide-react-native';
import * as Phosphor from 'phosphor-react-native';
import React from 'react';

import { useTheme } from '../features/theme/ThemeContext';

// Semantic icon names supported across all themes.
export type ThemedIconName =
  | 'menu'
  | 'bell'
  | 'search'
  | 'close'
  | 'back'
  | 'forward'
  | 'check'
  | 'lock'
  | 'camera'
  | 'image'
  | 'heart'
  | 'star'
  | 'user'
  | 'users'
  | 'plus'
  | 'trash'
  | 'settings'
  | 'share'
  | 'home'
  | 'clock'
  | 'hourglass';

// Per-library icon name resolution.
const lucideMap: Record<ThemedIconName, keyof typeof Lucide> = {
  menu: 'Menu',
  bell: 'Bell',
  search: 'Search',
  close: 'X',
  back: 'ChevronLeft',
  forward: 'ChevronRight',
  check: 'Check',
  lock: 'Lock',
  camera: 'Camera',
  image: 'Image',
  heart: 'Heart',
  star: 'Star',
  user: 'User',
  users: 'Users',
  plus: 'Plus',
  trash: 'Trash2',
  settings: 'Settings',
  share: 'Share2',
  home: 'Home',
  clock: 'Clock',
  hourglass: 'Hourglass',
};

const phosphorMap: Record<ThemedIconName, keyof typeof Phosphor> = {
  menu: 'List',
  bell: 'Bell',
  search: 'MagnifyingGlass',
  close: 'X',
  back: 'CaretLeft',
  forward: 'CaretRight',
  check: 'Check',
  lock: 'Lock',
  camera: 'Camera',
  image: 'Image',
  heart: 'Heart',
  star: 'Star',
  user: 'User',
  users: 'Users',
  plus: 'Plus',
  trash: 'Trash',
  settings: 'GearSix',
  share: 'ShareNetwork',
  home: 'House',
  clock: 'Clock',
  hourglass: 'Hourglass',
};

// Feather has fewer icons than Lucide; fall back where needed.
const featherMap: Record<ThemedIconName, React.ComponentProps<typeof Feather>['name']> = {
  menu: 'menu',
  bell: 'bell',
  search: 'search',
  close: 'x',
  back: 'chevron-left',
  forward: 'chevron-right',
  check: 'check',
  lock: 'lock',
  camera: 'camera',
  image: 'image',
  heart: 'heart',
  star: 'star',
  user: 'user',
  users: 'users',
  plus: 'plus',
  trash: 'trash-2',
  settings: 'settings',
  share: 'share-2',
  home: 'home',
  clock: 'clock',
  hourglass: 'clock', // feather has no hourglass
};

const ionMap: Record<ThemedIconName, React.ComponentProps<typeof Ionicons>['name']> = {
  menu: 'menu-outline',
  bell: 'notifications-outline',
  search: 'search-outline',
  close: 'close',
  back: 'chevron-back',
  forward: 'chevron-forward',
  check: 'checkmark',
  lock: 'lock-closed',
  camera: 'camera-outline',
  image: 'images-outline',
  heart: 'heart-outline',
  star: 'star-outline',
  user: 'person-outline',
  users: 'people-outline',
  plus: 'add',
  trash: 'trash-outline',
  settings: 'settings-outline',
  share: 'share-outline',
  home: 'home-outline',
  clock: 'time-outline',
  hourglass: 'hourglass-outline',
};

export interface ThemedIconProps {
  name: ThemedIconName;
  size?: number;
  color?: string;
}

export function ThemedIcon({ name, size = 24, color }: ThemedIconProps) {
  const { personality, colors } = useTheme();
  const resolvedColor = color ?? colors.ink;

  switch (personality.iconLib) {
    case 'phosphor': {
      const Cmp = Phosphor[phosphorMap[name]] as React.ComponentType<Phosphor.IconProps>;
      return <Cmp size={size} color={resolvedColor} weight={personality.phosphorWeight ?? 'regular'} />;
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
