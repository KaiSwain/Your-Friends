import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.101.1';
import { handleCors, jsonResponse, readJsonBody, requirePost } from '../_shared/http.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const methodError = requirePost(req);
  if (methodError) return methodError;

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Supabase environment is not configured.' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const authedSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: authData, error: authError } = await authedSupabase.auth.getUser();
  const user = authData?.user;
  if (authError || !user) return jsonResponse({ error: 'Sign in to send notifications.' }, 401);

  const body = await readJsonBody(req);
  if (!body.ok) return body.response;
  const payload = body.value;

  const notificationId = typeof payload?.notificationId === 'string' ? payload.notificationId : '';
  if (!notificationId) return jsonResponse({ error: 'notificationId is required.' }, 400);
  const titleOverride = typeof payload?.title === 'string' && payload.title.trim() ? payload.title.trim() : null;
  const bodyOverride = typeof payload?.body === 'string' && payload.body.trim() ? payload.body.trim() : null;

  const adminSupabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: notification, error: notificationError } = await adminSupabase
    .from('notifications')
    .select('id, recipient_user_id, actor_user_id, type, reference_id, message, metadata')
    .eq('id', notificationId)
    .single();
  if (notificationError || !notification) return jsonResponse({ error: 'Notification not found.' }, 404);
  if (notification.actor_user_id !== user.id) return jsonResponse({ error: 'Cannot send this notification.' }, 403);

  const { data: recipient, error: recipientError } = await adminSupabase
    .from('profiles')
    .select('push_token')
    .eq('id', notification.recipient_user_id)
    .single();
  if (recipientError) return jsonResponse({ error: 'Recipient not found.' }, 404);

  const pushToken = typeof recipient?.push_token === 'string' ? recipient.push_token : '';
  if (!pushToken) return jsonResponse({ ok: true, skipped: 'no_push_token' });

  const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: pushToken,
      title: titleOverride ?? pushTitleFor(notification.type),
      body: bodyOverride ?? notification.message,
      sound: 'default',
      data: {
        ...(isRecord(notification.metadata) ? notification.metadata : {}),
        notificationId: notification.id,
        type: notification.type,
        referenceId: notification.reference_id,
        actorUserId: notification.actor_user_id,
        recipientUserId: notification.recipient_user_id,
      },
    }),
  });

  const result = await pushResponse.json().catch(() => null);
  if (!pushResponse.ok) {
    console.error('[send-notification-push] Expo error', result);
    return jsonResponse({ error: 'Expo push send failed.', detail: result }, 502);
  }

  return jsonResponse({ ok: true, result });
});

function pushTitleFor(type: string) {
  if (type === 'calendar_event') return 'Calendar event';
  if (type === 'calendar_event_reaction') return 'Calendar reaction';
  if (type === 'friend_request') return 'Friend update';
  if (type === 'contact_update') return 'Profile update';
  if (type === 'wall_post') return 'New memory';
  if (type === 'memory_prompt_request') return 'Memory prompt';
  if (type === 'movie_review_request') return 'Movie prompt';
  if (type === 'memory_reply') return 'New reply';
  return 'YourFriends';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

