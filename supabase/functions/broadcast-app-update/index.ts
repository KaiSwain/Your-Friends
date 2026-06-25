import { handleCors, jsonResponse, readJsonBody, requireAuthenticatedUser, requirePost } from '../_shared/http.ts';

const DEFAULT_TITLE = 'Update available';
const DEFAULT_BODY = 'A new version of YourFriends is here — update now to get the latest features and fixes.';
const EXPO_BATCH_SIZE = 100;

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const methodError = requirePost(req);
  if (methodError) return methodError;

  // Only the official team-admin account may broadcast to everyone.
  const auth = await requireAuthenticatedUser(req, 'Sign in to broadcast.');
  if (!auth.ok) return auth.response;
  const { admin, user } = auth;

  const { data: callerProfile, error: callerError } = await admin
    .from('profiles')
    .select('is_official, is_team_admin')
    .eq('id', user.id)
    .single();
  if (callerError || !callerProfile?.is_official || !callerProfile?.is_team_admin) {
    return jsonResponse({ error: 'Only the official admin account can broadcast updates.' }, 403);
  }

  const body = await readJsonBody(req);
  if (!body.ok) return body.response;
  const payload = body.value;
  const title = typeof payload?.title === 'string' && payload.title.trim() ? payload.title.trim() : DEFAULT_TITLE;
  const message = typeof payload?.body === 'string' && payload.body.trim() ? payload.body.trim() : DEFAULT_BODY;
  const version = typeof payload?.version === 'string' && payload.version.trim() ? payload.version.trim() : null;

  // Collect every stored push token (paginate so we don't cap at the default 1000-row limit).
  const tokens = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from('profiles')
      .select('push_token')
      .not('push_token', 'is', null)
      .range(from, from + pageSize - 1);
    if (error) return jsonResponse({ error: 'Could not load push tokens.', detail: error.message }, 500);
    const rows = data ?? [];
    for (const row of rows) {
      const token = typeof row.push_token === 'string' ? row.push_token.trim() : '';
      // Expo tokens look like ExponentPushToken[...] or ExpoPushToken[...].
      if (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')) tokens.add(token);
    }
    if (rows.length < pageSize) break;
  }

  const allTokens = Array.from(tokens);
  if (allTokens.length === 0) return jsonResponse({ ok: true, recipientCount: 0, sentCount: 0 });

  let sentCount = 0;
  const errors: unknown[] = [];
  for (let i = 0; i < allTokens.length; i += EXPO_BATCH_SIZE) {
    const batch = allTokens.slice(i, i + EXPO_BATCH_SIZE);
    const messages = batch.map((to) => ({
      to,
      title,
      body: message,
      sound: 'default',
      data: { type: 'app_update', version },
    }));
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
      const result = await response.json().catch(() => null);
      if (response.ok) {
        sentCount += batch.length;
      } else {
        console.error('[broadcast-app-update] Expo error', result);
        errors.push(result);
      }
    } catch (error) {
      console.error('[broadcast-app-update] batch failed', error);
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  return jsonResponse({
    ok: errors.length === 0,
    recipientCount: allTokens.length,
    sentCount,
    failedBatches: errors.length,
  });
});
