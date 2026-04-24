// Subtle decorative glyph corners for cards / polaroids / hero surfaces.
// Two themed glyphs placed at opposing corners with gentle rotation and low
// opacity — a quiet "girls like aesthetics" touch that inherits the active
// theme's icon library + weight so it stays on-brand everywhere.

import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { ThemedGlyph, GlyphName } from './ThemedGlyph';

export interface CardFlourishProps {
  // Defaults: sparkle top-left, flower bottom-right.
  topLeft?: GlyphName | null;
  bottomRight?: GlyphName | null;
  topRight?: GlyphName | null;
  bottomLeft?: GlyphName | null;
  size?: number;
  color?: string;
  opacity?: number;
  inset?: number;
}

export function CardFlourish({
  topLeft = 'sparkle',
  bottomRight = 'flower',
  topRight = null,
  bottomLeft = null,
  size = 16,
  color,
  opacity = 0.35,
  inset = 8,
}: CardFlourishProps) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {topLeft && (
        <View style={[styles.corner, { top: inset, left: inset, opacity, transform: [{ rotate: '-14deg' }] } as ViewStyle]}>
          <ThemedGlyph name={topLeft} size={size} color={color} />
        </View>
      )}
      {topRight && (
        <View style={[styles.corner, { top: inset, right: inset, opacity, transform: [{ rotate: '12deg' }] } as ViewStyle]}>
          <ThemedGlyph name={topRight} size={size} color={color} />
        </View>
      )}
      {bottomLeft && (
        <View style={[styles.corner, { bottom: inset, left: inset, opacity, transform: [{ rotate: '-8deg' }] } as ViewStyle]}>
          <ThemedGlyph name={bottomLeft} size={size} color={color} />
        </View>
      )}
      {bottomRight && (
        <View style={[styles.corner, { bottom: inset, right: inset, opacity, transform: [{ rotate: '16deg' }] } as ViewStyle]}>
          <ThemedGlyph name={bottomRight} size={size} color={color} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  corner: { position: 'absolute' },
});
