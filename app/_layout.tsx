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

import { AuthProvider } from '../src/features/auth/AuthContext';
import { OnboardingProvider } from '../src/features/onboarding/OnboardingContext';
import { PremiumProvider } from '../src/features/premium/PremiumContext';
import { ThemeProvider, useTheme } from '../src/features/theme/ThemeContext';
import { initializeMobileAds } from '../src/lib/initializeMobileAds';
import { asyncStoragePersister, queryClient } from '../src/lib/queryClient';
import { extractFriendCode } from '../src/lib/friendCode';
import { storeIncomingReferralCode } from '../src/lib/referrals';
import { colors as fallbackColors } from '../src/theme/tokens';

export function ErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  const router = useRouter();
  return (
    <View style={errorStyles.container}>
      <Ionicons name="alert-circle-outline" size={48} color="#FAFAFA" style={{ marginBottom: 16 }} />
      <Text style={errorStyles.title}>Something went wrong</Text>
      <Text style={errorStyles.message}>{error.message}</Text>
      <Pressable style={errorStyles.button} onPress={retry}>
        <Text style={errorStyles.buttonLabel}>Try Again</Text>
      </Pressable>
      <Pressable style={errorStyles.linkButton} onPress={() => router.replace('/')}>
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
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: asyncStoragePersister }}>
      <ThemeProvider>
        <AuthProvider>
          <OnboardingProvider>
            <PremiumProvider>
              <ThemedStack />
            </PremiumProvider>
          </OnboardingProvider>
        </AuthProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
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
    </>
  );
}

function ReferralLinkCapture() {
  useEffect(() => {
    function captureReferralCode(event: { url: string | null }) {
      const url = event.url ?? '';
      const looksLikeInvite = /[?&]code=/i.test(url) || /\/add-friend(?:[/?#]|$)/i.test(url);
      if (!looksLikeInvite) return;
      const code = extractFriendCode(url);
      if (code && /^[A-Z0-9]{6,12}$/.test(code)) {
        storeIncomingReferralCode(code).catch(() => {});
      }
    }

    const sub = Linking.addEventListener('url', captureReferralCode);
    Linking.getInitialURL().then((url) => captureReferralCode({ url }));
    return () => sub.remove();
  }, []);

  return null;
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: fallbackColors.canvas,
  },
});