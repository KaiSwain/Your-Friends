import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '../src/features/auth/AuthContext';
import { useTheme } from '../src/features/theme/ThemeContext';

export default function IndexRoute() {
  const { isAuthenticated, loading } = useAuth();
  const { colors } = useTheme();

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (isAuthenticated) return <Redirect href="/(app)/friends" />;
  return <Redirect href="/(auth)/sign-in" />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
