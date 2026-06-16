import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../features/auth/AuthContext';
import { usePremium } from '../features/premium/PremiumContext';
import { useTheme } from '../features/theme/ThemeContext';
import { dismissAd, isAdDismissed, type AdPlacement } from '../lib/adDismissal';
import { canUseNativeMobileAds, IOS_STORE_BANNER_AD_UNIT_ID, USE_TEST_ADS } from '../lib/adMob';
import type { ColorTokens } from '../features/theme/themes';
import { radius, spacing } from '../theme/tokens';

type GoogleMobileAdsModule = typeof import('react-native-google-mobile-ads');

function getGoogleMobileAdsModule(): GoogleMobileAdsModule | null {
  try {
    return require('react-native-google-mobile-ads') as GoogleMobileAdsModule;
  } catch {
    return null;
  }
}

interface DismissibleBannerAdProps {
  placement: AdPlacement;
  unitId?: string;
}

export function DismissibleBannerAd({ placement, unitId = IOS_STORE_BANNER_AD_UNIT_ID }: DismissibleBannerAdProps) {
  const { currentUser } = useAuth();
  const { isPremium } = usePremium();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    const userId = currentUser?.id;
    if (!userId || isPremium) {
      setVisible(false);
      return;
    }
    isAdDismissed(userId, placement)
      .then((dismissed) => {
        if (mounted) setVisible(!dismissed);
      })
      .catch(() => {
        if (mounted) setVisible(true);
      });
    return () => {
      mounted = false;
    };
  }, [currentUser?.id, isPremium, placement]);

  if (!canUseNativeMobileAds() || isPremium || visible !== true) {
    return null;
  }

  const adsModule = getGoogleMobileAdsModule();
  if (!adsModule) return null;

  const { BannerAd, BannerAdSize, TestIds } = adsModule;
  const resolvedUnitId = __DEV__ || USE_TEST_ADS ? TestIds.BANNER : unitId;

  async function handleDismiss() {
    const userId = currentUser?.id;
    if (!userId) {
      setVisible(false);
      return;
    }
    setVisible(false);
    await dismissAd(userId, placement).catch(() => undefined);
  }

  return (
    <View style={styles.shell}>
      <View style={styles.headerRow}>
        <Text style={styles.sponsoredLabel}>Sponsored</Text>
        <Pressable
          onPress={() => void handleDismiss()}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel="Close ad"
          hitSlop={8}
        >
          <Ionicons name="close" size={18} color={colors.inkSoft} />
        </Pressable>
      </View>
      <BannerAd
        unitId={resolvedUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

const makeStyles = (colors: ColorTokens, fonts: ReturnType<typeof useTheme>['fonts']) =>
  StyleSheet.create({
    shell: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 64,
      marginTop: spacing.xs,
      paddingTop: spacing.xs,
      paddingBottom: spacing.sm,
      paddingHorizontal: spacing.xs,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      gap: spacing.xs,
    },
    headerRow: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xs,
    },
    sponsoredLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: colors.inkMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.canvasAlt,
    },
  });
