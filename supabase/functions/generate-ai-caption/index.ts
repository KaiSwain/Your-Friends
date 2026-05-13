import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.101.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const toneInstructions: Record<string, string> = {
  witty: 'Make it clever, observant, and lightly funny without sounding forced.',
  funny: 'Make it playful and funny without being mean.',
  romantic: 'Make it affectionate, warm, and romantic without being explicit.',
  sweet: 'Make it gentle, sincere, and sweet.',
  nostalgic: 'Make it reflective and memory-soaked, like a keepsake.',
  casual: 'Make it relaxed, simple, and natural.',
  heartfelt: 'Make it emotionally honest, warm, and personal without becoming dramatic.',
  playful: 'Make it light, lively, and mischievous in a friendly way.',
  poetic: 'Make it lyrical and polished while staying short and natural.',
  hype: 'Make it celebratory, confident, and excited without sounding like an ad.',
  cozy: 'Make it soft, warm, and comforting.',
  sassy: 'Make it witty and confident without being cruel.',
  deadpan: 'Make it dry, understated, and quietly funny.',
  cinematic: 'Make it feel like a tiny movie caption, grounded in the photo.',
  inside_joke: 'Make it feel personal and specific, like it belongs to these people, without inventing private facts.',
  flirty: 'Make it charming and lightly flirty without being explicit.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const openAiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openAiKey) return jsonResponse({ error: 'AI captions are not configured yet.' }, 501);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
  if (!supabaseUrl || !supabaseAnonKey) return jsonResponse({ error: 'Supabase environment is not configured.' }, 500);

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData?.user;
  if (authError || !user) return jsonResponse({ error: 'Sign in to use AI captions.' }, 401);

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('premium_until')
    .eq('id', user.id)
    .single();
  if (profileError) return jsonResponse({ error: 'Could not verify Premium.' }, 403);
  if (!isPremiumActive(profile?.premium_until)) return jsonResponse({ error: 'AI captions require Premium.' }, 402);

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: 'Invalid request.' }, 400);
  }

  const imageBase64 = typeof payload?.image?.base64 === 'string' ? payload.image.base64 : '';
  const mimeType = typeof payload?.image?.mimeType === 'string' ? payload.image.mimeType : 'image/jpeg';
  if (!imageBase64) return jsonResponse({ error: 'A photo is required.' }, 400);

  const tone = typeof payload?.tone === 'string' && payload.tone in toneInstructions ? payload.tone : 'witty';
  const context = normalizeContext(payload?.context ?? {});
  const model = Deno.env.get('OPENAI_CAPTION_MODEL') ?? 'gpt-4o-mini';
  const usesCompletionTokens = usesMaxCompletionTokens(model);
  const openAiBody: Record<string, unknown> = {
    model,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You write short captions for a private friendship memory app. The photo is the source of concrete visual details. Relationship tags are a high-priority emotional lens: captions should clearly fit the relationship type without feeling like a tag list. Favor crisp wit, specific observations, and clever relationship-aware wording over generic sentimental captions. Witty means charming and observant, not random jokes. Never mention AI, prompts, private notes, metadata, or tags as metadata. Keep each caption under 90 characters. Avoid crude sexual content. Return JSON only in this shape: {"captions":["caption"]}.',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: buildPrompt(context, tone) },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' } },
        ],
      },
    ],
  };

  openAiBody[usesCompletionTokens ? 'max_completion_tokens' : 'max_tokens'] = usesCompletionTokens ? 1800 : 240;
  if (!usesCompletionTokens) openAiBody.temperature = 0.9;

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
    console.error('[generate-ai-caption] OpenAI error', detail);
    return jsonResponse({ error: formatOpenAiError(openAiResponse.status, detail) });
  }

  const result = await openAiResponse.json();
  const content = extractOpenAiText(result);
  const captions = parseCaptions(content);
  if (captions.length === 0) {
    console.error('[generate-ai-caption] No captions parsed', {
      model,
      finishReason: result?.choices?.[0]?.finish_reason,
      contentPreview: content.slice(0, 320),
    });
    return jsonResponse({ error: 'No captions came back. Try again.' });
  }

  return jsonResponse({ captions });
});

function buildPrompt(context: Record<string, unknown>, tone: string) {
  const relationshipTags = Array.isArray(context.relationshipTags) ? context.relationshipTags : [];
  return [
    `Tone: ${tone}. ${toneInstructions[tone]}`,
    'Write 5 distinct caption options for this polaroid.',
    'First, look closely at the visible photo: people, faces, pose, setting, action, colors, mood, objects, and composition.',
    'Make the captions feel grounded in what is visibly happening in the photo.',
    'Make the captions sharper and more memorable than generic lines like "making memories" or "good times".',
    'Use small clever twists, observational humor, or understated punchlines when the selected tone allows it.',
    `Relationship tags, high priority: ${relationshipTags.length > 0 ? relationshipTags.join(', ') : 'none'}.`,
    'Use those relationship tags strongly to choose the emotional angle, closeness, wording, and humor level.',
    'A New Friend caption should feel different from Best Friend, Partner, Sibling, Coworker, or Online Friend.',
    'It is okay to naturally say friend, best friend, partner, sibling, or similar if the tag supports it, but do not output hashtags or a literal tag list.',
    'Treat facts, notes, and previous memories as secondary flavor only.',
    'Do not force facts into the captions unless they clearly match the visible photo.',
    'Do not invent specific visual details that are not visible in the photo.',
    `Secondary context JSON: ${JSON.stringify(context)}`,
  ].join('\n');
}

function normalizeContext(value: Record<string, unknown>) {
  return {
    authorName: cleanString(value.authorName, 80) || 'Someone',
    subjectName: cleanString(value.subjectName, 80) || 'someone',
    subjectType: value.subjectType === 'user' ? 'user' : 'contact',
    memoryDate: cleanString(value.memoryDate, 60),
    draftCaption: cleanString(value.draftCaption, 180),
    relationshipTags: cleanList(value.relationshipTags, 6, 80),
    facts: cleanList(value.facts, 3, 120),
    notes: cleanList(value.notes, 2, 120),
    previousCaptions: cleanList(value.previousCaptions, 4, 120),
    previousBackText: cleanList(value.previousBackText, 2, 120),
  };
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

function parseCaptions(content: string) {
  let rawCaptions: unknown = null;
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    rawCaptions = Array.isArray(parsed) ? parsed : parsed?.captions;
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*"captions"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        rawCaptions = JSON.parse(jsonMatch[0]).captions;
      } catch {
        rawCaptions = cleaned.split('\n');
      }
    } else {
      rawCaptions = cleaned.split('\n');
    }
  }

  if (!Array.isArray(rawCaptions)) return [];
  return rawCaptions
    .filter((caption): caption is string => typeof caption === 'string')
    .map((caption) => caption.replace(/^[-*\d.\s]+/, '').replace(/^['"]|['"]$/g, '').trim())
    .filter(Boolean)
    .slice(0, 5);
}

function formatOpenAiError(status: number, detail: string) {
  const fallback = `OpenAI could not write captions right now. Status ${status}.`;
  try {
    const parsed = JSON.parse(detail);
    const message = typeof parsed?.error?.message === 'string' ? parsed.error.message.trim() : '';
    if (!message) return fallback;
    return `OpenAI could not write captions: ${message}`;
  } catch {
    const cleaned = detail.replace(/\s+/g, ' ').trim();
    if (!cleaned) return fallback;
    return `OpenAI could not write captions: ${cleaned.slice(0, 220)}`;
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