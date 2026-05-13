import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';

import { useAuth } from '../../src/features/auth/AuthContext';
import { PhotoSourceSheetHost } from '../../src/components/PhotoSourceSheetHost';
import { CalendarProvider } from '../../src/features/calendar/CalendarContext';
import { InAppNotificationProvider } from '../../src/features/notifications/InAppNotificationContext';
import { usePremium } from '../../src/features/premium/PremiumContext';
import { SocialGraphProvider, useSocialGraph } from '../../src/features/social/SocialGraphContext';
import { usePushNotifications } from '../../src/hooks/usePushNotifications';
import { extractFriendCode } from '../../src/lib/friendCode';
import { storeIncomingReferralCode } from '../../src/lib/referrals';

export default function AppLayout() {
  const { currentUser } = useAuth();
  const router = useRouter();
  usePushNotifications(currentUser?.id);

  useEffect(() => {
    function handleDeepLink(event: { url: string }) {
      // Only act on URLs that clearly look like a friend invite. We require
      // either a `code=` query param or our `add-friend` route, AND a code
      // that survives extraction. This avoids popping the add-friend modal
      // for the dev launch URL or notification-tap URLs on cold start.
      const url = event.url ?? '';
      const looksLikeInvite = /[?&]code=/i.test(url) || /\/add-friend(?:[/?#]|$)/i.test(url);
      if (!looksLikeInvite) return;
      const code = extractFriendCode(url);
      if (code && /^[A-Z0-9]{6,12}$/.test(code)) {
        storeIncomingReferralCode(code).catch(() => {});
        router.push({ pathname: '/(app)/friends/add', params: { code } });
      }
    }
    const sub = Linking.addEventListener('url', handleDeepLink);
    // Handle cold-start deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });
    return () => sub.remove();
  }, [router]);

  return (
    <SocialGraphProvider>
      <CalendarProvider>
        <InAppNotificationProvider>
          <PremiumFriendsSync />
          <PhotoSourceSheetHost />
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="friends/index" options={{ animation: 'fade' }} />
            <Stack.Screen name="friends/add" />
            <Stack.Screen name="calendar" />
            <Stack.Screen name="notifications" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            <Stack.Screen name="settings" />
            <Stack.Screen name="store" />
            <Stack.Screen name="profiles/me" />
          </Stack>
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