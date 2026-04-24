import Slider from '@react-native-community/slider';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import {
  formatWallPostTextSizeLabel,
  getWallPostTextFontFamily,
  maxWallPostTextSize,
  minWallPostTextSize,
  resolveWallPostTextColor,
  resolveWallPostTextStyle,
  wallPostTextColorOptions,
  wallPostTextEffectOptions,
  wallPostTextFontOptions,
} from '../lib/wallPostTextStyle';
import { radius, spacing } from '../theme/tokens';
import type { WallPostTextColor, WallPostTextEffect, WallPostTextFont, WallPostTextSize } from '../types/domain';
import { MemoryStyledText } from './MemoryStyledText';

interface MemoryTextStylePickerProps {
  selectedFont: WallPostTextFont;
  selectedSize: WallPostTextSize;
  selectedEffect: WallPostTextEffect;
  selectedColor: WallPostTextColor;
  onSelectFont: (font: WallPostTextFont) => void;
  onSelectSize: (size: WallPostTextSize) => void;
  onSelectEffect: (effect: WallPostTextEffect) => void;
  onSelectColor: (color: WallPostTextColor) => void;
}

export function MemoryTextStylePicker({
  selectedFont,
  selectedSize,
  selectedEffect,
  selectedColor,
  onSelectFont,
  onSelectSize,
  onSelectEffect,
  onSelectColor,
}: MemoryTextStylePickerProps) {
  const { colors, fonts } = useTheme();
  const previewTypography = resolveWallPostTextStyle(fonts, selectedFont, Math.max(16, Math.min(selectedSize, 20)));
  const previewColor = resolveWallPostTextColor(selectedColor, colors);

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionLabel, { color: colors.inkMuted, fontFamily: fonts.bodyBold }]}>Note Style</Text>

      <View style={styles.group}>
        <Text style={[styles.groupLabel, { color: colors.inkSoft, fontFamily: fonts.bodyMedium }]}>Font</Text>
        <View style={styles.row}>
          {wallPostTextFontOptions.map((option) => {
            const selected = option.key === selectedFont;
            return (
              <Pressable
                key={option.key}
                onPress={() => onSelectFont(option.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? `${colors.accent}18` : colors.paper,
                    borderColor: selected ? colors.accent : colors.line,
                  },
                ]}
              >
                <Text
                  style={{
                    fontFamily: getWallPostTextFontFamily(fonts, option.key),
                    fontSize: 14,
                    color: selected ? colors.accent : colors.ink,
                  }}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.group}>
        <Text style={[styles.groupLabel, { color: colors.inkSoft, fontFamily: fonts.bodyMedium }]}>Color</Text>
        <View style={styles.row}>
          {wallPostTextColorOptions.map((option) => {
            const selected = option.key === selectedColor;
            const swatchColor = resolveWallPostTextColor(option.key, colors);
            return (
              <Pressable
                key={option.key}
                onPress={() => onSelectColor(option.key)}
                style={[
                  styles.colorChip,
                  {
                    backgroundColor: selected ? `${colors.accent}18` : colors.paper,
                    borderColor: selected ? colors.accent : colors.line,
                  },
                ]}
              >
                <View style={[styles.colorSwatch, { backgroundColor: swatchColor }]} />
                <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 13, color: selected ? colors.accent : colors.ink }}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.group}>
        <View style={styles.sliderHeader}>
          <Text style={[styles.groupLabel, { color: colors.inkSoft, fontFamily: fonts.bodyMedium }]}>Size</Text>
          <Text style={[styles.sizeValue, { color: colors.accent, fontFamily: fonts.bodyBold }]}>{formatWallPostTextSizeLabel(selectedSize)}</Text>
        </View>
        <Slider
          value={selectedSize}
          minimumValue={minWallPostTextSize}
          maximumValue={maxWallPostTextSize}
          step={1}
          minimumTrackTintColor={colors.accent}
          maximumTrackTintColor={colors.line}
          thumbTintColor={colors.accent}
          onValueChange={onSelectSize}
        />
        <View style={styles.sliderLegend}>
          <Text style={[styles.legendText, { color: colors.inkMuted, fontFamily: fonts.body }]}>Subtle</Text>
          <Text style={[styles.legendText, { color: colors.inkMuted, fontFamily: fonts.body }]}>Poster</Text>
        </View>
      </View>

      <View style={styles.group}>
        <Text style={[styles.groupLabel, { color: colors.inkSoft, fontFamily: fonts.bodyMedium }]}>Effect</Text>
        <View style={styles.row}>
          {wallPostTextEffectOptions.map((option) => {
            const selected = option.key === selectedEffect;
            return (
              <Pressable
                key={option.key}
                onPress={() => onSelectEffect(option.key)}
                style={[
                  styles.effectChip,
                  {
                    backgroundColor: selected ? `${colors.accent}18` : colors.paper,
                    borderColor: selected ? colors.accent : colors.line,
                  },
                ]}
              >
                <MemoryStyledText
                  text={option.label}
                  effect={option.key}
                  color={previewColor}
                  accentColor={previewColor}
                  paperColor={colors.paper}
                  style={[styles.effectText, previewTypography, { fontSize: 14, lineHeight: 18 }]}
                  numberOfLines={1}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  group: {
    gap: spacing.xs,
  },
  groupLabel: {
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorChip: {
    minHeight: 42,
    minWidth: 88,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  colorSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sizeValue: {
    fontSize: 13,
  },
  sliderLegend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -spacing.xs,
  },
  legendText: {
    fontSize: 11,
  },
  effectChip: {
    minHeight: 44,
    minWidth: 96,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  effectText: {
    textAlign: 'center',
  },
});