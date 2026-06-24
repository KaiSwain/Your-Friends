import 'react-native-gesture-handler';

import { Ionicons } from '@expo/vector-icons';
import { Caveat_400Regular, Caveat_700Bold } from '@expo-google-fonts/caveat';
import { Manrope_400Regular, Manrope_500Medium, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { Newsreader_600SemiBold } from '@expo-google-fonts/newsreader';
import { PermanentMarker_400Regular } from '@expo-google-fonts/permanent-marker';
import { PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '../src/features/auth/AuthContext';
import { PendingMemorySyncProvider } from '../src/features/memories/PendingMemorySyncProvider';
import { MusicPreferenceProvider } from '../src/features/music/MusicPreferenceContext';
import { OnboardingProvider } from '../src/features/onboarding/OnboardingContext';
import { PremiumProvider } from '../src/features/premium/PremiumContext';
import { PremiumThemeGuard } from '../src/features/premium/PremiumThemeGuard';
import { ThemeProvider, useTheme } from '../src/features/theme/ThemeContext';
import { captureException, initErrorReporting } from '../src/lib/errorReporting';
import { initializeMobileAds } from '../src/lib/initializeMobileAds';
import { asyncStoragePersister, queryClient } from '../src/lib/queryClient';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { parseAppDeepLink } from '../src/lib/appDeepLinks';
import { replaceOnce } from '../src/lib/navigationGuard';
import { colors as fallbackColors } from '../src/theme/tokens';

// Start crash reporting as early as possible (no-op until a DSN is configured).
initErrorReporting();

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const router = useRouter();
  useEffect(() => {
    captureException(error, { boundary: 'root' });
  }, [error]);
  return (
    <View style={errorStyles.container}>
      <Ionicons name="alert-circle-outline" size={48} color="#FAFAFA" style={{ marginBottom: 16 }} />
      <Text style={errorStyles.title}>Something went wrong</Text>
      <Text style={errorStyles.message}>{error.message}</Text>
      <Pressable style={errorStyles.button} onPress={retry}>
        <Text style={errorStyles.buttonLabel}>Try Again</Text>
      </Pressable>
      <Pressable style={errorStyles.linkButton} onPress={() => replaceOnce(router, '/')}>
        <Text style={errorStyles.linkLabel}>Go Home</Text>
      </Pressable>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#0A0A0A' },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: '#FAFAFA', marginBottom: 8 },
  message: { fontSize: 14, color: '#999', textAlign: 'center', marginBottom: 32, lineHeight: 20 },
  button: { backgroundColor: '#FAFAFA', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 24, marginBottom: 16 },
  buttonLabel: { fontSize: 16, fontWeight: '600', color: '#0A0A0A' },
  linkButton: { padding: 8 },
  linkLabel: { fontSize: 14, color: '#999', textDecorationLine: 'underline' },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Caveat_400Regular,
    Caveat_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_700Bold,
    Newsreader_600SemiBold,
    PermanentMarker_400Regular,
    PlayfairDisplay_600SemiBold,
    SpaceGrotesk_500Medium,
  });

  useEffect(() => {
    initializeMobileAds();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={fallbackColors.accent} size="large" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: asyncStoragePersister, maxAge: 7 * 24 * 60 * 60 * 1000 }}
      >
        <ThemeProvider>
          <MusicPreferenceProvider>
            <AuthProvider>
              <OnboardingProvider>
                <PremiumProvider>
                  <PremiumThemeGuard>
                    <PendingMemorySyncProvider>
                      <ThemedStack />
                    </PendingMemorySyncProvider>
                  </PremiumThemeGuard>
                </PremiumProvider>
              </OnboardingProvider>
            </AuthProvider>
          </MusicPreferenceProvider>
        </ThemeProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}

function ThemedStack() {
  const { colors, resolvedMode } = useTheme();

  return (
    <>
      <ReferralLinkCapture />
      <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(app)" />
      </Stack>
      <OfflineBanner />
    </>
  );
}

function ReferralLinkCapture() {
  const router = useRouter();

  useEffect(() => {
    function captureReferralCode(event: { url: string | null }) {
      const link = parseAppDeepLink(event.url);
      if (link.type === 'password-recovery') {
        replaceOnce(router, {
          pathname: '/(auth)/reset-password',
          params: { recoveryUrl: encodeURIComponent(link.recoveryUrl) },
        });
        return;
      }
      if (link.type === 'friend-invite') {
        return;
      }
    }

    const sub = Linking.addEventListener('url', captureReferralCode);
    Linking.getInitialURL().then((url) => captureReferralCode({ url }));
    return () => sub.remove();
  }, [router]);

  return null;
}
const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: fallbackColors.canvas,
  },
});