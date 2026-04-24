import { useMemo } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View } from 'react-native';

import { resolveWallPostTextEffectStyles } from '../lib/wallPostTextStyle';
import type { WallPostTextEffect } from '../types/domain';

interface MemoryStyledTextProps {
  text: string;
  effect?: WallPostTextEffect | null;
  color: string;
  accentColor: string;
  paperColor: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

export function MemoryStyledText({
  text,
  effect,
  color,
  accentColor,
  paperColor,
  style,
  numberOfLines,
}: MemoryStyledTextProps) {
  const effectStyles = useMemo(
    () => resolveWallPostTextEffectStyles(effect, { accent: accentColor, paper: paperColor, ink: color }),
    [accentColor, color, effect, paperColor],
  );

  return (
    <View style={styles.wrapper}>
      {effectStyles.layers.map((layer, index) => (
        <Text key={index} numberOfLines={numberOfLines} style={[styles.layer, style, { color }, layer]}>
          {text}
        </Text>
      ))}
      <Text numberOfLines={numberOfLines} style={[style, { color }, effectStyles.front]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'stretch',
    position: 'relative',
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
});