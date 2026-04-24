import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function NotFoundScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Ionicons name="compass-outline" size={48} color="#FAFAFA" style={{ marginBottom: 16 }} />
      <Text style={styles.title}>Page not found</Text>
      <Pressable style={styles.button} onPress={() => router.replace('/')}>
        <Text style={styles.buttonLabel}>Go Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#0A0A0A',
  },
  emoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FAFAFA',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#FAFAFA',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0A0A0A',
  },
});
