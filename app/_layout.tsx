import { Ionicons } from '@expo/vector-icons';
import { Caveat_400Regular, Caveat_700Bold } from '@expo-google-fonts/caveat';
import { Manrope_400Regular, Manrope_500Medium, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { Newsreader_600SemiBold } from '@expo-google-fonts/newsreader';
import { PermanentMarker_400Regular } from '@expo-google-fonts/permanent-marker';
import { PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthProvider } from '../src/features/auth/AuthContext';
import { ThemeProvider, useTheme } from '../src/features/theme/ThemeContext';
import { asyncStoragePersister, queryClient } from '../src/lib/queryClient';
import { supabaseConfigError } from '../src/lib/supabase';
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

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={fallbackColors.accent} size="large" />
      </View>
    );
  }

  if (supabaseConfigError) {
    return (
      <View style={errorStyles.container}>
        <Ionicons name="cloud-offline-outline" size={48} color="#FAFAFA" style={{ marginBottom: 16 }} />
        <Text style={errorStyles.title}>App Configuration Missing</Text>
        <Text style={errorStyles.message}>
          {supabaseConfigError} Configure the matching EAS environment so release builds include your Supabase keys.
        </Text>
      </View>
    );
  }

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: asyncStoragePersister }}>
      <ThemeProvider>
        <AuthProvider>
          <ThemedStack />
        </AuthProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}

function ThemedStack() {
  const { colors, resolvedMode } = useTheme();

  return (
    <>
      <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: fallbackColors.canvas,
  },
});