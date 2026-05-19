import { Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import type { ColorTokens } from '../../features/theme/themes';
import { useTheme } from '../../features/theme/ThemeContext';

interface ProfileBackgroundBackdropProps {
  blurRadius?: number;
  colors: ColorTokens;
  imageUri?: string | null;
  style?: StyleProp<ViewStyle>;
}

export function ProfileBackgroundBackdrop({ blurRadius, colors, imageUri, style }: ProfileBackgroundBackdropProps) {
  const { backgroundBlur } = useTheme();

  if (!imageUri) return null;

  return (
    <View pointerEvents="none" style={[styles.layer, { backgroundColor: colors.canvas }, style]}>
      <Image source={{ uri: imageUri }} style={styles.image} blurRadius={blurRadius ?? backgroundBlur} />
      <View style={[styles.scrim, { backgroundColor: colors.canvas + '99' }]} />
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
});
