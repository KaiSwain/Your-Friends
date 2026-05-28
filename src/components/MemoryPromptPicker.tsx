import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { MemoryPrompt } from '../features/memoryPrompts/memoryPrompts';
import { radius, spacing } from '../theme/tokens';

interface MemoryPromptPickerProps {
  prompts: MemoryPrompt[];
  onSelectPrompt: (prompt: MemoryPrompt) => void;
}

export function MemoryPromptPicker({ prompts, onSelectPrompt }: MemoryPromptPickerProps) {
  const { colors, fonts } = useTheme();
  const styles = StyleSheet.create({
    section: {
      gap: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.paper,
      padding: spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    title: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: colors.ink,
    },
    subtitle: {
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 17,
      color: colors.ink,
    },
    scroll: {
      gap: spacing.xs,
      paddingRight: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    chipPressed: {
      backgroundColor: colors.paperMuted,
      transform: [{ scale: 0.99 }],
    },
    chipText: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: colors.ink,
    },
  });

  if (prompts.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
        <Text style={styles.title}>Need a memory idea?</Text>
      </View>
      <Text style={styles.subtitle}>
        Tap a prompt to start writing. You can edit it before saving.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {prompts.map((prompt) => (
          <Pressable
            key={prompt.id}
            onPress={() => onSelectPrompt(prompt)}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Use memory prompt ${prompt.label}`}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.accent} />
            <Text style={styles.chipText}>{prompt.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
