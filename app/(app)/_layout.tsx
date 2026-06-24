import { Redirect, Stack } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '../../src/features/auth/AuthContext';
import { CalendarProvider } from '../../src/features/calendar/CalendarContext';
import { InAppNotificationProvider } from '../../src/features/notifications/InAppNotificationContext';
import { useOnboarding } from '../../src/features/onboarding/OnboardingContext';
import { usePremium } from '../../src/features/premium/PremiumContext';
import { SocialGraphProvider, useSocialGraph } from '../../src/features/social/SocialGraphContext';
import { useTheme } from '../../src/features/theme/ThemeContext';
import { ScrollChromeProvider } from '../../src/features/navigation/ScrollChromeContext';
import { usePushNotifications } from '../../src/hooks/usePushNotifications';

export default function AppLayout() {
  const { currentUser, loading } = useAuth();
  const { loaded: onboardingLoaded, hasCompletedOnboarding } = useOnboarding();
  const { colors } = useTheme();
  usePushNotifications(currentUser?.id);

  if (loading || !onboardingLoaded) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;
  if (!hasCompletedOnboarding) return <Redirect href="/(onboarding)/welcome" />;

  return (
    <SocialGraphProvider>
      <CalendarProvider>
        <InAppNotificationProvider>
          <ScrollChromeProvider>
            <PremiumFriendsSync />
            <Stack
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
                contentStyle: { backgroundColor: 'transparent' },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
              <Stack.Screen name="add-friend" />
              <Stack.Screen name="friends/add" />
              <Stack.Screen name="notifications" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
              <Stack.Screen name="settings" options={{ animation: 'slide_from_left' }} />
              <Stack.Screen name="store" options={{ animation: 'slide_from_left' }} />
              <Stack.Screen name="admin/broadcast" />
            </Stack>
          </ScrollChromeProvider>
        </InAppNotificationProvider>
      </CalendarProvider>
    </SocialGraphProvider>
  );
}

/**
 * Watches the social graph for linked friends and asks the PremiumContext to
 * refresh `premiumFriendIds` whenever the friend list changes so we can paint
 * the gold glow + PREMIUM badge on subscribed friends' profile cards.
 */
function PremiumFriendsSync() {
  const { contacts } = useSocialGraph();
  const { recheckPremiumFriends } = usePremium();
  const friendIds = useMemo(
    () => contacts.map((c) => c.linkedUserId).filter((id): id is string => !!id),
    [contacts],
  );
  // Stable cache key so the effect only fires when the set of friend ids changes.
  const idsKey = friendIds.slice().sort().join(',');
  useEffect(() => {
    recheckPremiumFriends(friendIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);
  return null;
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});