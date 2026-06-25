import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { radius, spacing } from '../theme/tokens';
import type { FontSet } from '../theme/typography';
import { checkForAppUpdate } from '../lib/appUpdateCheck';

// When true, the update screen cannot be dismissed — users must update to continue.
// Set to false to make it a recommendation (adds a "Maybe later" escape).
const REQUIRE_UPDATE = true;
// Flip to true on a dev build to preview the screen without an actual newer store version.
const FORCE_SHOW_FOR_TESTING = false;
// Don't re-hit the network more than once per this window.
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

export function UpdateGate() {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [storeUrl, setStoreUrl] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const lastCheckedAt = useRef(0);

  const runCheck = useCallback(async () => {
    if (FORCE_SHOW_FOR_TESTING) {
      setStoreUrl('https://apps.apple.com/app/id6764458556');
      setVisible(true);
      return;
    }
    // Skip in development so it never interrupts local work.
    if (__DEV__) return;
    const now = Date.now();
    if (now - lastCheckedAt.current < CHECK_INTERVAL_MS) return;
    lastCheckedAt.current = now;
    const result = await checkForAppUpdate();
    if (result?.updateAvailable) {
      setStoreUrl(result.storeUrl);
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    void runCheck();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void runCheck();
    });
    return () => sub.remove();
  }, [runCheck]);

  const showOverlay = visible && (REQUIRE_UPDATE || !dismissed);

  function handleUpdate() {
    if (storeUrl) Linking.openURL(storeUrl).catch(() => undefined);
  }

  return (
    <Modal visible={showOverlay} transparent animationType="fade" onRequestClose={() => undefined}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="arrow-up-circle" size={40} color={colors.accent} />
          </View>
          <Text style={styles.title}>Update available</Text>
          <Text style={styles.message}>
            A new version of YourFriends is ready. Update now to get the latest features, fixes, and improvements.
          </Text>
          <Pressable onPress={handleUpdate} style={styles.primaryButton} accessibilityRole="button" accessibilityLabel="Update now">
            <Ionicons name="logo-apple-appstore" size={18} color={colors.white} />
            <Text style={styles.primaryButtonText}>Update Now</Text>
          </Pressable>
          {!REQUIRE_UPDATE ? (
            <Pressable onPress={() => setDismissed(true)} style={styles.secondaryButton} accessibilityRole="button">
              <Text style={styles.secondaryButtonText}>Maybe later</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 380, borderRadius: radius.lg, backgroundColor: colors.paper, padding: spacing.lg, alignItems: 'center', gap: spacing.md },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft ?? colors.canvas },
  title: { fontFamily: fonts.heading, fontSize: 26, lineHeight: 32, color: colors.ink, textAlign: 'center', paddingHorizontal: 8 },
  message: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft, textAlign: 'center' },
  primaryButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, alignSelf: 'stretch', minHeight: 52, borderRadius: radius.pill, backgroundColor: colors.accent },
  primaryButtonText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white },
  secondaryButton: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.inkSoft },
});
