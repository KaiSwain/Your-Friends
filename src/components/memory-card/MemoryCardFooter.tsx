import { ReactNode, useMemo } from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from 'react-native';

import { useTheme } from '../../features/theme/ThemeContext';
import { MEMORY_CARD_INK, MEMORY_CARD_INK_SOFT } from './constants';

interface MemoryCardFooterProps {
  author?: string | null;
  body?: ReactNode;
  bodyText?: string | null;
  date?: string | null;
  footerStyle?: StyleProp<ViewStyle>;
  metaStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  title?: string | null;
  titleStyle?: StyleProp<TextStyle>;
}

export function MemoryCardFooter({
  author,
  body,
  bodyText,
  date,
  footerStyle,
  metaStyle,
  style,
  title,
  titleStyle,
}: MemoryCardFooterProps) {
  const { fonts } = useTheme();
  const styles = useMemo(() => makeStyles(fonts), [fonts]);

  return (
    <View style={[styles.footer, footerStyle, style]}>
      {date ? <Text style={[styles.meta, metaStyle]}>{date}</Text> : null}
      {title ? (
        <Text numberOfLines={1} style={[styles.title, titleStyle]}>
          {title}
        </Text>
      ) : null}
      {body ?? (bodyText ? <Text style={styles.body}>{bodyText}</Text> : null)}
      {author ? <Text style={[styles.meta, styles.author, metaStyle]}>by {author}</Text> : null}
    </View>
  );
}

const makeStyles = (fonts: { body: string; bodyBold: string; heading: string }) =>
  StyleSheet.create({
    footer: {
      gap: 4,
      paddingTop: 10,
    },
    meta: {
      color: MEMORY_CARD_INK_SOFT,
      fontFamily: fonts.bodyBold,
      fontSize: 10,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    title: {
      color: MEMORY_CARD_INK,
      fontFamily: fonts.heading,
      fontSize: 20,
      lineHeight: 28,
      includeFontPadding: false,
    },
    body: {
      color: MEMORY_CARD_INK,
      fontFamily: fonts.body,
      fontSize: 13,
      lineHeight: 18,
    },
    author: {
      textAlign: 'right',
    },
  });
