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

export function normalizeAiCaptionContext(context: AiCaptionContext): AiCaptionContext {
  return {
    ...context,
    authorName: cleanText(context.authorName, 80) || 'Someone',
    subjectName: cleanText(context.subjectName, 80) || 'someone',
    memoryDate: cleanText(context.memoryDate, 60) || new Date().toISOString(),
    draftCaption: context.draftCaption ? cleanText(context.draftCaption, 180) : null,
    relationshipTags: cleanList(context.relationshipTags),
    facts: cleanList(context.facts),
    notes: cleanList(context.notes),
    previousCaptions: cleanList(context.previousCaptions),
    previousBackText: cleanList(context.previousBackText),
  };
}

export async function generateAiCaptions({ context, imageUri, tone }: GenerateAiCaptionsInput) {
  const localImageUri = await getLocalImageUriForAi(imageUri);
  const compressedUri = await compressImage(localImageUri);
  const base64 = await FileSystem.readAsStringAsync(compressedUri, { encoding: FileSystem.EncodingType.Base64 });
  const { data, error } = await supabase.functions.invoke<AiCaptionResponse>('generate-ai-caption', {
    body: {
      context: normalizeAiCaptionContext(context),
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