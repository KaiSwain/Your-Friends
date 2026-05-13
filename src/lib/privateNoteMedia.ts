import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

import { compressImage } from './compressImage';
import { supabase } from './supabase';

const PRIVATE_NOTES_BUCKET = 'private_notes';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function uploadPrivateNoteImage(ownerUserId: string, noteId: string, localUri: string) {
  const compressed = await compressImage(localUri);
  const filePath = `${ownerUserId}/${noteId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  const base64 = await FileSystem.readAsStringAsync(compressed, { encoding: FileSystem.EncodingType.Base64 });
  const { error } = await supabase.storage
    .from(PRIVATE_NOTES_BUCKET)
    .upload(filePath, decode(base64), { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(formatPrivateNoteStorageError(error.message));
  return filePath;
}

export async function createPrivateNoteImageUrl(filePath: string) {
  const { data, error } = await supabase.storage
    .from(PRIVATE_NOTES_BUCKET)
    .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Failed to load private photo.');
  return data.signedUrl;
}

export async function removePrivateNoteImage(filePath: string) {
  const { error } = await supabase.storage.from(PRIVATE_NOTES_BUCKET).remove([filePath]);
  if (error) throw new Error(error.message);
}

function formatPrivateNoteStorageError(message: string) {
  if (/bucket not found/i.test(message)) {
    return `Supabase Storage bucket "${PRIVATE_NOTES_BUCKET}" was not found. Create that private bucket in Supabase Storage, then retry adding the photo.`;
  }
  if (/row-level security/i.test(message)) {
    return `Supabase Storage rejected this photo upload. Make sure the "${PRIVATE_NOTES_BUCKET}" bucket has the owner-folder RLS policies from supabase/schema.sql, then retry adding the photo.`;
  }
  return message;
}