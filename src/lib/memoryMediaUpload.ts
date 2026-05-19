import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

import { compressImage } from './compressImage';
import { supabase } from './supabase';

interface UploadMemoryImageOptions {
  compress?: boolean;
  prefix: string;
  randomSuffix?: boolean;
}

interface UploadMemoryVideoOptions {
  prefix: string;
  randomSuffix?: boolean;
}

export async function uploadMemoryImage(localUri: string, options: UploadMemoryImageOptions) {
  const sourceUri = options.compress === false ? localUri : await compressImage(localUri);
  const ext = options.compress === false ? getImageExtension(localUri) : 'jpg';
  const fileName = buildMemoryFileName(options.prefix, ext, options.randomSuffix);
  return uploadMemoryFile(sourceUri, fileName, getImageContentType(ext));
}

export async function uploadMemoryVideo(localUri: string, options: UploadMemoryVideoOptions) {
  const ext = getVideoExtension(localUri);
  const fileName = buildMemoryFileName(options.prefix, ext, options.randomSuffix);
  return uploadMemoryFile(localUri, fileName, getVideoContentType(ext));
}

export function uploadSelfAvatar(localUri: string, userId: string) {
  return uploadMemoryImage(localUri, {
    compress: false,
    prefix: `avatars/${userId}`,
    randomSuffix: false,
  });
}

export function uploadSelfProfileBackground(localUri: string, userId: string) {
  return uploadMemoryImage(localUri, {
    prefix: `profile-backgrounds/${userId}`,
    randomSuffix: false,
  });
}

export function uploadContactAvatar(localUri: string) {
  return uploadMemoryImage(localUri, { prefix: 'uploads' });
}

export function uploadContactProfileBackground(localUri: string) {
  return uploadMemoryImage(localUri, { prefix: 'profile-backgrounds' });
}

export function uploadContactProfileVideo(localUri: string) {
  return uploadMemoryVideo(localUri, { prefix: 'contact-hero-videos' });
}

export async function uploadMemoryFile(localUri: string, fileName: string, contentType: string) {
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
  const { error } = await supabase.storage
    .from('Memories')
    .upload(fileName, decode(base64), { contentType, upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('Memories').getPublicUrl(fileName);
  return data.publicUrl;
}

export function buildMemoryFileName(prefix: string, ext: string, randomSuffix = true) {
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
  const suffix = randomSuffix ? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}` : `${Date.now()}`;
  return cleanPrefix ? `${cleanPrefix}/${suffix}.${ext}` : `${suffix}.${ext}`;
}

export function getImageExtension(uri: string) {
  const clean = uri.split('?')[0]?.toLowerCase() ?? '';
  if (clean.endsWith('.png')) return 'png';
  if (clean.endsWith('.webp')) return 'webp';
  if (clean.endsWith('.jpeg')) return 'jpeg';
  return 'jpg';
}

export function getImageContentType(ext: string) {
  if (ext === 'jpg') return 'image/jpg';
  return `image/${ext}`;
}

export function getVideoExtension(uri: string) {
  const clean = uri.split('?')[0]?.toLowerCase() ?? '';
  if (clean.endsWith('.mov')) return 'mov';
  if (clean.endsWith('.m4v')) return 'm4v';
  if (clean.endsWith('.webm')) return 'webm';
  return 'mp4';
}

export function getVideoContentType(ext: string) {
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'webm') return 'video/webm';
  return 'video/mp4';
}
