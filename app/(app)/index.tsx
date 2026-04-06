// Import Redirect so this index route can immediately forward into the friends screen.
import { Redirect } from 'expo-router';

// Export the index route for the signed-in app group.
export default function AppIndexRoute() {
  // Always send users to the friends screen as the app landing page.
  return <Redirect href="/(app)/friends" />;
} // End AppIndexRoute after returning the redirect.