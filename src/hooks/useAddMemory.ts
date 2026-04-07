import { useMutation, useQueryClient } from '@tanstack/react-query';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '../lib/supabase';
import { socialQueryKeys } from '../features/social/SocialGraphContext';
import { CreateWallPostInput, WallPost } from '../types/domain';

interface AddMemoryInput {
  authorUserId: string;
  imageUri: string | null;
  post: CreateWallPostInput;
}

function rowToWallPost(row: any): WallPost {
  return {
    id: row.id,
    authorUserId: row.author_user_id,
    subjectUserId: row.subject_user_id ?? null,
    subjectContactId: row.subject_contact_id ?? null,
    visibility: row.visibility,
    body: row.body,
    imageUri: row.image_path ?? null,
    cardColor: row.card_color ?? null,
    createdAt: row.created_at,
  };
}

async function uploadImageAndCreatePost({ authorUserId, imageUri, post }: AddMemoryInput): Promise<WallPost> {
  let storedImagePath: string | null = null;

  if (imageUri) {
    const ext = imageUri.split('.').pop()?.toLowerCase() ?? 'jpg';
    const fileName = `${authorUserId}/${Date.now()}.${ext}`;
    const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
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
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Failed to create memory');
  const wallPost = rowToWallPost(data);

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
