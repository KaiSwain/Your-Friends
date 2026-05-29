import { supabase } from './supabase';
import type { Notification, NotificationMetadata, NotificationType } from '../types/domain';
import * as Crypto from 'expo-crypto';

/**
 * Standard shape for inserting rows into `notifications`:
 *
 * - `recipientUserId` / `actorUserId` / `type` / `message` — always set.
 * - `referenceId` — primary domain id (wall post, friend request, contact, calendar event, …) when one exists.
 * - `metadata` — always pass an object (`{}` at minimum). Put type-specific fields here (see `NotificationMetadata`
 *   in domain types). Persisted and synthetic rows should use the same keys where possible.
 * - `sendPush` — omit for default push; set `false` to skip the edge function (e.g. purely in-app reminders).
 */
interface CreateNotificationInput {
  recipientUserId: string;
  actorUserId: string;
  type: NotificationType;
  referenceId?: string | null;
  message: string;
  metadata?: NotificationMetadata;
  sendPush?: boolean;
}

type NotificationInsertListener = (notifications: Notification[]) => void;

const notificationInsertListeners = new Set<NotificationInsertListener>();

export function subscribeNotificationInserts(listener: NotificationInsertListener) {
  notificationInsertListeners.add(listener);
  return () => {
    notificationInsertListeners.delete(listener);
  };
}

export async function createNotification(input: CreateNotificationInput): Promise<Notification | null> {
  const [notification] = await createNotifications([input]);
  return notification ?? null;
}

export async function createNotifications(inputs: CreateNotificationInput[]): Promise<Notification[]> {
  if (inputs.length === 0) return [];
  const rows = inputs.map((input) => ({
    id: Crypto.randomUUID(),
    recipient_user_id: input.recipientUserId,
    actor_user_id: input.actorUserId,
    type: input.type,
    reference_id: input.referenceId ?? null,
    message: input.message,
    metadata: input.metadata ?? {},
    read: false,
    created_at: new Date().toISOString(),
  }));
  const { error } = await safeInsertNotificationRows(rows);

  if (error) {
    console.warn('[notification] insert skipped:', error?.message ?? 'Failed to create notification.', {
      notifications: inputs.map((input) => ({
        type: input.type,
        actorUserId: input.actorUserId,
        recipientUserId: input.recipientUserId,
        selfNotification: input.actorUserId === input.recipientUserId,
      })),
    });
    return [];
  }

  const notifications = rows.map(rowToNotification);
  for (const listener of notificationInsertListeners) {
    listener(notifications);
  }
  const pushable = notifications.filter((notification) => {
    const source = findSourceInput(inputs, notification);
    return source?.sendPush !== false;
  });
  const byRecipient = new Map<string, Notification[]>();
  for (const notification of pushable) {
    byRecipient.set(notification.recipientUserId, [...(byRecipient.get(notification.recipientUserId) ?? []), notification]);
  }
  for (const recipientNotifications of byRecipient.values()) {
    if (recipientNotifications.length > 1) {
      void sendNotificationPush(recipientNotifications[0].id, {
        title: 'New notifications',
        body: `You have ${recipientNotifications.length} new notifications`,
      });
    } else if (recipientNotifications[0]) {
      void sendNotificationPush(recipientNotifications[0].id);
    }
  }
  return notifications;
}

async function safeInsertNotificationRows(rows: Array<Record<string, unknown>>) {
  try {
    return await supabase
      .from('notifications')
      .insert(rows);
  } catch (error) {
    return {
      data: null,
      error: {
        message: error instanceof Error ? error.message : 'Network request failed.',
      },
    };
  }
}

export async function sendNotificationPush(notificationId: string, override?: { title?: string; body?: string }) {
  try {
    const { data, error } = await supabase.functions.invoke('send-notification-push', {
      body: { notificationId, ...override },
    });
    if (error) console.warn('[notification] push send failed:', error.message);
    if (isSkippedPushResponse(data)) console.warn('[notification] push skipped:', data.skipped);
  } catch (error) {
    console.warn('[notification] push send failed:', error instanceof Error ? error.message : 'Network request failed.');
  }
}

function findSourceInput(inputs: CreateNotificationInput[], notification: Notification) {
  return inputs.find(
    (input) =>
      input.recipientUserId === notification.recipientUserId
      && input.actorUserId === notification.actorUserId
      && input.type === notification.type
      && input.message === notification.message,
  );
}

function isSkippedPushResponse(value: unknown): value is { skipped: string } {
  if (!value || typeof value !== 'object') return false;
  return 'skipped' in value
    && typeof (value as { skipped?: unknown }).skipped === 'string';
}

function rowToNotification(row: any): Notification {
  return {
    id: row.id,
    recipientUserId: row.recipient_user_id,
    actorUserId: row.actor_user_id,
    type: row.type,
    referenceId: row.reference_id ?? null,
    message: row.message,
    metadata: row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata : {},
    read: row.read,
    createdAt: row.created_at,
  };
}
