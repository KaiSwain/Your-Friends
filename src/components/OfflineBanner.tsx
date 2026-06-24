import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../features/theme/ThemeContext';
import type { FontSet } from '../theme/typography';
import { radius, spacing } from '../theme/tokens';

// Thin, non-interactive banner that appears at the top whenever the device
// loses connectivity. Reassures the user that the app still works and that any
// changes they make will sync once they're back online.
export function OfflineBanner() {
  const { fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false || state.isInternetReachable === false);
    });
    return () => unsubscribe();
  }, []);

  const styles = useMemo(() => makeStyles(fonts), [fonts]);

  if (!offline) return null;

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top - 8, 2) }]} pointerEvents="none">
      <View style={styles.pill}>
        <Ionicons name="cloud-offline-outline" size={14} color="#FFFFFF" />
        <Text style={styles.text}>You&apos;re offline — changes will sync later</Text>
      </View>
    </View>
  );
}

const makeStyles = (fonts: FontSet) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      zIndex: 1000,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: 'rgba(18,18,18,0.92)',
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    text: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: '#FFFFFF',
    },
  });
