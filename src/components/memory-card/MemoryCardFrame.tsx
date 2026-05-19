import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import {
  MEMORY_CARD_BORDER,
  MEMORY_CARD_FRAME,
  MEMORY_CARD_PHOTO_BORDER,
  MEMORY_CARD_TAPE,
  MEMORY_CARD_TAPE_STRONG,
} from './constants';

interface MemoryCardFrameProps {
  children?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
  footerStyle?: StyleProp<ViewStyle>;
  photo?: ReactNode;
  photoContainerStyle?: StyleProp<ViewStyle>;
  showTape?: boolean;
  style?: StyleProp<ViewStyle>;
  tapeStyle?: StyleProp<ViewStyle>;
}

export function MemoryCardFrame({
  children,
  contentStyle,
  footer,
  footerStyle,
  photo,
  photoContainerStyle,
  showTape = false,
  style,
  tapeStyle,
}: MemoryCardFrameProps) {
  return (
    <View style={[styles.card, style]}>
      {showTape ? <View pointerEvents="none" style={[styles.tape, tapeStyle]} /> : null}
      {photo ? <View style={[styles.photoContainer, photoContainerStyle]}>{photo}</View> : null}
      {footer ? <View style={footerStyle}>{footer}</View> : null}
      {children ? (contentStyle ? <View style={contentStyle}>{children}</View> : children) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: MEMORY_CARD_FRAME,
    borderColor: MEMORY_CARD_BORDER,
    borderRadius: 18,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.13,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  photoContainer: {
    backgroundColor: '#16120f',
    borderColor: MEMORY_CARD_PHOTO_BORDER,
    borderWidth: 1,
    overflow: 'hidden',
  },
  tape: {
    position: 'absolute',
    top: -10,
    left: '50%',
    width: 56,
    height: 22,
    marginLeft: -28,
    borderRadius: 6,
    backgroundColor: MEMORY_CARD_TAPE,
    borderWidth: 1,
    borderColor: MEMORY_CARD_TAPE_STRONG,
    transform: [{ rotate: '-4deg' }],
    zIndex: 10,
  },
});

export const memoryCardFrameStyles = styles;
