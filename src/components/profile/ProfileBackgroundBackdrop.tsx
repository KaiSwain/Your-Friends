import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import type { ColorTokens } from '../../features/theme/themes';
import { useTheme } from '../../features/theme/ThemeContext';
import { CachedRemoteImage } from '../CachedRemoteImage';

interface ProfileBackgroundBackdropProps {
  blurRadius?: number;
  colors: ColorTokens;
  imageUri?: string | null;
  style?: StyleProp<ViewStyle>;
  tintColors?: ColorTokens | null;
}

export function ProfileBackgroundBackdrop({ blurRadius, colors, imageUri, style, tintColors }: ProfileBackgroundBackdropProps) {
  const { backgroundBlur, resolvedMode } = useTheme();

  if (!imageUri) return null;

  const imageOpacity = resolvedMode === 'light' ? 0.68 : 0.58;
  const scrimColor = resolvedMode === 'light' ? colors.canvas + 'B8' : colors.canvas + 'C4';
  const tint = tintColors ? tintColors.accentSoft ?? tintColors.accent : null;
  const tintOpacity = tintColors ? (resolvedMode === 'light' ? 0.035 : 0.14) : 0;

  return (
    <View pointerEvents="none" style={[styles.layer, { backgroundColor: colors.canvas }, style]}>
      <CachedRemoteImage uri={imageUri} style={[styles.image, { opacity: imageOpacity }]} blurRadius={blurRadius ?? backgroundBlur} priority="low" />
      {tint ? <View style={[styles.tint, { backgroundColor: tint, opacity: tintOpacity }]} /> : null}
      <View style={[styles.scrim, { backgroundColor: scrimColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    transform: [{ scale: 1.04 }],
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
  },
});
