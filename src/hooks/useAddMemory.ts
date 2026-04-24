import { useMutation, useQueryClient } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import * as Notifications from 'expo-notifications';

import { compressImage } from '../lib/compressImage';
import { CURE_DURATION_MS } from '../lib/polaroidCure';
import { supabase } from '../lib/supabase';
import { socialQueryKeys } from '../features/social/SocialGraphContext';
import { CreateWallPostInput, WallPost } from '../types/domain';
import { rowToWallPost } from '../features/social/mappers';
import { encodeWallPostTextStyle } from '../lib/wallPostTextStyle';

interface AddMemoryInput {
  authorUserId: string;
  imageUri: string | null;
  post: CreateWallPostInput;
}

async function uploadImageAndCreatePost({ authorUserId, imageUri, post }: AddMemoryInput): Promise<WallPost> {
  let storedImagePath: string | null = null;

  if (imageUri) {
    const compressed = await compressImage(imageUri);
    const ext = 'jpg';
    const fileName = `${authorUserId}/${Date.now()}.${ext}`;
    const base64 = await FileSystem.readAsStringAsync(compressed, { encoding: FileSystem.EncodingType.Base64 });
    const { error: uploadErr } = await supabase.storage
      .from('Memories')
      .upload(fileName, decode(base64), { contentType: `image/${ext}`, upsert: false });
    if (uploadErr) throw uploadErr;
    const { data: urlData } = supabase.storage.from('Memories').getPublicUrl(fileName);
    storedImagePath = urlData.publicUrl;
  }

  const { data, error } = await supabase
    .from('wall_posts')
    .insert({
      author_user_id: authorUserId,
      subject_user_id: post.subjectUserId,
      subject_contact_id: post.subjectContactId,
      visibility: post.visibility,
      body: post.body,
      image_path: storedImagePath,
      card_color: post.cardColor ?? null,
      back_text: post.backText ?? null,
      filter: storedImagePath ? (post.filter ?? null) : encodeWallPostTextStyle(post.textFont, post.textSize, post.textEffect, post.textColor),
      date_stamp: post.dateStamp ?? false,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to create memory');
  const wallPost = rowToWallPost(data);

  // Schedule a local notification when the photo finishes curing.
  if (wallPost.imageUri) {
    Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your Polaroid has developed!',
        body: 'A memory you posted is ready to view.',
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.ceil(CURE_DURATION_MS / 1000),
      },
    }).catch((err) => console.warn('[cure notification] schedule failed:', err));
  }

  // Send notification to the subject about the new memory.
  let recipientId: string | null = wallPost.subjectUserId;
  if (!recipientId && wallPost.subjectContactId) {
    const { data: contactRow } = await supabase.from('contacts').select('linked_user_id').eq('id', wallPost.subjectContactId).single();
    recipientId = contactRow?.linked_user_id ?? null;
  }
  if (recipientId && recipientId !== authorUserId) {
    const { data: authorRow } = await supabase.from('profiles').select('display_name').eq('id', authorUserId).single();
    const authorName = authorRow?.display_name ?? 'Someone';
    supabase.from('notifications').insert({
      recipient_user_id: recipientId,
      actor_user_id: authorUserId,
      type: 'wall_post',
      reference_id: wallPost.id,
      message: `${authorName} added a memory about you`,
    }).then(({ error: nErr }) => { if (nErr) console.error('[notification] wall_post insert failed:', nErr); });
  }

  return wallPost;
}

/** Mutation hook for creating a memory (optional image upload + wall post). */
export function useAddMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadImageAndCreatePost,
    onSuccess: (newPost) => {
      // Optimistically prepend the new post to the cached wall posts.
      queryClient.setQueryData<WallPost[]>(socialQueryKeys.wallPosts, (old) => [newPost, ...(old ?? [])]);
    },
  });
}
