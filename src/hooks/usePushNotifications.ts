import { useEffect, useRef, useState } from 'react';
import { InteractionManager, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import { supabase } from '../lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('usePushNotifications: No projectId found — skipping push token registration.');
    return null;
  }
  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch (e) {
    console.warn('usePushNotifications: Failed to get push token', e);
    return null;
  }
}

/**
 * Registers for push notifications on mount and stores the token
 * in the user's profile row for server-side sending.
 */
export function usePushNotifications(userId: string | undefined) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const savedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      registerForPushNotificationsAsync().then(async (token) => {
        if (cancelled || !token) return;
        setExpoPushToken(token);

        // Persist once per signed-in user so startup doesn't repeat the write.
        if (savedUserIdRef.current === userId) return;

        savedUserIdRef.current = userId;
        await supabase
          .from('profiles')
          .update({ push_token: token })
          .eq('id', userId);
      });
    });

    return () => {
      cancelled = true;
      task.cancel();
    };
  }, [userId]);

  // Listen for incoming notifications while app is foregrounded
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => {
      // The in-app notification system handles display;
      // this listener just ensures the badge updates.
    });
    return () => sub.remove();
  }, []);

  return expoPushToken;
}
