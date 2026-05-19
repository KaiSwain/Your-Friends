import type { TextStyle } from 'react-native';

const tallFontNames = ['PermanentMarker'];

export function fontNeedsCropProtection(fontFamily: string | null | undefined): boolean {
  if (!fontFamily) return false;
  return tallFontNames.some((name) => fontFamily.includes(name));
}

export function protectTextFromFontClipping(
  fontFamily: string | null | undefined,
  fontSize: number,
  lineHeightMultiplier = 1.42,
): Pick<TextStyle, 'includeFontPadding' | 'lineHeight' | 'paddingTop' | 'paddingBottom'> {
  if (!fontNeedsCropProtection(fontFamily)) {
    return {};
  }

  return {
    includeFontPadding: true,
    lineHeight: Math.ceil(fontSize * lineHeightMultiplier),
    paddingTop: Math.ceil(fontSize * 0.12),
    paddingBottom: Math.ceil(fontSize * 0.08),
  };
}
