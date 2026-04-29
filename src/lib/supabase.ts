// Load a URL polyfill so Supabase can rely on URL APIs inside the React Native runtime.
import 'react-native-url-polyfill/auto';

// Import AsyncStorage so Supabase auth sessions can be stored on the device.
import AsyncStorage from '@react-native-async-storage/async-storage';
// Import the factory function that creates a configured Supabase client instance.
import { createClient } from '@supabase/supabase-js';

// Read the public Supabase project URL from Expo environment variables, or fall back to an empty string.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
// Read the public Supabase anon key from Expo environment variables, or fall back to an empty string.
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? '';

export const supabaseConfigError = !supabaseUrl
  ? 'Missing EXPO_PUBLIC_SUPABASE_URL in the app build environment.'
  : !supabaseAnonKey
    ? 'Missing EXPO_PUBLIC_SUPABASE_ANON_KEY in the app build environment.'
    : null;

const resolvedSupabaseUrl = supabaseConfigError ? 'https://placeholder.supabase.co' : supabaseUrl;
const resolvedSupabaseAnonKey = supabaseConfigError ? 'placeholder-anon-key' : supabaseAnonKey;

// Create and export one shared Supabase client so the rest of the app can reuse the same configuration.
export const supabase = createClient(resolvedSupabaseUrl, resolvedSupabaseAnonKey, {
  // Configure how Supabase auth behaves inside this mobile app.
  auth: {
    // Store auth session data in AsyncStorage so login state survives app restarts.
    storage: AsyncStorage,
    // Automatically refresh expired access tokens when Supabase can do so.
    autoRefreshToken: true,
    // Persist the session locally instead of treating auth as memory-only.
    persistSession: true,
    // Disable URL-based auth session detection because this is a React Native app, not a web browser flow.
    detectSessionInUrl: false,
  }, // End auth configuration object.
}); // End Supabase client creation and export.
