import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '../src/features/auth/AuthContext';
import { useOnboarding } from '../src/features/onboarding/OnboardingContext';
import { useTheme } from '../src/features/theme/ThemeContext';

export default function IndexRoute() {
  const { isAuthenticated, loading } = useAuth();
  const { loaded: onboardingLoaded, hasCompletedOnboarding } = useOnboarding();
  const { colors } = useTheme();

  if (loading || !onboardingLoaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (!isAuthenticated) return <Redirect href="/(auth)/sign-in" />;
  if (!hasCompletedOnboarding) return <Redirect href="/(onboarding)/welcome" />;
  return <Redirect href="/(app)/friends" />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
