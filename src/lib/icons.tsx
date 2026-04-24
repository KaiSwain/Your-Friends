// Central icon hub. Re-exports icons from all installed libraries so the rest of
// the app can import from one place and easily swap styles.
//
// Usage examples:
//   import { Icon } from '../lib/icons';
//   <Icon.Heart size={24} color={colors.accent} />        // Lucide (default)
//   <Icon.HeartFill size={24} color={colors.accent} />    // Phosphor filled
//   <Icon.Ion name="camera" size={24} color={colors.ink} />     // Ionicons (legacy)
//   <Icon.Material name="account-heart" size={24} color={colors.ink} />
//
// Available sources:
//  - Lucide      → modern line icons (primary set)
//  - Phosphor    → multi-weight icons (thin / light / regular / bold / fill / duotone)
//  - @expo/vector-icons → Ionicons, MaterialCommunityIcons, Feather, FontAwesome6, etc.
//
// Browse icon names:
//  - Lucide:    https://lucide.dev/icons/
//  - Phosphor:  https://phosphoricons.com/
//  - Expo sets: https://icons.expo.fyi/
//
// Custom SVGs: drop a .svg file into assets/icons/ and import it directly:
//   import Sparkle from '../../assets/icons/sparkle.svg';
//   <Sparkle width={24} height={24} fill={colors.accent} />

import {
  Feather,
  FontAwesome6,
  Ionicons,
  MaterialCommunityIcons,
} from '@expo/vector-icons';
import {
  Bell as LBell,
  Camera as LCamera,
  Heart as LHeart,
  Home as LHome,
  Image as LImage,
  Menu as LMenu,
  MessageCircle as LMessage,
  Plus as LPlus,
  Search as LSearch,
  Settings as LSettings,
  Share2 as LShare,
  Star as LStar,
  Trash2 as LTrash,
  User as LUser,
  Users as LUsers,
  X as LClose,
} from 'lucide-react-native';
import {
  Bell as PBell,
  Camera as PCamera,
  Heart as PHeart,
  Star as PStar,
} from 'phosphor-react-native';

// Primary line-icon set (Lucide) — default for new code.
export const Icon = {
  Bell: LBell,
  Camera: LCamera,
  Close: LClose,
  Heart: LHeart,
  Home: LHome,
  Image: LImage,
  Menu: LMenu,
  Message: LMessage,
  Plus: LPlus,
  Search: LSearch,
  Settings: LSettings,
  Share: LShare,
  Star: LStar,
  Trash: LTrash,
  User: LUser,
  Users: LUsers,

  // Filled / weighted variants via Phosphor (pass `weight="fill"` or `"bold"`).
  HeartFill: (props: React.ComponentProps<typeof PHeart>) => (
    <PHeart weight="fill" {...props} />
  ),
  StarFill: (props: React.ComponentProps<typeof PStar>) => (
    <PStar weight="fill" {...props} />
  ),
  BellFill: (props: React.ComponentProps<typeof PBell>) => (
    <PBell weight="fill" {...props} />
  ),
  CameraDuotone: (props: React.ComponentProps<typeof PCamera>) => (
    <PCamera weight="duotone" {...props} />
  ),

  // Raw access to each family when you need a specific icon not re-exported above.
  Ion: Ionicons,
  Material: MaterialCommunityIcons,
  Feather,
  FontAwesome: FontAwesome6,
};

// Convenience re-exports so consumers can `import { Lucide, Phosphor } from '../lib/icons'`
// and pull any icon name without touching this file.
export * as Lucide from 'lucide-react-native';
export * as Phosphor from 'phosphor-react-native';
