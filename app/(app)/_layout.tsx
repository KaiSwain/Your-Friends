// Import Expo Router's Stack component for the signed-in app group.
import { Stack } from 'expo-router';

// Export the layout shared by all main app screens.
export default function AppLayout() {
  // Return a simple stack with headers hidden for the in-app flow.
  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
} // End AppLayout after returning the app stack configuration.