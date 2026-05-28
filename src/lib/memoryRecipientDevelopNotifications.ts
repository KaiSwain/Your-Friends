import AsyncStorage from '@react-native-async-storage/async-storage';

import type { WallPost } from '../types/domain';
import { markIncomingMemoryDeveloped } from './incomingMemoryDevelopState';
import { markMemoryDeveloped } from './memoryDevelopNotifications';
import { createNotification } from './notifications';

const NOTIFICATION_SENT_PREFIX = 'yourfriends.recipientMemoryDevelopedNotification.v1';

interface NotifyMemoryAuthorInput {
  post: WallPost;
  recipientName: string;
  recipientUserId: string;
}

export async function notifyMemoryAuthorRecipientDeveloped({
  post,
  recipientName,
  recipientUserId,
}: NotifyMemoryAuthorInput) {
  if (post.authorUserId === recipientUserId) return;
  if (post.subjectUserId !== recipientUserId) return;
  if (post.postType !== 'polaroid' || !post.imageUri) return;

  await markIncomingMemoryDeveloped(recipientUserId, post.id);
  await markMemoryDeveloped(post.id);

  const key = `${NOTIFICATION_SENT_PREFIX}:${recipientUserId}:${post.id}`;
  const alreadySent = await AsyncStorage.getItem(key);
  if (alreadySent === 'true') return;
  await AsyncStorage.setItem(key, 'true');

  await createNotification({
    recipientUserId: post.authorUserId,
    actorUserId: recipientUserId,
    type: 'wall_post',
    referenceId: post.id,
    metadata: {
      wallPostId: post.id,
      postType: post.postType,
      source: 'recipient_memory_developed',
      developedByUserId: recipientUserId,
    },
    message: `${recipientName} developed your memory card`,
  });
}
