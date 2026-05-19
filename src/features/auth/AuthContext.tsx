import { Session } from '@supabase/supabase-js';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';

import { supabase } from '../../lib/supabase';
import { AppUser } from '../../types/domain';
import { createFriendCode, normalizeFriendCode } from '../../lib/friendCode';
import { uploadSelfAvatar, uploadSelfProfileBackground } from '../../lib/memoryMediaUpload';
import { applyReferralRewardForUser, clearIncomingReferralCode, consumeIncomingReferralCode } from '../../lib/referrals';
import { accentPalette } from '../../theme/tokens';
import { rowToUser } from '../social/mappers';

// Describe the full shape of the auth context that screens and components will consume.
interface AuthContextValue {
  // Expose the loaded profile for the signed-in user, or null when nobody is signed in.
  currentUser: AppUser | null;
  // Expose a simple boolean that tells the UI whether the user is fully authenticated.
  isAuthenticated: boolean;
  // Expose whether auth state is still being restored or loaded.
  loading: boolean;
  // Expose a sign-in function that returns either success or a readable error.
  signIn: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  requestPasswordReset: (email: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  recoverPasswordFromUrl: (url: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  updatePassword: (password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  // Expose a sign-out function for screens that need to log the user out.
  signOut: () => void;
  // Expose a delete-account function for App Store compliant self-service removal.
  deleteAccount: () => Promise<void>;
  // Expose a sign-up function that creates both the auth account and the profile row.
  signUp: (
    // Accept the display name entered by the user.
    displayName: string,
    // Accept the email entered by the user.
    email: string,
    // Accept the password entered by the user.
    password: string,
    // Optionally accept a referral code collected from a share link or typed manually.
    referralCode?: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  updateProfile: (updates: { displayName?: string; avatarLocalUri?: string | null; birthday?: string | null; profileFacts?: string[]; profileBgImageLocalUri?: string | null; profileBgImagePublic?: boolean }) => Promise<void>;
  signInWithApple: (referralCode?: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  signInWithGoogle: (idToken: string, referralCode?: string) => Promise<{ ok: true } | { ok: false; error: string }>;
} // End the AuthContextValue interface.

// Create the auth context with a null default so missing providers fail fast.
const AuthContext = createContext<AuthContextValue | null>(null);

// Export a provider component that owns auth state and makes it available to the app tree.
export function AuthProvider({ children }: { children: ReactNode }) {
  // Store the raw Supabase auth session separately from the richer profile object.
  const [session, setSession] = useState<Session | null>(null);
  // Store the app-specific user profile loaded from the `profiles` table.
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  // Store whether auth state is still being restored or fetched.
  const [loading, setLoading] = useState(true);

  // Restore any existing session on mount and subscribe to future auth state changes.
  useEffect(() => {
    // Ask Supabase for the current persisted session when the provider first mounts.
    supabase.auth.getSession().then(({ data: { session: current } }) => {
      // Save the returned session into local state.
      setSession(current);
      // If a session exists, fetch the matching profile row.
      if (current) {
        // Load the app-specific user profile using the auth user's ID.
        fetchProfile(current.user.id);
      } else {
        // If there is no session, mark loading as complete immediately.
        setLoading(false);
      }
    });

    // Subscribe to sign-in, sign-out, and token refresh events from Supabase Auth.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      // Keep the raw auth session in sync with Supabase.
      setSession(newSession);
      // If auth ends, also clear the app-level profile state.
      if (!newSession) {
        // Remove the loaded profile because nobody is signed in anymore.
        setCurrentUser(null);
        // End the loading state because auth status is now known.
        setLoading(false);
      }
      // Profile fetch for sign-in/sign-up is handled inside those functions directly.
    });

    // Return a cleanup function so React unsubscribes when the provider unmounts.
    return () => subscription.unsubscribe();
  }, []); // Run this setup effect only once when the provider mounts.

  // Load a profile row from the `profiles` table and map it into the app's user shape.
  async function fetchProfile(userId: string) {
    // Query the `profiles` table for exactly one row with the matching user ID.
    const { data, error } = await supabase
      // Read from the profiles table that stores app-specific user metadata.
      .from('profiles')
      // Select every column because the app needs the full profile shape.
      .select('*')
      // Filter the rows to the one whose `id` matches the provided user ID.
      .eq('id', userId)
      // Require exactly one matching row.
      .single();

    // If the query failed or returned no row, clear the current user profile.
    if (error || !data) {
      // Remove the app-level current user because the profile could not be loaded.
      setCurrentUser(null);
    } else {
      // Otherwise, map the Supabase row into the `AppUser` shape used by the app.
      setCurrentUser(rowToUser(data));
    } // End the profile mapping branch.

    // Mark auth loading as finished once the profile query completes.
    setLoading(false);
  } // End fetchProfile after updating current user and loading state.

  // Sign an existing user in with email and password.
  async function signIn(email: string, password: string) {
    // Reject empty credentials before making a network request.
    if (!email.trim() || !password.trim()) {
      // Return a structured error object the UI can show directly.
      return { ok: false as const, error: 'Enter an email and password.' };
    }

    // Ask Supabase Auth to sign in using the normalized email address and the supplied password.
    const { data, error } = await supabase.auth.signInWithPassword({
      // Trim whitespace and lowercase the email so stored auth values stay normalized.
      email: email.trim().toLowerCase(),
      // Pass the password through unchanged.
      password,
    });

    // If Supabase reports an auth error, return it in the shared result shape.
    if (error) {
      // Return the error message so the screen can render it.
      return { ok: false as const, error: error.message };
    }

    // If sign-in returned a user, ensure the app-specific profile row exists next.
    // This self-heals accounts where Auth succeeded but profile creation failed
    // during signup, which otherwise leaves the app stuck with no currentUser.
    if (data.user) {
      try {
        await ensureProfile(data.user.id, data.user.email ?? email.trim().toLowerCase());
      } catch (profileError) {
        return {
          ok: false as const,
          error: profileError instanceof Error ? profileError.message : 'Could not load your profile.',
        };
      }
    }

    // Return a success result once sign-in and profile loading are complete.
    return { ok: true as const };
  } // End signIn after returning either success or failure.

  async function requestPasswordReset(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return { ok: false as const, error: 'Enter your email address.' };
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: Linking.createURL('/(auth)/reset-password'),
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  }

  async function recoverPasswordFromUrl(url: string) {
    const params = parseAuthParams(url);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const tokenHash = params.get('token_hash');

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const };
    }

    if (tokenHash) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const };
    }

    return { ok: true as const };
  }

  async function updatePassword(password: string) {
    if (!password) return { ok: false as const, error: 'Enter a new password.' };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  }

  // Create a new auth account and a matching profile row.
  async function signUp(displayName: string, email: string, password: string, referralCode?: string) {
    // Reject incomplete form input before sending anything to Supabase.
    if (!email.trim() || !password.trim()) {
      // Return a readable validation error that the sign-up screen can show.
      return { ok: false as const, error: 'Fill in your email and password.' };
    }
    // Display name is optional at sign-up time — the onboarding flow collects it.
    // Fall back to the email local-part so the row is never empty.
    const resolvedDisplayName = displayName.trim() || email.trim().toLowerCase().split('@')[0] || 'friend';

    const referralCheck = await validateManualReferralCode(referralCode);
    if (!referralCheck.ok) return referralCheck;

    // Ask Supabase Auth to create a new auth account for this email and password.
    const { data: authData, error: authError } = await supabase.auth.signUp({
      // Normalize the email before creating the auth account.
      email: email.trim().toLowerCase(),
      // Pass along the user-entered password.
      password,
    });

    // If the auth sign-up step fails, return the error immediately.
    if (authError) {
      // Surface the Supabase error message to the UI.
      return { ok: false as const, error: authError.message };
    }

    // If Supabase did not return a user object, treat that as a failed sign-up.
    if (!authData.user) {
      // Return a generic failure message for this unexpected case.
      return { ok: false as const, error: 'Sign up failed. Try again.' };
    }

    // Derive a stable number from the email so the app can pick a repeatable accent color.
    const colorIndex = email.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0);

    // Insert the matching app profile row after auth sign-up succeeds.
    const profileResult = await insertProfileWithUniqueFriendCode({
      // Use the auth user's ID as the profile primary key.
      userId: authData.user.id,
      // Store the normalized email address on the profile row too.
      email: email.trim().toLowerCase(),
      // Store the trimmed display name.
      displayName: resolvedDisplayName,
      // Pick an accent color from the shared palette using the derived color index.
      avatarColor: accentPalette[colorIndex % accentPalette.length],
    });

    // If creating the profile row fails, return that error to the UI.
    if (!profileResult.ok) {
      // Return the database error in the same result shape used elsewhere.
      return { ok: false as const, error: profileResult.error };
    }

    const referralResult = await applyReferralForNewProfile(authData.user.id, profileResult.friendCode, referralCode);
    if (!referralResult.ok) return referralResult;

    // Load the newly created profile into context state so the app is ready immediately.
    await fetchProfile(authData.user.id);

    // Return a success result after both auth and profile creation succeeded.
    return { ok: true as const };
  } // End signUp after returning either success or failure.

  // Update the current user's profile (display name, avatar, facts).
  async function updateProfile(updates: { displayName?: string; avatarLocalUri?: string | null; birthday?: string | null; profileFacts?: string[]; profileBgImageLocalUri?: string | null; profileBgImagePublic?: boolean }) {
    if (!currentUser) throw new Error('Not signed in');
    const dbUpdate: Record<string, unknown> = {};
    if (updates.displayName !== undefined) dbUpdate.display_name = updates.displayName;
    if (updates.birthday !== undefined) dbUpdate.birthday = updates.birthday;
    if (updates.profileFacts !== undefined) dbUpdate.profile_facts = updates.profileFacts;
    if (updates.profileBgImagePublic !== undefined) dbUpdate.profile_bg_image_public = updates.profileBgImagePublic;

    if (updates.avatarLocalUri !== undefined) {
      if (updates.avatarLocalUri) {
        dbUpdate.avatar_path = await uploadSelfAvatar(updates.avatarLocalUri, currentUser.id);
      } else {
        dbUpdate.avatar_path = null;
      }
    }

    if (updates.profileBgImageLocalUri !== undefined) {
      if (updates.profileBgImageLocalUri) {
        dbUpdate.profile_bg_image_path = await uploadSelfProfileBackground(updates.profileBgImageLocalUri, currentUser.id);
      } else {
        dbUpdate.profile_bg_image_path = null;
        dbUpdate.profile_bg_image_public = false;
      }
    }

    if (Object.keys(dbUpdate).length === 0) return;
    const { error } = await supabase.from('profiles').update(dbUpdate).eq('id', currentUser.id);
    if (error) throw new Error(error.message);

    setCurrentUser((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        ...(updates.displayName !== undefined && { displayName: updates.displayName }),
        ...(updates.birthday !== undefined && { birthday: updates.birthday }),
        ...(updates.profileFacts !== undefined && { profileFacts: updates.profileFacts }),
        ...(typeof dbUpdate.avatar_path === 'string' && { avatarPath: dbUpdate.avatar_path }),
        ...(dbUpdate.avatar_path === null && { avatarPath: null }),
        ...(typeof dbUpdate.profile_bg_image_path === 'string' && { profileBgImagePath: dbUpdate.profile_bg_image_path }),
        ...(dbUpdate.profile_bg_image_path === null && { profileBgImagePath: null }),
        ...(dbUpdate.profile_bg_image_public !== undefined && { profileBgImagePublic: Boolean(dbUpdate.profile_bg_image_public) }),
      };
    });
  }

  async function validateManualReferralCode(referralCode?: string) {
    const code = normalizeFriendCode(referralCode ?? '');
    if (!code) return { ok: true as const };
    const { data, error } = await supabase.from('profiles').select('id').eq('friend_code', code).maybeSingle();
    if (error || !data?.id) return { ok: false as const, error: 'Referral code not found.' };
    return { ok: true as const };
  }

  async function applyReferralForNewProfile(userId: string, friendCode: string, referralCode?: string) {
    const manualCode = normalizeFriendCode(referralCode ?? '');
    const code = manualCode || await consumeIncomingReferralCode();
    if (!code) return { ok: true as const };

    const result = await applyReferralRewardForUser({
      refereeUserId: userId,
      refereeFriendCode: friendCode,
      referrerCode: code,
    });
    if (result.ok) {
      await clearIncomingReferralCode().catch(() => {});
      return { ok: true as const };
    }
    if (!manualCode) await clearIncomingReferralCode().catch(() => {});
    return manualCode ? { ok: false as const, error: result.error ?? 'Could not apply referral code.' } : { ok: true as const };
  }

  async function insertProfileWithUniqueFriendCode(input: {
    userId: string;
    email: string;
    displayName: string;
    avatarColor: string;
  }): Promise<{ ok: true; friendCode: string } | { ok: false; error: string }> {
    const { data: existingRows, error: existingError } = await supabase
      .from('profiles')
      .select('friend_code');
    if (existingError) return { ok: false, error: existingError.message };

    const existingCodes = (existingRows ?? [])
      .map((row) => typeof row.friend_code === 'string' ? row.friend_code : null)
      .filter((code): code is string => Boolean(code));

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const friendCode = createFriendCode(`${input.email}:${input.userId}:${attempt}`, existingCodes);
      const { error } = await supabase.from('profiles').insert({
        id: input.userId,
        email: input.email,
        display_name: input.displayName,
        friend_code: friendCode,
        avatar_color: input.avatarColor,
        profile_facts: [],
      });

      if (!error) return { ok: true, friendCode };
      if (!isFriendCodeCollision(error)) return { ok: false, error: error.message };
      existingCodes.push(friendCode);
    }

    return { ok: false, error: 'Could not create a unique friend code. Try again.' };
  }

  function isFriendCodeCollision(error: { code?: string; message?: string; details?: string | null }) {
    return error.code === '23505'
      && (
        error.message?.includes('profiles_friend_code_key') ||
        error.details?.includes('friend_code')
      );
  }

  async function ensureProfile(userId: string, email: string, displayName?: string, referralCode?: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      await fetchProfile(userId);
      return;
    }
    const colorIndex = email.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0);
    const profileResult = await insertProfileWithUniqueFriendCode({
      userId,
      email,
      displayName: displayName || email.split('@')[0],
      avatarColor: accentPalette[colorIndex % accentPalette.length],
    });
    if (!profileResult.ok) throw new Error(profileResult.error);
    await applyReferralForNewProfile(userId, profileResult.friendCode, referralCode);
    await fetchProfile(userId);
  }

  async function signInWithApple(referralCode?: string): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const referralCheck = await validateManualReferralCode(referralCode);
      if (!referralCheck.ok) return referralCheck;
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        return { ok: false, error: 'Apple Sign In failed — no identity token.' };
      }
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) return { ok: false, error: error.message };
      if (!data.user) return { ok: false, error: 'Apple Sign In failed.' };

      const name = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ')
        : undefined;
      await ensureProfile(data.user.id, data.user.email ?? '', name, referralCode);
      return { ok: true };
    } catch (e: any) {
      if (e.code === 'ERR_REQUEST_CANCELED') return { ok: false, error: '' };
      return { ok: false, error: e.message ?? 'Apple Sign In failed.' };
    }
  }

  async function signInWithGoogle(idToken: string, referralCode?: string): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const referralCheck = await validateManualReferralCode(referralCode);
      if (!referralCheck.ok) return referralCheck;
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (error) return { ok: false, error: error.message };
      if (!data.user) return { ok: false, error: 'Google Sign In failed.' };

      const meta = data.user.user_metadata;
      const name = meta?.full_name || meta?.name || undefined;
      await ensureProfile(data.user.id, data.user.email ?? '', name, referralCode);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message ?? 'Google Sign In failed.' };
    }
  }

  // Sign the current user out and clear the local profile cache.
  async function signOut() {
    // Ask Supabase Auth to end the current session.
    await supabase.auth.signOut();
    // Immediately clear the local current user profile.
    setCurrentUser(null);
  } // End signOut after clearing auth-related local state.

  async function deleteAccount() {
    if (!currentUser) throw new Error('Not signed in');
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) throw new Error(error.message);
    await supabase.auth.signOut();
    setCurrentUser(null);
  }

  // Render the provider so child components can read auth state and actions.
  return (
    // Provide the assembled auth value object to the entire subtree.
    <AuthContext.Provider
      // Build the context value from local state and action functions.
      value={{
        // Expose the loaded current user profile.
        currentUser,
        // Treat the user as authenticated only when both the raw session and the profile exist.
        isAuthenticated: Boolean(session) && Boolean(currentUser),
        // Expose whether auth is still loading.
        loading,
        // Expose the sign-in action.
        signIn,
        requestPasswordReset,
        recoverPasswordFromUrl,
        updatePassword,
        // Expose the sign-out action.
        signOut,
        // Expose self-service account deletion.
        deleteAccount,
        // Expose the sign-up action.
        signUp,
        // Expose the profile update action.
        updateProfile,
        signInWithApple,
        signInWithGoogle,
      }}
    >
      {/* Render whatever child components were wrapped by this provider. */}
      {children}
    </AuthContext.Provider>
  );
} // End AuthProvider after returning the context provider component.

function parseAuthParams(url: string) {
  const params = new URLSearchParams();
  const query = url.split('?')[1]?.split('#')[0] ?? '';
  const hash = url.split('#')[1] ?? '';
  for (const source of [query, hash]) {
    const sourceParams = new URLSearchParams(source);
    sourceParams.forEach((value, key) => params.set(key, value));
  }
  return params;
}

// Export a small hook so the rest of the app can consume auth state more ergonomically.
export function useAuth() {
  // Read the current auth context value.
  const context = useContext(AuthContext);

  // Fail fast if someone tries to use auth outside the provider tree.
  if (!context) {
    // Throwing here makes setup mistakes obvious during development.
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  // Return the non-null auth context to the caller.
  return context;
} // End useAuth after returning the context value.