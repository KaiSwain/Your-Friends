import { createNotification } from '../../lib/notifications';
import { supabase } from '../../lib/supabase';
import { uploadMemoryImageVariants, uploadMemoryVideo } from '../../lib/memoryMediaUpload';
import type {
  CompleteMemoryPromptRequestInput,
  CreateMemoryPromptRequestInput,
  CreateSavedMemoryPromptInput,
  MemoryPromptRequest,
  MemoryPromptType,
  SavedMemoryPrompt,
  WallPost,
} from '../../types/domain';
import { rowToWallPost } from '../social/mappers';
import { movieToDbColumns } from '../movies/mappers';
import { hasTextOrVoice } from '../../lib/voiceAttachmentDb';
import { getPromptExpiresAt, isPromptExpired } from '../../lib/promptExpiration';
import { rowToMemoryPromptRequest, rowToSavedMemoryPrompt, songToPromptResponseDbColumns, songToWallPostDbColumns, voiceToPromptQuestionDbColumns, voiceToPromptResponseDbColumns, voiceToWallPostDbColumns } from './mappers';

export const memoryPromptQueryKeys = {
  requests: ['memoryPrompts', 'requests'] as const,
  savedPrompts: (ownerUserId: string) => ['memoryPrompts', 'savedPrompts', ownerUserId] as const,
};

export async function fetchMemoryPromptRequests(): Promise<MemoryPromptRequest[]> {
  const { data, error } = await supabase.from('memory_prompt_requests').select('*').order('created_at', { ascending: false });
  if (error) {
    if (isMissingTable(error.message, 'memory_prompt_requests')) return [];
    throw error;
  }
  return (data ?? []).map(rowToMemoryPromptRequest);
}

export async function createMemoryPromptRequest(requesterUserId: string, input: CreateMemoryPromptRequestInput): Promise<MemoryPromptRequest> {
  const promptText = cleanRequiredText(input.promptText, 'Write a prompt first.', 240);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('memory_prompt_requests')
    .insert({
      requester_user_id: requesterUserId,
      recipient_user_id: input.recipientUserId,
      prompt_type: input.promptType,
      prompt_text: promptText,
      ...voiceToPromptQuestionDbColumns(input.promptVoice),
      status: 'pending',
      expires_at: getPromptExpiresAt(now),
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Could not send memory prompt.');
  const request = rowToMemoryPromptRequest(data);
  const requesterName = await getDisplayName(requesterUserId);

  createNotification({
    recipientUserId: request.recipientUserId,
    actorUserId: request.requesterUserId,
    type: 'memory_prompt_request',
    referenceId: request.id,
    metadata: {
      memoryPromptRequestId: request.id,
      promptType: request.promptType,
      source: 'memory_prompt_request',
    },
    message: `${requesterName} sent you a memory prompt`,
  }).catch((notificationError) => console.warn('[notification] memory prompt insert failed:', notificationError));

  return request;
}

export async function fetchSavedMemoryPrompts(ownerUserId: string): Promise<SavedMemoryPrompt[]> {
  const { data, error } = await supabase
    .from('saved_memory_prompts')
    .select('*')
    .eq('owner_user_id', ownerUserId)
    .order('updated_at', { ascending: false });
  if (error) {
    if (isMissingTable(error.message, 'saved_memory_prompts')) return [];
    throw error;
  }
  return (data ?? []).map(rowToSavedMemoryPrompt);
}

export async function createSavedMemoryPrompt(ownerUserId: string, input: CreateSavedMemoryPromptInput): Promise<SavedMemoryPrompt> {
  const promptText = cleanRequiredText(input.promptText, 'Write a prompt before saving.', 240);
  const { data, error } = await supabase
    .from('saved_memory_prompts')
    .insert({
      owner_user_id: ownerUserId,
      prompt_type: input.promptType,
      prompt_text: promptText,
      category: cleanOptionalText(input.category, 80),
      source: input.source ?? 'user',
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Could not save prompt.');
  return rowToSavedMemoryPrompt(data);
}

export async function deleteSavedMemoryPrompt(promptId: string, ownerUserId: string): Promise<void> {
  const { error } = await supabase
    .from('saved_memory_prompts')
    .delete()
    .eq('id', promptId)
    .eq('owner_user_id', ownerUserId);
  if (error) throw new Error(error.message);
}

export async function cancelMemoryPromptRequest(requestId: string, requesterUserId: string): Promise<MemoryPromptRequest> {
  const { data, error } = await supabase
    .from('memory_prompt_requests')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('requester_user_id', requesterUserId)
    .eq('status', 'pending')
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Could not cancel memory prompt.');
  return rowToMemoryPromptRequest(data);
}

export async function completeMemoryPromptRequest(reviewerUserId: string, input: CompleteMemoryPromptRequestInput): Promise<{ request: MemoryPromptRequest; wallPost: WallPost }> {
  const { data: requestRow, error: requestError } = await supabase
    .from('memory_prompt_requests')
    .select('*')
    .eq('id', input.requestId)
    .eq('recipient_user_id', reviewerUserId)
    .eq('status', 'pending')
    .single();

  if (requestError || !requestRow) throw new Error(requestError?.message ?? 'Memory prompt is no longer available.');
  const request = rowToMemoryPromptRequest(requestRow);
  if (isPromptExpired(request)) throw new Error('This memory prompt has expired.');
  const responseBody = cleanOptionalText(input.body, 1200);
  const responseSong = input.song ?? null;
  const responseVoice = input.voice ?? null;
  const responseMovie = input.movie ?? null;
  const responseLocationName = cleanOptionalText(input.locationName, 120);
  const responsePostType = input.responsePostType ?? null;
  const responseImageUri = input.imageUri ?? null;
  const responseVideoUri = input.videoUri ?? null;
  const referencedWallPostId = input.referencedWallPostId ?? null;

  validateCompletion(request.promptType, responseBody, responseSong, responseVoice, referencedWallPostId, responsePostType, responseImageUri, responseVideoUri, responseMovie, responseLocationName);

  const uploadedResponseImage = request.promptType === 'photo' && responseImageUri
    ? await uploadMemoryImageVariants(responseImageUri, { prefix: reviewerUserId })
    : null;
  const uploadedResponseVideoUri = request.promptType === 'photo' && responseVideoUri
    ? await uploadMemoryVideo(responseVideoUri, { prefix: reviewerUserId })
    : null;
  const completedPostType = request.promptType === 'song'
    ? 'song'
    : request.promptType === 'voice'
      ? 'voice'
      : request.promptType === 'movie'
        ? 'movie'
        : request.promptType === 'photo'
          ? responsePostType ?? 'media'
          : 'note';

  const { data: wallPostRow, error: wallPostError } = await supabase
    .from('wall_posts')
    .insert({
      author_user_id: reviewerUserId,
      subject_user_id: request.requesterUserId,
      subject_contact_id: null,
      visibility: 'visible_to_subject',
      post_type: completedPostType,
      body: responseBody ?? '',
      image_path: uploadedResponseImage?.imageUri ?? null,
      image_thumb_path: uploadedResponseImage?.imageThumbUri ?? null,
      video_path: uploadedResponseVideoUri,
      video_muted: input.videoMuted ?? false,
      memory_date: new Date().toISOString().slice(0, 10),
      location_name: request.promptType === 'location' ? responseLocationName : null,
      ...songToWallPostDbColumns(request.promptType === 'song' ? responseSong : null),
      ...voiceToWallPostDbColumns(responseVoice),
      ...(request.promptType === 'movie' && responseMovie ? movieToDbColumns(responseMovie) : {}),
      memory_prompt_request_id: request.id,
      referenced_wall_post_id: request.promptType === 'photo_reference' ? referencedWallPostId : null,
      prompt_text: request.promptText,
      prompt_type: request.promptType,
      ...voiceToPromptQuestionDbColumns(request.promptVoice),
    })
    .select()
    .single();

  if (wallPostError || !wallPostRow) throw new Error(wallPostError?.message ?? 'Could not create prompt response.');
  const wallPost = rowToWallPost(wallPostRow);

  const { data: completedRow, error: updateError } = await supabase
    .from('memory_prompt_requests')
    .update({
      status: 'completed',
      response_body: responseBody,
      ...songToPromptResponseDbColumns(request.promptType === 'song' ? responseSong : null),
      ...voiceToPromptResponseDbColumns(responseVoice),
      referenced_wall_post_id: request.promptType === 'photo_reference' ? referencedWallPostId : null,
      completed_wall_post_id: wallPost.id,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', request.id)
    .eq('recipient_user_id', reviewerUserId)
    .eq('status', 'pending')
    .select()
    .single();

  if (updateError || !completedRow) throw new Error(updateError?.message ?? 'Could not finish memory prompt.');
  const completedRequest = rowToMemoryPromptRequest(completedRow);
  const reviewerName = await getDisplayName(reviewerUserId);

  createNotification({
    recipientUserId: completedRequest.requesterUserId,
    actorUserId: reviewerUserId,
    type: 'wall_post',
    referenceId: wallPost.id,
    metadata: {
      wallPostId: wallPost.id,
      memoryPromptRequestId: completedRequest.id,
      promptType: completedRequest.promptType,
      postType: wallPost.postType,
      source: 'memory_prompt_response',
    },
    message: `${reviewerName} answered your memory prompt`,
  }).catch((notificationError) => console.warn('[notification] memory prompt response insert failed:', notificationError));

  return { request: completedRequest, wallPost };
}

async function getDisplayName(userId: string) {
  const { data } = await supabase.from('profiles').select('display_name').eq('id', userId).single();
  return data?.display_name || 'Someone';
}

function validateCompletion(promptType: MemoryPromptType, body: string | null, song: CompleteMemoryPromptRequestInput['song'], voice: CompleteMemoryPromptRequestInput['voice'], referencedWallPostId: string | null, responsePostType: CompleteMemoryPromptRequestInput['responsePostType'], imageUri: string | null, videoUri: string | null, movie: CompleteMemoryPromptRequestInput['movie'], locationName: string | null) {
  if (promptType === 'song' && !song) throw new Error('Choose a song before sending.');
  if (promptType === 'voice' && !voice) throw new Error('Record a voice memory before sending.');
  if (promptType === 'text' && !hasTextOrVoice(body, voice)) throw new Error('Write or record a response before sending.');
  if (promptType === 'movie' && !movie) throw new Error('Choose a movie before sending.');
  if (promptType === 'location' && !locationName) throw new Error('Choose a location before sending.');
  if (promptType === 'photo') {
    if (responsePostType !== 'polaroid' && responsePostType !== 'media') throw new Error('Choose Memory Card or media before sending.');
    if (!imageUri && !videoUri) throw new Error('Choose a photo or video before sending.');
  }
  if (promptType === 'photo_reference' && !referencedWallPostId) throw new Error('Choose a photo memory before sending.');
}

function cleanRequiredText(value: string | null | undefined, emptyMessage: string, maxLength: number) {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(emptyMessage);
  return trimmed.slice(0, maxLength);
}

function cleanOptionalText(value: string | null | undefined, maxLength: number) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function isMissingTable(message: string, tableName: string) {
  return new RegExp(tableName, 'i').test(message) && /(does not exist|schema cache|not find|not found)/i.test(message);
}
