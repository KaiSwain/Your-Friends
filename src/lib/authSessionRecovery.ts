import type { AuthError, Session } from '@supabase/supabase-js';

import { isInvalidRefreshTokenError } from './authSessionErrors';
import { supabase } from './supabase';

export { isInvalidRefreshTokenError } from './authSessionErrors';

/** Clear a broken persisted session so the app can recover without noisy refresh errors. */
export async function clearInvalidAuthSession() {
  await supabase.auth.signOut({ scope: 'local' });
}

export async function recoverStoredAuthSession(): Promise<{ session: Session | null; cleared: boolean }> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error && isInvalidRefreshTokenError(error)) {
      await clearInvalidAuthSession();
      return { session: null, cleared: true };
    }
    return { session: data.session ?? null, cleared: false };
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      await clearInvalidAuthSession();
      return { session: null, cleared: true };
    }
    throw error;
  }
}

export function logAuthRecovery(error: AuthError | Error) {
  if (__DEV__ && isInvalidRefreshTokenError(error)) {
    console.info('[auth] Cleared stale session after invalid refresh token.');
    return;
  }
  console.warn('[auth] Session recovery failed:', error);
}
