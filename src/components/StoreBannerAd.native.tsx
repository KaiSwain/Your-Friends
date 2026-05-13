import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
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

export function StoreBannerAd() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (!canUseNativeMobileAds()) {
    return null;
  }

  const adsModule = getGoogleMobileAdsModule();

  if (!adsModule) {
    return null;
  }

  const { BannerAd, BannerAdSize, TestIds } = adsModule;
  const unitId = __DEV__ || USE_TEST_ADS ? TestIds.BANNER : IOS_STORE_BANNER_AD_UNIT_ID;

  return (
    <View style={styles.shell}>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    shell: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 64,
      marginTop: spacing.xs,
      paddingVertical: spacing.xs,
      borderRadius: radius.md,
      backgroundColor: colors.paper,
    },
  });