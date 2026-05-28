import type { Notification } from '../types/domain';

type MarkNotificationRead = (notificationId: string) => Promise<void>;
type MarkSyntheticRead = (notificationId: string) => Promise<void>;

export function getUnreadMemoryPromptIds(notifications: readonly Notification[]) {
  return new Set(
    notifications
      .filter((notification) => !notification.read && notification.type === 'memory_prompt_request')
      .map((notification) => getMemoryPromptRequestId(notification))
      .filter((requestId): requestId is string => Boolean(requestId)),
  );
}

export function getUnreadMoviePromptIds(notifications: readonly Notification[]) {
  return new Set(
    notifications
      .filter((notification) => !notification.read && notification.type === 'movie_review_request')
      .map((notification) => getMovieReviewRequestId(notification))
      .filter((requestId): requestId is string => Boolean(requestId)),
  );
}

export function getUnreadWallPostIds(notifications: readonly Notification[]) {
  return new Set(
    notifications
      .filter((notification) => !notification.read && (notification.type === 'wall_post' || notification.type === 'memory_reply'))
      .map((notification) => getWallPostId(notification))
      .filter((postId): postId is string => Boolean(postId)),
  );
}

export function getNotificationIdsForMemoryPrompt(notifications: readonly Notification[], requestId: string) {
  return notifications
    .filter((notification) => !notification.read && getMemoryPromptRequestId(notification) === requestId)
    .map((notification) => notification.id);
}

export function getNotificationIdsForMoviePrompt(notifications: readonly Notification[], requestId: string) {
  return notifications
    .filter((notification) => !notification.read && getMovieReviewRequestId(notification) === requestId)
    .map((notification) => notification.id);
}

export function getNotificationIdsForWallPost(notifications: readonly Notification[], postId: string) {
  return notifications
    .filter((notification) => !notification.read && getWallPostId(notification) === postId)
    .map((notification) => notification.id);
}

export function markProfileNotificationIdsRead(
  ids: readonly string[],
  markNotificationRead: MarkNotificationRead,
  markSyntheticRead?: MarkSyntheticRead,
) {
  for (const id of ids) {
    if (isSyntheticNotificationId(id)) {
      markSyntheticRead?.(id).catch(() => undefined);
    } else {
      markNotificationRead(id).catch(() => undefined);
    }
  }
}

function getMemoryPromptRequestId(notification: Notification) {
  if (typeof notification.metadata.memoryPromptRequestId === 'string') return notification.metadata.memoryPromptRequestId;
  return notification.type === 'memory_prompt_request' ? notification.referenceId : null;
}

function getMovieReviewRequestId(notification: Notification) {
  if (typeof notification.metadata.movieReviewRequestId === 'string') return notification.metadata.movieReviewRequestId;
  return notification.type === 'movie_review_request' ? notification.referenceId : null;
}

function getWallPostId(notification: Notification) {
  if (typeof notification.metadata.wallPostId === 'string') return notification.metadata.wallPostId;
  return notification.type === 'wall_post' || notification.type === 'memory_reply' ? notification.referenceId : null;
}

function isSyntheticNotificationId(id: string) {
  return id.includes(':');
}
