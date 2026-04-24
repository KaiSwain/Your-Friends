import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '../../src/features/auth/AuthContext';
import { InAppNotificationProvider } from '../../src/features/notifications/InAppNotificationContext';
import { PremiumProvider } from '../../src/features/premium/PremiumContext';
import { SocialGraphProvider } from '../../src/features/social/SocialGraphContext';
import { usePushNotifications } from '../../src/hooks/usePushNotifications';
import { extractFriendCode } from '../../src/lib/friendCode';

export default function AppLayout() {
  const { currentUser } = useAuth();
  const router = useRouter();
  usePushNotifications(currentUser?.id);

  useEffect(() => {
    function handleDeepLink(event: { url: string }) {
      const code = extractFriendCode(event.url);
      if (code && /^[A-Z0-9]{4,12}$/.test(code)) {
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
    <PremiumProvider>
      <SocialGraphProvider>
        <InAppNotificationProvider>
          <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
            <Stack.Screen name="friends/index" options={{ animation: 'fade' }} />
            <Stack.Screen name="friends/add" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            <Stack.Screen name="notifications" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            <Stack.Screen name="settings" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            <Stack.Screen name="store" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
            <Stack.Screen name="profiles/me" options={{ animation: 'slide_from_bottom', presentation: 'modal' }} />
          </Stack>
        </InAppNotificationProvider>
      </SocialGraphProvider>
    </PremiumProvider>
  );
}