import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

import { compressImage } from './compressImage';
import { supabase } from './supabase';

interface UploadMemoryImageOptions {
  compress?: boolean;
  prefix: string;
  randomSuffix?: boolean;
}

export interface UploadedMemoryImage {
  imageUri: string;
  imageThumbUri: string | null;
}

interface UploadMemoryVideoOptions {
  prefix: string;
  randomSuffix?: boolean;
}

interface UploadMemoryAudioOptions {
  prefix: string;
  randomSuffix?: boolean;
}

const UPLOAD_RETRY_DELAYS_MS = [0, 600, 1400] as const;
const MIN_UPLOAD_FILE_BYTES = 128;
const FULL_IMAGE_MAX_DIMENSION = 1080;
const FULL_IMAGE_QUALITY = 0.68;
const THUMB_IMAGE_MAX_DIMENSION = 320;
const THUMB_IMAGE_QUALITY = 0.55;

export async function uploadMemoryImage(localUri: string, options: UploadMemoryImageOptions) {
  const sourceUri = options.compress === false
    ? localUri
    : await compressImage(localUri, { maxDimension: FULL_IMAGE_MAX_DIMENSION, quality: FULL_IMAGE_QUALITY });
  const ext = options.compress === false ? getImageExtension(localUri) : 'jpg';
  const fileName = buildMemoryFileName(options.prefix, ext, options.randomSuffix);
  return uploadMemoryFile(sourceUri, fileName, getImageContentType(ext));
}

export async function uploadMemoryImageVariants(localUri: string, options: UploadMemoryImageOptions): Promise<UploadedMemoryImage> {
  if (options.compress === false) {
    const imageUri = await uploadMemoryImage(localUri, options);
    return { imageUri, imageThumbUri: imageUri };
  }

  const randomSuffix = options.randomSuffix ?? true;
  const fullSourceUri = await compressImage(localUri, { maxDimension: FULL_IMAGE_MAX_DIMENSION, quality: FULL_IMAGE_QUALITY });
  const thumbSourceUri = await compressImage(localUri, { maxDimension: THUMB_IMAGE_MAX_DIMENSION, quality: THUMB_IMAGE_QUALITY });
  const fullFileName = buildMemoryFileName(options.prefix, 'jpg', randomSuffix);
  const thumbFileName = buildMemoryFileName(`${options.prefix}/thumbs`, 'jpg', randomSuffix);
  const [imageUri, imageThumbUri] = await Promise.all([
    uploadMemoryFile(fullSourceUri, fullFileName, getImageContentType('jpg')),
    uploadMemoryFile(thumbSourceUri, thumbFileName, getImageContentType('jpg')),
  ]);
  return { imageUri, imageThumbUri };
}

export async function uploadMemoryVideo(localUri: string, options: UploadMemoryVideoOptions) {
  const ext = getVideoExtension(localUri);
  const fileName = buildMemoryFileName(options.prefix, ext, options.randomSuffix);
  return uploadMemoryFile(localUri, fileName, getVideoContentType(ext));
}

export async function uploadMemoryAudio(localUri: string, options: UploadMemoryAudioOptions) {
  const ext = getAudioExtension(localUri);
  const fileName = buildMemoryFileName(options.prefix, ext, options.randomSuffix);
  return uploadMemoryFile(localUri, fileName, getAudioContentType(ext));
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
  await assertUploadSourceExists(localUri);
  return withUploadRetry(async () => {
    const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: FileSystem.EncodingType.Base64 });
    if (!base64) throw new Error('The selected media file was empty. Please try again.');
    const { error } = await supabase.storage
      .from('Memories')
      .upload(fileName, decode(base64), { contentType, upsert: true });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from('Memories').getPublicUrl(fileName);
    return data.publicUrl;
  });
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
  if (ext === 'jpg') return 'image/jpeg';
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

export function getAudioExtension(uri: string) {
  const clean = uri.split('?')[0]?.toLowerCase() ?? '';
  if (clean.endsWith('.aac')) return 'aac';
  if (clean.endsWith('.mp3')) return 'mp3';
  if (clean.endsWith('.wav')) return 'wav';
  if (clean.endsWith('.caf')) return 'caf';
  return 'm4a';
}

export function getAudioContentType(ext: string) {
  if (ext === 'mp3') return 'audio/mpeg';
  if (ext === 'wav') return 'audio/wav';
  if (ext === 'aac') return 'audio/aac';
  if (ext === 'caf') return 'audio/x-caf';
  return 'audio/mp4';
}

async function assertUploadSourceExists(localUri: string) {
  if (/^https?:\/\//i.test(localUri)) return;
  const info = await FileSystem.getInfoAsync(localUri);
  if (!info.exists) {
    throw new Error('The selected media file is no longer available. Please try again.');
  }
  if (typeof info.size === 'number' && info.size < MIN_UPLOAD_FILE_BYTES) {
    throw new Error('The selected media file was empty. Please try again.');
  }
}

async function withUploadRetry<T>(operation: () => Promise<T>): Promise<T> {
  let lastError: unknown = null;
  for (const delayMs of UPLOAD_RETRY_DELAYS_MS) {
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      return await operation();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not upload media. Please try again.');
}
