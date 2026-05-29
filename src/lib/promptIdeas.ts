import { FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from './supabase';
import type { MemoryPromptType } from '../types/domain';

export type PromptIdeaCategory = 'funny' | 'deep' | 'nostalgic' | 'quick' | 'photo' | 'song';

export interface PromptIdea {
  category: PromptIdeaCategory | 'ai' | 'saved';
  promptType: MemoryPromptType;
  text: string;
}

export interface PromptIdeaRecipientContext {
  facts?: string[];
  name: string;
  note?: string | null;
  personalityTraits?: string[];
  relationshipTags?: string[];
  theirFactsAboutMe?: string[];
  theirNoteAboutMe?: string | null;
  theirPersonalityTraitsAboutMe?: string[];
  theirRelationshipTagsForMe?: string[];
}

interface GeneratePromptIdeasInput {
  mood?: PromptIdeaCategory | null;
  promptType: MemoryPromptType;
  recipients: PromptIdeaRecipientContext[];
}

interface PromptIdeasResponse {
  ideas?: unknown;
  error?: string;
}

export const PROMPT_IDEA_CATEGORIES: Array<{ id: PromptIdeaCategory; label: string }> = [
  { id: 'funny', label: 'Funny' },
  { id: 'deep', label: 'Deep' },
  { id: 'nostalgic', label: 'Nostalgic' },
  { id: 'quick', label: 'Quick' },
  { id: 'photo', label: 'Photo' },
  { id: 'song', label: 'Song' },
];

export const CURATED_PROMPT_IDEAS: PromptIdea[] = [
  { category: 'funny', promptType: 'text', text: 'What is the most us-coded thing we have ever done?' },
  { category: 'funny', promptType: 'text', text: 'What is an inside joke we need to preserve forever?' },
  { category: 'funny', promptType: 'photo', text: 'Send a photo that sums up our friendship energy.' },
  { category: 'deep', promptType: 'text', text: 'What is one tiny moment with us that stuck with you?' },
  { category: 'deep', promptType: 'text', text: 'What is something you appreciate about our friendship but never say out loud?' },
  { category: 'deep', promptType: 'voice', text: 'Tell me a memory with us that still feels important.' },
  { category: 'nostalgic', promptType: 'text', text: 'What memory of us feels like it belongs in a scrapbook?' },
  { category: 'nostalgic', promptType: 'photo', text: 'Send a photo that takes you back to a specific season of our friendship.' },
  { category: 'nostalgic', promptType: 'song', text: 'What song reminds you of an older version of us?' },
  { category: 'quick', promptType: 'text', text: 'What is one word for our friendship lately?' },
  { category: 'quick', promptType: 'text', text: 'What is a random thing that reminded you of me this week?' },
  { category: 'quick', promptType: 'song', text: 'What song should I hear today?' },
  { category: 'photo', promptType: 'photo', text: 'Send a photo of something that made you think of us.' },
  { category: 'photo', promptType: 'photo', text: 'Send a photo you wish had a longer story behind it.' },
  { category: 'photo', promptType: 'text', text: 'What is one memory you wish we had a photo of?' },
  { category: 'song', promptType: 'song', text: 'What song feels like our current chapter?' },
  { category: 'song', promptType: 'song', text: 'What song would you put on a playlist about us?' },
  { category: 'song', promptType: 'text', text: 'What lyric reminds you of us?' },
];

export async function generatePromptIdeas(input: GeneratePromptIdeasInput): Promise<PromptIdea[]> {
  const { data, error } = await supabase.functions.invoke<PromptIdeasResponse>('generate-prompt-ideas', {
    body: {
      mood: input.mood,
      promptType: input.promptType,
      recipients: input.recipients.map(normalizeRecipient),
    },
  });

  if (error) throw new Error(await getPromptIdeaErrorMessage(error));
  if (data?.error) throw new Error(data.error);

  const ideas: PromptIdea[] = Array.isArray(data?.ideas)
    ? data.ideas
      .map((idea): PromptIdea | null => {
        if (typeof idea === 'string') return { category: 'ai' as const, promptType: input.promptType, text: cleanPromptText(idea) };
        if (!idea || typeof idea !== 'object') return null;
        const raw = idea as Record<string, unknown>;
        const text = cleanPromptText(raw.text);
        if (!text) return null;
        return {
          category: 'ai' as const,
          promptType: normalizePromptType(raw.promptType, input.promptType),
          text,
        };
      })
      .filter((idea): idea is PromptIdea => Boolean(idea))
    : [];

  if (ideas.length === 0) throw new Error('No prompt ideas came back. Try again.');
  return ideas.slice(0, 5);
}

function normalizeRecipient(recipient: PromptIdeaRecipientContext) {
  return {
    name: cleanString(recipient.name, 80) || 'a friend',
    relationshipTags: cleanList(recipient.relationshipTags ?? [], 6, 80),
    personalityTraits: cleanList(recipient.personalityTraits ?? [], 6, 80),
    facts: cleanList(recipient.facts ?? [], 5, 120),
    note: cleanString(recipient.note ?? '', 160),
    theirRelationshipTagsForMe: cleanList(recipient.theirRelationshipTagsForMe ?? [], 6, 80),
    theirPersonalityTraitsAboutMe: cleanList(recipient.theirPersonalityTraitsAboutMe ?? [], 6, 80),
    theirFactsAboutMe: cleanList(recipient.theirFactsAboutMe ?? [], 5, 120),
    theirNoteAboutMe: cleanString(recipient.theirNoteAboutMe ?? '', 160),
  };
}

function cleanList(items: string[], maxItems: number, maxLength: number) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const cleaned = cleanString(item, maxLength);
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= maxItems) break;
  }
  return result;
}

function cleanPromptText(value: unknown) {
  return cleanString(value, 240);
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';
}

function normalizePromptType(value: unknown, fallback: MemoryPromptType): MemoryPromptType {
  if (value === 'song' || value === 'text' || value === 'photo' || value === 'photo_reference' || value === 'voice') return value;
  return fallback;
}

async function getPromptIdeaErrorMessage(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (typeof body?.error === 'string' && body.error.trim()) return body.error;
    } catch {
      // Fall through.
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Could not generate prompt ideas right now.';
}
