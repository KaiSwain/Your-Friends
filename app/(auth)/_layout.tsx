// Import Expo Router's Stack component for the auth route group.
import { Stack } from 'expo-router';

// Export the layout shared by all authentication screens.
export default function AuthLayout() {
  // Return a simple stack with headers hidden for the auth flow.
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
} // End AuthLayout after returning the auth stack configuration.