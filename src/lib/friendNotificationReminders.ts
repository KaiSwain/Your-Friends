import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { CURE_DURATION_MS, getCureProgress } from './polaroidCure';
import { PROMPT_EXPIRING_SOON_MS } from './promptExpiration';
import type { AppUser, GiftNote, MemoryPromptRequest, MovieReviewRequest, WallPost } from '../types/domain';

const DAY_MS = 24 * 60 * 60 * 1000;
const PROMPT_STILL_WAITING_MS = 3 * DAY_MS;

const reminderIndexKey = (userId: string) => `yourfriends:friendNotificationReminders:index:${userId}`;
const incomingPolaroidFirstSeenKey = (userId: string, postId: string) => `yourfriends:incomingPolaroid:firstSeen:${userId}:${postId}`;

interface ReminderInput {
  userId: string;
  users: AppUser[];
  giftNotes: GiftNote[];
  memoryPromptRequests: MemoryPromptRequest[];
  movieReviewRequests: MovieReviewRequest[];
  wallPosts: WallPost[];
}

interface DesiredReminder {
  key: string;
  title: string;
  body: string;
  date: Date;
  data: Record<string, unknown>;
}

export async function resyncFriendNotificationReminders({
  userId,
  users,
  giftNotes,
  memoryPromptRequests,
  movieReviewRequests,
  wallPosts,
}: ReminderInput) {
  const desired = await buildDesiredReminders({
    userId,
    users,
    giftNotes,
    memoryPromptRequests,
    movieReviewRequests,
    wallPosts,
  });
  const existing = await readReminderIndex(userId);
  const desiredKeys = new Set(desired.map((entry) => entry.key));

  for (const [key, notificationId] of Object.entries(existing)) {
    if (!desiredKeys.has(key)) {
      await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
      delete existing[key];
    }
  }

  const unscheduled = desired.filter((entry) => !existing[entry.key]);
  if (unscheduled.length > 0) {
    const permission = await ensureNotificationPermission();
    if (permission) {
      for (const reminder of unscheduled) {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: reminder.title,
            body: reminder.body,
            sound: true,
            data: reminder.data,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminder.date,
          },
        });
        existing[reminder.key] = id;
      }
    }
  }

  await AsyncStorage.setItem(reminderIndexKey(userId), JSON.stringify(existing));
}

async function buildDesiredReminders(input: ReminderInput): Promise<DesiredReminder[]> {
  const now = Date.now();
  const reminders: DesiredReminder[] = [];

  for (const request of input.memoryPromptRequests) {
    if (request.recipientUserId !== input.userId || request.status !== 'pending') continue;
    const requesterName = getUserName(input.users, request.requesterUserId);
    const createdAt = new Date(request.createdAt).getTime();
    addFutureReminder(reminders, {
      key: `memory-prompt-answer:${request.id}`,
      title: 'Prompt waiting',
      body: `${requesterName} is waiting for your answer.`,
      date: new Date(createdAt + DAY_MS),
      data: {
        type: 'memory_prompt_request',
        memoryPromptRequestId: request.id,
        referenceId: request.id,
      },
    }, now);
    addFutureReminder(reminders, {
      key: `memory-prompt-still:${request.id}`,
      title: 'Prompt still waiting',
      body: `${requesterName}'s prompt is still waiting for you.`,
      date: new Date(createdAt + PROMPT_STILL_WAITING_MS),
      data: {
        type: 'memory_prompt_request',
        memoryPromptRequestId: request.id,
        referenceId: request.id,
      },
    }, now);
    addFutureReminder(reminders, {
      key: `memory-prompt-expiring:${request.id}`,
      title: 'Prompt expiring soon',
      body: `${requesterName}'s prompt expires in about 24 hours.`,
      date: new Date(new Date(request.expiresAt).getTime() - PROMPT_EXPIRING_SOON_MS),
      data: {
        type: 'memory_prompt_request',
        memoryPromptRequestId: request.id,
        referenceId: request.id,
      },
    }, now);
  }

  for (const request of input.movieReviewRequests) {
    if (request.recipientUserId !== input.userId || request.status !== 'pending') continue;
    const requesterName = getUserName(input.users, request.requesterUserId);
    const createdAt = new Date(request.createdAt).getTime();
    addFutureReminder(reminders, {
      key: `movie-prompt-answer:${request.id}`,
      title: 'Movie prompt waiting',
      body: `${requesterName} is waiting for your rating of ${request.movie.title}.`,
      date: new Date(createdAt + DAY_MS),
      data: {
        type: 'movie_review_request',
        movieReviewRequestId: request.id,
        referenceId: request.id,
      },
    }, now);
    addFutureReminder(reminders, {
      key: `movie-prompt-still:${request.id}`,
      title: 'Movie prompt still waiting',
      body: `${requesterName}'s movie prompt is still waiting for you.`,
      date: new Date(createdAt + PROMPT_STILL_WAITING_MS),
      data: {
        type: 'movie_review_request',
        movieReviewRequestId: request.id,
        referenceId: request.id,
      },
    }, now);
    addFutureReminder(reminders, {
      key: `movie-prompt-expiring:${request.id}`,
      title: 'Movie prompt expiring soon',
      body: `${requesterName}'s movie prompt expires in about 24 hours.`,
      date: new Date(new Date(request.expiresAt).getTime() - PROMPT_EXPIRING_SOON_MS),
      data: {
        type: 'movie_review_request',
        movieReviewRequestId: request.id,
        referenceId: request.id,
      },
    }, now);
  }

  for (const giftNote of input.giftNotes) {
    if (giftNote.recipientUserId !== input.userId || giftNote.status !== 'locked') continue;
    const unlockDate = parseGiftUnlockDate(giftNote);
    if (!unlockDate) continue;
    const authorName = getUserName(input.users, giftNote.authorUserId);
    addFutureReminder(reminders, {
      key: `gift-unlock:${giftNote.id}`,
      title: 'Gift note unlocked',
      body: `${authorName}'s gift note is ready to open.`,
      date: unlockDate,
      data: {
        type: 'gift_note_unlock',
        giftNoteId: giftNote.id,
      },
    }, now);
  }

  for (const post of input.wallPosts) {
    if (!isIncomingPolaroidWaiting(post, input.userId)) continue;
    const triggerDate = await getIncomingPolaroidReminderDate(input.userId, post.id);
    addFutureReminder(reminders, {
      key: `incoming-polaroid:${post.id}`,
      title: 'Memory card waiting',
      body: 'You have an incoming memory card waiting to develop.',
      date: triggerDate,
      data: {
        type: 'incoming_polaroid_waiting',
        wallPostId: post.id,
        referenceId: post.id,
      },
    }, now);
  }

  return reminders;
}

function addFutureReminder(reminders: DesiredReminder[], reminder: DesiredReminder, now: number) {
  const triggerAt = reminder.date.getTime();
  if (!Number.isFinite(triggerAt) || triggerAt <= now) return;
  reminders.push(reminder);
}

function isIncomingPolaroidWaiting(post: WallPost, userId: string) {
  if (post.postType !== 'polaroid' || !post.imageUri) return false;
  if (post.authorUserId === userId || post.subjectUserId !== userId || post.visibility !== 'visible_to_subject') return false;
  return getCureProgress(post.createdAt) < 1 || new Date(post.createdAt).getTime() > Date.now() - DAY_MS;
}

async function getIncomingPolaroidReminderDate(userId: string, postId: string) {
  const key = incomingPolaroidFirstSeenKey(userId, postId);
  const stored = await AsyncStorage.getItem(key);
  const firstSeen = stored ?? new Date().toISOString();
  if (!stored) await AsyncStorage.setItem(key, firstSeen);
  return new Date(new Date(firstSeen).getTime() + CURE_DURATION_MS);
}

function parseGiftUnlockDate(giftNote: GiftNote) {
  const [hour = 9, minute = 0] = giftNote.unlockTime.split(':').map(Number);
  const [year, month, day] = giftNote.unlockDate.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day, hour || 9, minute || 0, 0, 0);
}

function getUserName(users: AppUser[], userId: string) {
  return users.find((user) => user.id === userId)?.displayName ?? 'Someone';
}

async function ensureNotificationPermission() {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.status === 'granted') return true;
  const next = await Notifications.requestPermissionsAsync();
  return next.status === 'granted';
}

async function readReminderIndex(userId: string) {
  const raw = await AsyncStorage.getItem(reminderIndexKey(userId));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  } catch {
    return {};
  }
}
