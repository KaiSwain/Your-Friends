import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.101.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const moodInstructions: Record<string, string> = {
  funny: 'Make the prompts playful, specific, and easy to answer without being mean.',
  deep: 'Make the prompts emotionally thoughtful, sincere, and friendship-centered.',
  nostalgic: 'Make the prompts feel scrapbook-like, memory-rich, and reflective.',
  quick: 'Make the prompts very easy to answer in under a minute.',
  photo: 'Make the prompts invite a photo response or a visual memory.',
  song: 'Make the prompts invite a song response, playlist moment, lyric, or music memory.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const openAiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAiKey) return jsonResponse({ error: 'AI prompt ideas are not configured yet.' }, 501);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
  if (!supabaseUrl || !supabaseAnonKey) return jsonResponse({ error: 'Supabase environment is not configured.' }, 500);

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData?.user;
  if (authError || !user) return jsonResponse({ error: 'Sign in to generate prompt ideas.' }, 401);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('premium_until')
    .eq('id', user.id)
    .single();
  if (profileError) return jsonResponse({ error: 'Could not verify Premium.' }, 403);
  if (!isPremiumActive(profile?.premium_until)) return jsonResponse({ error: 'AI prompt ideas require Premium.' }, 402);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid request.' }, 400);
  }

  const promptType = normalizePromptType(payload?.promptType);
  const mood = normalizeMood(payload?.mood);
  const recipients = normalizeRecipients(payload?.recipients);
  const model = Deno.env.get('OPENAI_PROMPT_IDEA_MODEL') ?? 'gpt-4o-mini';
  const usesCompletionTokens = usesMaxCompletionTokens(model);
  const openAiBody: Record<string, unknown> = {
    model,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You write short question prompts for a private friendship memory app. The user sends prompts to friends, and the friend answers with a song, note, photo, or voice memory. Use both relationship perspectives when provided: how the requester describes the recipient, and how the recipient describes the requester. Make ideas personal enough to feel useful, but do not invent private facts. Avoid therapy language, corporate wording, hashtags, and generic prompts like "what is your favorite memory?" Return JSON only in this shape: {"ideas":[{"text":"prompt","promptType":"song|text|photo|photo_reference|voice"}]}.',
      },
      {
        role: 'user',
        content: buildPrompt({ mood, promptType, recipients }),
      },
    ],
  };

  openAiBody[usesCompletionTokens ? 'max_completion_tokens' : 'max_tokens'] = usesCompletionTokens ? 900 : 260;
  if (!usesCompletionTokens) openAiBody.temperature = 0.85;

  const openAiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(openAiBody),
  });

  if (!openAiResponse.ok) {
    const detail = await openAiResponse.text();
    console.error('[generate-prompt-ideas] OpenAI error', detail);
    return jsonResponse({ error: formatOpenAiError(openAiResponse.status, detail) });
  }

  const result = await openAiResponse.json();
  const content = extractOpenAiText(result);
  const ideas = parseIdeas(content, promptType);
  if (ideas.length === 0) {
    console.error('[generate-prompt-ideas] No ideas parsed', {
      model,
      finishReason: result?.choices?.[0]?.finish_reason,
      contentPreview: content.slice(0, 320),
    });
    return jsonResponse({ error: 'No prompt ideas came back. Try again.' });
  }

  return jsonResponse({ ideas });
});

function buildPrompt(input: { mood: string; promptType: string; recipients: Array<Record<string, unknown>> }) {
  return [
    `Answer format: ${input.promptType}.`,
    `Mood/category: ${input.mood}. ${moodInstructions[input.mood]}`,
    'Write exactly 5 distinct prompt ideas.',
    'Each prompt should be one sentence, under 120 characters if possible, and easy to tap into a composer.',
    'If the answer format is song, strongly steer toward a song or lyric answer.',
    'If the answer format is photo, strongly steer toward a photo response.',
    'If the answer format is text, make it answerable as a short note.',
    'If the answer format is voice, make it natural to answer out loud.',
    'Use both directions of recipient context as gentle flavor: requester-to-recipient and recipient-to-requester.',
    'Relationship tags from both sides are especially important for tone, closeness, and wording.',
    'Do not reveal private profile details directly. Use facts, notes, and traits only to choose better prompt angles.',
    `Recipient context JSON: ${JSON.stringify(input.recipients)}`,
  ].join('\n');
}

function normalizeRecipients(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 5).map((recipient) => {
    const raw = recipient && typeof recipient === 'object' ? recipient as Record<string, unknown> : {};
    return {
      name: cleanString(raw.name, 80) || 'a friend',
      relationshipTags: cleanList(raw.relationshipTags, 6, 80),
      personalityTraits: cleanList(raw.personalityTraits, 6, 80),
      facts: cleanList(raw.facts, 5, 120),
      note: cleanString(raw.note, 160),
      theirRelationshipTagsForMe: cleanList(raw.theirRelationshipTagsForMe, 6, 80),
      theirPersonalityTraitsAboutMe: cleanList(raw.theirPersonalityTraitsAboutMe, 6, 80),
      theirFactsAboutMe: cleanList(raw.theirFactsAboutMe, 5, 120),
      theirNoteAboutMe: cleanString(raw.theirNoteAboutMe, 160),
    };
  });
}

function cleanList(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of value) {
    const cleaned = cleanString(item, maxLength);
    const key = cleaned.toLowerCase();
    if (!cleaned || seen.has(key)) continue;
    seen.add(key);
    result.push(cleaned);
    if (result.length >= maxItems) break;
  }
  return result;
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength) : '';
}

function normalizeMood(value: unknown) {
  return typeof value === 'string' && value in moodInstructions ? value : 'funny';
}

function normalizePromptType(value: unknown) {
  if (value === 'song' || value === 'text' || value === 'photo' || value === 'photo_reference' || value === 'voice') return value;
  return 'text';
}

function usesMaxCompletionTokens(model: string) {
  return /^(gpt-5|o\d|o-|chatgpt-4o)/i.test(model);
}

function extractOpenAiText(result: any) {
  const content = result?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((part) => {
      if (typeof part === 'string') return part;
      if (!part || typeof part !== 'object') return '';
      const text = typeof part.text === 'string' ? part.text : part.content;
      return typeof text === 'string' ? text : '';
    })
    .filter(Boolean)
    .join('\n');
}

function parseIdeas(content: string, fallbackPromptType: string) {
  let rawIdeas: unknown = null;
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    rawIdeas = Array.isArray(parsed) ? parsed : parsed?.ideas;
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*"ideas"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        rawIdeas = JSON.parse(jsonMatch[0]).ideas;
      } catch {
        rawIdeas = cleaned.split('\n');
      }
    } else {
      rawIdeas = cleaned.split('\n');
    }
  }

  if (!Array.isArray(rawIdeas)) return [];
  const seen = new Set<string>();
  const ideas: Array<{ text: string; promptType: string }> = [];
  for (const idea of rawIdeas) {
    const raw = typeof idea === 'string'
      ? { text: idea, promptType: fallbackPromptType }
      : idea && typeof idea === 'object'
        ? idea as Record<string, unknown>
        : null;
    const text = cleanString(raw?.text, 240).replace(/^[-*\d.\s]+/, '').replace(/^['"]|['"]$/g, '').trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    ideas.push({ text, promptType: normalizePromptType(raw?.promptType) });
    if (ideas.length >= 5) break;
  }
  return ideas;
}

function formatOpenAiError(status: number, detail: string) {
  const fallback = `OpenAI could not write prompt ideas right now. Status ${status}.`;
  try {
    const parsed = JSON.parse(detail);
    const message = typeof parsed?.error?.message === 'string' ? parsed.error.message.trim() : '';
    if (!message) return fallback;
    return `OpenAI could not write prompt ideas: ${message}`;
  } catch {
    const cleaned = detail.replace(/\s+/g, ' ').trim();
    if (!cleaned) return fallback;
    return `OpenAI could not write prompt ideas: ${cleaned.slice(0, 220)}`;
  }
}

function isPremiumActive(value: string | null | undefined) {
  if (!value) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && time > Date.now();
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
