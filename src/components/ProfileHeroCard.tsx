import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { fonts } from '../theme/typography';
import { radius, shadow, spacing } from '../theme/tokens';

interface ProfileHeroCardProps {
  accentColor: string;
  name: string;
  subtitle: string;
}

export function ProfileHeroCard({ accentColor, name, subtitle }: ProfileHeroCardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.stack}>
        <View style={[styles.sheet, styles.sheetBack]} />
        <View style={styles.card}>
          <View style={styles.photoFrame}>
            <View style={[styles.photoSurface, { backgroundColor: accentColor }]}>
              <Text style={styles.initials}>{getInitials(name)}</Text>
            </View>
          </View>
        </View>
      </View>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

function getInitials(value: string) {
  return value.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

const CARD_SIZE = 150;

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    container: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md },
    stack: { width: CARD_SIZE + 20, height: CARD_SIZE + 20 },
    sheet: {
      position: 'absolute',
      width: CARD_SIZE,
      height: CARD_SIZE,
      borderRadius: radius.sm,
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
      borderWidth: 1,
      borderColor: colors.line,
      left: 10,
      top: 10,
    },
    sheetBack: { transform: [{ rotate: '6deg' }] },
    card: {
      position: 'absolute',
      left: 10,
      top: 10,
      width: CARD_SIZE,
      height: CARD_SIZE,
      borderRadius: radius.sm,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.line,
      padding: 8,
      transform: [{ rotate: '-3deg' }],
      ...shadow.card,
    },
    photoFrame: { flex: 1, borderRadius: 4, overflow: 'hidden' },
    photoSurface: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initials: { fontFamily: fonts.heading, fontSize: 42, color: colors.white },
    name: {
      fontFamily: fonts.heading,
      fontSize: 28,
      color: colors.ink,
      textAlign: 'center',
    },
    subtitle: {
      fontFamily: fonts.body,
      fontSize: 14,
      lineHeight: 20,
      color: colors.inkSoft,
      textAlign: 'center',
    },
  });
