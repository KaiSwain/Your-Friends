// Import the Supabase session type so local state can describe the auth session correctly.
import { Session } from '@supabase/supabase-js';
// Import React helpers used to create and consume the auth context.
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

// Import the shared Supabase client configured for this app.
import { supabase } from '../../lib/supabase';
// Import the domain type used for the current signed-in user's profile data.
import { AppUser } from '../../types/domain';
// Import the helper that creates a friend code for a new account.
import { createFriendCode } from '../../lib/friendCode';
// Import the shared accent palette so new users can get a stable avatar color.
import { accentPalette } from '../../theme/tokens';

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
  // Expose a sign-out function for screens that need to log the user out.
  signOut: () => void;
  // Expose a sign-up function that creates both the auth account and the profile row.
  signUp: (
    // Accept the display name entered by the user.
    displayName: string,
    // Accept the email entered by the user.
    email: string,
    // Accept the password entered by the user.
    password: string,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
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
      setCurrentUser({
        // Copy the profile ID into the app user object.
        id: data.id,
        // Copy the stored email address.
        email: data.email,
        // Convert the snake_case database column into the camelCase app field.
        displayName: data.display_name,
        // Copy the friend code used for adding this user.
        friendCode: data.friend_code,
        // Copy the avatar accent color used by the UI.
        avatarColor: data.avatar_color,
        // Copy any stored avatar path value.
        avatarPath: data.avatar_path,
        // Use the stored profile facts array, or an empty array if none was saved.
        profileFacts: data.profile_facts ?? [],
        // Copy the creation timestamp as-is.
        createdAt: data.created_at,
      });
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

    // If sign-in returned a user, fetch the app-specific profile row next.
    if (data.user) {
      // Load the signed-in user's profile into context state.
      await fetchProfile(data.user.id);
    }

    // Return a success result once sign-in and profile loading are complete.
    return { ok: true as const };
  } // End signIn after returning either success or failure.

  // Create a new auth account and a matching profile row.
  async function signUp(displayName: string, email: string, password: string) {
    // Reject incomplete form input before sending anything to Supabase.
    if (!displayName.trim() || !email.trim() || !password.trim()) {
      // Return a readable validation error that the sign-up screen can show.
      return { ok: false as const, error: 'Fill in your name, email, and password.' };
    }

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

    // Generate a friend code for the new profile.
    const friendCode = createFriendCode(email, []);
    // Derive a stable number from the email so the app can pick a repeatable accent color.
    const colorIndex = email.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0);

    // Insert the matching app profile row after auth sign-up succeeds.
    const { error: profileError } = await supabase.from('profiles').insert({
      // Use the auth user's ID as the profile primary key.
      id: authData.user.id,
      // Store the normalized email address on the profile row too.
      email: email.trim().toLowerCase(),
      // Store the trimmed display name.
      display_name: displayName.trim(),
      // Store the generated friend code.
      friend_code: friendCode,
      // Pick an accent color from the shared palette using the derived color index.
      avatar_color: accentPalette[colorIndex % accentPalette.length],
      // Start the user with no profile facts yet.
      profile_facts: [],
    });

    // If creating the profile row fails, return that error to the UI.
    if (profileError) {
      // Return the database error in the same result shape used elsewhere.
      return { ok: false as const, error: profileError.message };
    }

    // Load the newly created profile into context state so the app is ready immediately.
    await fetchProfile(authData.user.id);

    // Return a success result after both auth and profile creation succeeded.
    return { ok: true as const };
  } // End signUp after returning either success or failure.

  // Sign the current user out and clear the local profile cache.
  async function signOut() {
    // Ask Supabase Auth to end the current session.
    await supabase.auth.signOut();
    // Immediately clear the local current user profile.
    setCurrentUser(null);
  } // End signOut after clearing auth-related local state.

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
        // Expose the sign-out action.
        signOut,
        // Expose the sign-up action.
        signUp,
      }}
    >
      {/* Render whatever child components were wrapped by this provider. */}
      {children}
    </AuthContext.Provider>
  );
} // End AuthProvider after returning the context provider component.

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