import { StyleSheet, View } from 'react-native';

interface PolaroidIconProps {
  color: string;
  size?: number;
}

export function PolaroidIcon({ color, size = 24 }: PolaroidIconProps) {
  const frameWidth = size;
  const frameHeight = size * 1.14;
  const photoInset = Math.max(2, size * 0.12);
  const photoHeight = size * 0.58;

  return (
    <View
      style={[
        styles.frame,
        {
          width: frameWidth,
          height: frameHeight,
          borderColor: color,
          borderRadius: size * 0.11,
          padding: photoInset,
        },
      ]}
    >
      <View style={[styles.photo, { height: photoHeight, borderColor: color }]} />
      <View style={styles.captionArea}>
        <View style={[styles.captionLine, { backgroundColor: color, width: size * 0.42 }]} />
        <View style={[styles.captionLine, { backgroundColor: color, width: size * 0.28, opacity: 0.68 }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  photo: {
    alignSelf: 'stretch',
    borderWidth: 1.8,
    borderRadius: 2,
  },
  captionArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  captionLine: {
    height: 2,
    borderRadius: 999,
  },
});
