import { supabase } from './supabase';
import type { Notification, NotificationMetadata, NotificationType } from '../types/domain';

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
  const { data, error } = await supabase
    .from('notifications')
    .insert(
      inputs.map((input) => ({
        recipient_user_id: input.recipientUserId,
        actor_user_id: input.actorUserId,
        type: input.type,
        reference_id: input.referenceId ?? null,
        message: input.message,
        metadata: input.metadata ?? {},
      })),
    )
    .select();

  if (error || !data) {
    console.warn('[notification] insert skipped:', error?.message ?? 'Failed to create notification.');
    return [];
  }

  const notifications = data.map(rowToNotification);
  for (const listener of notificationInsertListeners) {
    listener(notifications);
  }
  for (const notification of notifications) {
    const source = inputs.find(
      (input) =>
        input.recipientUserId === notification.recipientUserId
        && input.actorUserId === notification.actorUserId
        && input.type === notification.type
        && input.message === notification.message,
    );
    if (source?.sendPush === false) continue;
    void sendNotificationPush(notification.id);
  }
  return notifications;
}

async function sendNotificationPush(notificationId: string) {
  const { error } = await supabase.functions.invoke('send-notification-push', {
    body: { notificationId },
  });
  if (error) console.warn('[notification] push send failed:', error.message);
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
