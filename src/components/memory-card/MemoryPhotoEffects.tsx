import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { getFilterByKey } from '../../lib/polaroidFilters';
import { MEMORY_CARD_SHEEN_COLORS, MEMORY_CARD_WARM_TINT } from './constants';

interface MemoryPhotoEffectsProps {
  children?: ReactNode;
  dateStamp?: string | null;
  dateStampStyle?: StyleProp<TextStyle>;
  developingDateOpacity?: number;
  filterKey?: string | null;
  showShakeBoost?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function MemoryPhotoEffects({
  children,
  dateStamp,
  dateStampStyle,
  developingDateOpacity,
  filterKey,
  showShakeBoost = false,
  style,
}: MemoryPhotoEffectsProps) {
  const filter = filterKey ? getFilterByKey(filterKey) : null;

  return (
    <View pointerEvents="none" style={[styles.layer, style]}>
      <View style={styles.warmBaseTint} />
      {filter?.overlay ? <View style={[styles.filterOverlay, { backgroundColor: filter.overlay }]} /> : null}
      {filter?.overlay2 ? <View style={[styles.filterOverlay, { backgroundColor: filter.overlay2 }]} /> : null}
      {children}
      <LinearGradient
        colors={MEMORY_CARD_SHEEN_COLORS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.photoSheen}
      />
      <View style={styles.insetShadowTop} />
      <View style={styles.insetShadowLeft} />
      {showShakeBoost ? <View style={styles.shakeBoostOverlay} /> : null}
      {dateStamp ? (
        <Text style={[dateStampStyle, developingDateOpacity !== undefined && { opacity: developingDateOpacity }]}>
          {dateStamp}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 7,
  },
  warmBaseTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: MEMORY_CARD_WARM_TINT,
  },
  filterOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  photoSheen: {
    ...StyleSheet.absoluteFillObject,
  },
  insetShadowTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  insetShadowLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 4,
    backgroundColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 3, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  shakeBoostOverlay: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,220,0.45)',
  },
});
