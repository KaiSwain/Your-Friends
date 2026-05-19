import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function handleCors(req: Request) {
  return req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null;
}

export function requirePost(req: Request) {
  return req.method === 'POST' ? null : jsonResponse({ error: 'Method not allowed.' }, 405);
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export async function readJsonBody(req: Request) {
  try {
    return { ok: true as const, value: await req.json() };
  } catch {
    return { ok: false as const, response: jsonResponse({ error: 'Invalid request.' }, 400) };
  }
}

export function getSupabaseEnv() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return { supabaseUrl, serviceRoleKey };
}

export function createAdminClient() {
  const { supabaseUrl, serviceRoleKey } = getSupabaseEnv();
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function requireAuthenticatedUser(req: Request, message: string) {
  const admin = createAdminClient();
  if (!admin) return { ok: false as const, response: jsonResponse({ error: 'Supabase environment is not configured.' }, 500) };

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!token) return { ok: false as const, response: jsonResponse({ error: message }, 401) };

  const { data, error } = await admin.auth.getUser(token);
  const user = data.user;
  if (error || !user) return { ok: false as const, response: jsonResponse({ error: 'Could not verify your session.' }, 401) };

  return { ok: true as const, admin, user };
}
