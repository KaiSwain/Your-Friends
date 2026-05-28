import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  CUSTOM_THEME_HUE_PRESETS,
  customThemeHueToHex,
  type CustomThemeSettings,
} from '../features/theme/customTheme';
import type { ColorTokens } from '../features/theme/themes';
import { protectTextFromFontClipping } from '../theme/fontProtection';
import type { FontSet } from '../theme/typography';
import { radius, spacing } from '../theme/tokens';

interface CustomThemeVisualizerProps {
  colors: ColorTokens;
  fonts: FontSet;
  onSelectAccentHue: (hue: number) => void;
  onSelectBackgroundHue: (hue: number) => void;
  previewColors: ColorTokens;
  settings: CustomThemeSettings;
}

export function CustomThemeVisualizer({
  colors,
  fonts,
  onSelectAccentHue,
  onSelectBackgroundHue,
  previewColors,
  settings,
}: CustomThemeVisualizerProps) {
  const styles = makeStyles(colors, fonts);

  return (
    <View style={styles.container}>
      <View style={styles.previewGrid}>
        <PaletteChip label="Canvas" color={previewColors.canvas} textColor={previewColors.ink} styles={styles} />
        <PaletteChip label="Card" color={previewColors.paper} textColor={previewColors.ink} styles={styles} />
        <PaletteChip label="Accent" color={previewColors.accent} textColor={previewColors.white} styles={styles} />
        <PaletteChip label="Soft" color={previewColors.accentAlt ?? previewColors.accentSoft} textColor={previewColors.ink} styles={styles} />
      </View>

      <HuePickerRow
        activeHue={settings.accentHue}
        colors={colors}
        label="Accent picker"
        onSelectHue={onSelectAccentHue}
        swatchLightness={54}
        swatchSaturation={76}
        styles={styles}
      />
      <HuePickerRow
        activeHue={settings.backgroundHue}
        colors={colors}
        label="Background picker"
        onSelectHue={onSelectBackgroundHue}
        swatchLightness={78}
        swatchSaturation={44}
        styles={styles}
      />
    </View>
  );
}

function PaletteChip({
  color,
  label,
  styles,
  textColor,
}: {
  color: string;
  label: string;
  styles: ReturnType<typeof makeStyles>;
  textColor: string;
}) {
  return (
    <View style={[styles.paletteChip, { backgroundColor: color }]}>
      <Text style={[styles.paletteChipLabel, { color: textColor }]}>{label}</Text>
      <Text style={[styles.paletteChipValue, { color: textColor }]}>{color.toUpperCase()}</Text>
    </View>
  );
}

function HuePickerRow({
  activeHue,
  colors,
  label,
  onSelectHue,
  styles,
  swatchLightness,
  swatchSaturation,
}: {
  activeHue: number;
  colors: ColorTokens;
  label: string;
  onSelectHue: (hue: number) => void;
  styles: ReturnType<typeof makeStyles>;
  swatchLightness: number;
  swatchSaturation: number;
}) {
  return (
    <View style={styles.huePickerBlock}>
      <Text style={styles.huePickerLabel}>{label}</Text>
      <View style={styles.hueGrid}>
        {CUSTOM_THEME_HUE_PRESETS.map((preset) => {
          const active = Math.abs(preset.hue - activeHue) <= 8;
          const swatchColor = customThemeHueToHex(preset.hue, swatchSaturation, swatchLightness);
          return (
            <Pressable
              key={`${label}-${preset.hue}`}
              onPress={() => onSelectHue(preset.hue)}
              style={[
                styles.hueSwatch,
                { backgroundColor: swatchColor, borderColor: active ? colors.ink : colors.white },
                active && styles.hueSwatchActive,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${preset.label}`}
            >
              {active ? <Ionicons name="checkmark" size={13} color={colors.ink} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    container: {
      gap: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
      padding: spacing.md,
    },
    previewGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    paletteChip: {
      flexGrow: 1,
      minWidth: '46%',
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(0,0,0,0.12)',
      gap: 2,
    },
    paletteChipLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
    },
    paletteChipValue: {
      fontFamily: fonts.bodyMedium,
      fontSize: 10,
      opacity: 0.76,
      ...protectTextFromFontClipping(fonts.bodyMedium, 10),
    },
    huePickerBlock: {
      gap: spacing.xs,
    },
    huePickerLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: colors.inkSoft,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    hueGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    hueSwatch: {
      width: 32,
      height: 32,
      borderRadius: 16,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 5,
      elevation: 2,
    },
    hueSwatchActive: {
      transform: [{ scale: 1.08 }],
    },
  });
