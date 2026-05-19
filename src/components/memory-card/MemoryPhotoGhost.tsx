import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

interface MemoryPhotoGhostProps {
  style?: StyleProp<ViewStyle>;
}

export function MemoryPhotoGhost({ style }: MemoryPhotoGhostProps) {
  return (
    <View style={[styles.surface, style]}>
      <View style={styles.bloom} />
      <View style={styles.band} />
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#d9d2c3',
  },
  bloom: {
    position: 'absolute',
    top: '18%',
    left: '18%',
    width: '58%',
    height: '58%',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  band: {
    position: 'absolute',
    left: '-10%',
    right: '-10%',
    top: '42%',
    height: '18%',
    transform: [{ rotate: '-10deg' }],
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});
