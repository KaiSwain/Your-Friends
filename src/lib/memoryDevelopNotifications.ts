import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { CURE_DURATION_MS } from './polaroidCure';

type MemoryDevelopedListener = (event: { postId: string; message: string }) => void;

const scheduledNotificationKey = (postId: string) => `yourfriends:memoryDevelopedNotification:${postId}`;
const deliveredNotificationKey = (postId: string) => `yourfriends:memoryDevelopedDelivered:${postId}`;
const listeners = new Set<MemoryDevelopedListener>();

export function subscribeMemoryDevelopedNotifications(listener: MemoryDevelopedListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function scheduleMemoryDevelopedNotification(postId: string, createdAt: string) {
  const remainingMs = getRemainingDevelopMs(createdAt);
  if (remainingMs <= 0) return;

  await cancelMemoryDevelopedNotification(postId);
  const id = await Notifications.scheduleNotificationAsync({
    content: getMemoryDevelopedNotificationContent(postId),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, Math.ceil(remainingMs / 1000)),
    },
  });
  await AsyncStorage.setItem(scheduledNotificationKey(postId), id);
}

export async function notifyMemoryDevelopedNow(postId: string) {
  const alreadyDelivered = await AsyncStorage.getItem(deliveredNotificationKey(postId));
  if (alreadyDelivered === 'true') return;

  await cancelMemoryDevelopedNotification(postId);
  await AsyncStorage.setItem(deliveredNotificationKey(postId), 'true');

  const message = 'Your memory card has developed!';
  for (const listener of listeners) listener({ postId, message });

  // This is mainly a fallback for the moment the app transitions away.
  // Foreground display is handled by the in-app toast subscriber.
  await Notifications.scheduleNotificationAsync({
    content: getMemoryDevelopedNotificationContent(postId),
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 1,
    },
  }).catch(() => undefined);
}

export async function cancelMemoryDevelopedNotification(postId: string) {
  const existingId = await AsyncStorage.getItem(scheduledNotificationKey(postId));
  if (existingId) {
    await Notifications.cancelScheduledNotificationAsync(existingId).catch(() => undefined);
    await AsyncStorage.removeItem(scheduledNotificationKey(postId));
  }
}

function getRemainingDevelopMs(createdAt: string) {
  return new Date(createdAt).getTime() + CURE_DURATION_MS - Date.now();
}

function getMemoryDevelopedNotificationContent(postId: string) {
  return {
    title: 'Your memory card has developed!',
    body: 'A memory you posted is ready to view.',
    sound: true,
    data: {
      type: 'memory_developed',
      postId,
      referenceId: postId,
    },
  };
}
