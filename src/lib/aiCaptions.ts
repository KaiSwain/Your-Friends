import * as FileSystem from 'expo-file-system/legacy';
import { FunctionsHttpError } from '@supabase/supabase-js';

import { compressImage } from './compressImage';
import { supabase } from './supabase';

export const AI_CAPTION_TONES = [
  { id: 'witty', label: 'Witty' },
  { id: 'funny', label: 'Funny' },
  { id: 'romantic', label: 'Romantic' },
  { id: 'sweet', label: 'Sweet' },
  { id: 'nostalgic', label: 'Nostalgic' },
  { id: 'casual', label: 'Casual' },
  { id: 'heartfelt', label: 'Heartfelt' },
  { id: 'playful', label: 'Playful' },
  { id: 'poetic', label: 'Poetic' },
  { id: 'hype', label: 'Hype' },
  { id: 'cozy', label: 'Cozy' },
  { id: 'sassy', label: 'Sassy' },
  { id: 'deadpan', label: 'Deadpan' },
  { id: 'cinematic', label: 'Cinematic' },
  { id: 'inside_joke', label: 'Inside Joke' },
  { id: 'flirty', label: 'Flirty' },
] as const;

export type AiCaptionTone = typeof AI_CAPTION_TONES[number]['id'];

export interface AiCaptionContext {
  authorName: string;
  subjectName: string;
  subjectType: 'user' | 'contact';
  memoryDate: string;
  draftCaption?: string | null;
  relationshipTags: string[];
  personalityTraits: string[];
  facts: string[];
  notes: string[];
  previousCaptions: string[];
  previousBackText: string[];
}

interface GenerateAiCaptionsInput {
  context: AiCaptionContext;
  imageUri: string;
  tone: AiCaptionTone;
}

interface AiCaptionResponse {
  captions?: unknown;
  error?: string;
}

const MAX_LIST_ITEMS = 10;
const MAX_ITEM_LENGTH = 180;
const AI_IMAGE_MAX_DIMENSION = 768;
const AI_IMAGE_QUALITY = 0.58;
const preparedImageCache = new Map<string, Promise<string>>();
const captionCache = new Map<string, Promise<string[]>>();

export function normalizeAiCaptionContext(context: AiCaptionContext): AiCaptionContext {
  return {
    ...context,
    authorName: cleanText(context.authorName, 80) || 'Someone',
    subjectName: cleanText(context.subjectName, 80) || 'someone',
    memoryDate: cleanText(context.memoryDate, 60) || new Date().toISOString(),
    draftCaption: context.draftCaption ? cleanText(context.draftCaption, 180) : null,
    relationshipTags: cleanList(context.relationshipTags),
    personalityTraits: cleanList(context.personalityTraits),
    facts: cleanList(context.facts),
    notes: cleanList(context.notes),
    previousCaptions: cleanList(context.previousCaptions),
    previousBackText: cleanList(context.previousBackText),
  };
}

export async function generateAiCaptions({ context, imageUri, tone }: GenerateAiCaptionsInput) {
  const normalizedContext = normalizeAiCaptionContext(context);
  const cacheKey = makeCaptionCacheKey(imageUri, tone, normalizedContext);
  const cachedCaptions = captionCache.get(cacheKey);
  if (cachedCaptions) return cachedCaptions;

  const captionRequest = requestAiCaptions(imageUri, normalizedContext, tone).catch((error) => {
    captionCache.delete(cacheKey);
    throw error;
  });
  captionCache.set(cacheKey, captionRequest);
  return captionRequest;
}

async function requestAiCaptions(imageUri: string, context: AiCaptionContext, tone: AiCaptionTone) {
  const base64 = await getPreparedImageBase64(imageUri);
  const { data, error } = await supabase.functions.invoke<AiCaptionResponse>('generate-ai-caption', {
    body: {
      context,
      image: { base64, mimeType: 'image/jpeg' },
      tone,
    },
  });

  if (error) throw new Error(await getAiCaptionErrorMessage(error));
  if (data?.error) throw new Error(data.error);

  const captions = Array.isArray(data?.captions)
    ? data.captions.filter((caption): caption is string => typeof caption === 'string' && caption.trim().length > 0)
    : [];

  if (captions.length === 0) throw new Error('No captions came back. Try again in a moment.');
  return captions.slice(0, 5);
}

async function getPreparedImageBase64(imageUri: string) {
  const cachedImage = preparedImageCache.get(imageUri);
  if (cachedImage) return cachedImage;

  const preparedImage = prepareImageBase64(imageUri).catch((error) => {
    preparedImageCache.delete(imageUri);
    throw error;
  });
  preparedImageCache.set(imageUri, preparedImage);
  return preparedImage;
}

async function prepareImageBase64(imageUri: string) {
  const localImageUri = await getLocalImageUriForAi(imageUri);
  const compressedUri = await compressImage(localImageUri, {
    maxDimension: AI_IMAGE_MAX_DIMENSION,
    quality: AI_IMAGE_QUALITY,
  });
  return FileSystem.readAsStringAsync(compressedUri, { encoding: FileSystem.EncodingType.Base64 });
}

function makeCaptionCacheKey(imageUri: string, tone: AiCaptionTone, context: AiCaptionContext) {
  return JSON.stringify({ imageUri, tone, context });
}

function cleanList(items: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const cleaned = cleanText(item, MAX_ITEM_LENGTH);
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= MAX_LIST_ITEMS) break;
  }
  return result;
}

function cleanText(value: string, maxLength: number) {
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

async function getLocalImageUriForAi(imageUri: string) {
  if (!/^https?:\/\//i.test(imageUri)) return imageUri;

  const baseDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!baseDirectory) return imageUri;

  const targetUri = `${baseDirectory}ai-caption-${Date.now()}.jpg`;
  const result = await FileSystem.downloadAsync(imageUri, targetUri);
  return result.uri;
}

async function getAiCaptionErrorMessage(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (typeof body?.error === 'string' && body.error.trim()) return body.error;
    } catch {
      // Fall through to the default error below.
    }
  }

  if (error instanceof Error && error.message) return error.message;
  return 'Could not write captions right now.';
}