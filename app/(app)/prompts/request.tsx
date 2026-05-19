import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../../src/components/ActionButton';
import { AppScreen } from '../../../src/components/AppScreen';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import { backOnce, replaceOnce } from '../../../src/lib/navigationGuard';
import { protectTextFromFontClipping } from '../../../src/theme/fontProtection';
import { radius, spacing } from '../../../src/theme/tokens';
import type { MemoryPromptType, PeopleListItem } from '../../../src/types/domain';

const PROMPT_PRESETS: { type: MemoryPromptType; label: string; text: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: 'song', label: 'Song', text: 'What song reminds you of us?', icon: 'musical-notes-outline' },
  { type: 'text', label: 'Question', text: 'What memory should we never forget?', icon: 'chatbubble-ellipses-outline' },
  { type: 'photo_reference', label: 'Photo memory', text: 'Pick a photo memory that reminds you of us.', icon: 'images-outline' },
];

export default function MemoryPromptRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subjectId?: string | string[]; subjectType?: string | string[]; backTo?: string | string[] }>();
  const { currentUser } = useAuth();
  const { createMemoryPromptRequest, getPeopleListForUser } = useSocialGraph();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const subjectId = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId;
  const subjectType = Array.isArray(params.subjectType) ? params.subjectType[0] : params.subjectType;
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;

  const targets = useMemo(() => {
    if (!currentUser) return [];
    return getPeopleListForUser(currentUser.id).filter((person) => getRecipientUserId(person));
  }, [currentUser?.id, getPeopleListForUser]);
  const initialTarget = targets.find((target) => target.id === subjectId && target.entityType === subjectType) ?? targets[0] ?? null;
  const [selectedTargetKeys, setSelectedTargetKeys] = useState<string[]>(() => initialTarget ? [targetKey(initialTarget)] : []);
  const selectedTargets = useMemo(() => targets.filter((target) => selectedTargetKeys.includes(targetKey(target))), [selectedTargetKeys, targets]);
  const selectedRecipientIds = useMemo(() => Array.from(new Set(selectedTargets.map(getRecipientUserId).filter((id): id is string => Boolean(id)))), [selectedTargets]);
  const [promptType, setPromptType] = useState<MemoryPromptType>('song');
  const [promptText, setPromptText] = useState(PROMPT_PRESETS[0].text);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  const header = (
    <Pressable onPress={handleBack} style={styles.backButton}>
      <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
    </Pressable>
  );

  function handleBack() {
    if (backTo) {
      replaceOnce(router, backTo as any);
      return;
    }
    backOnce(router);
  }

  function selectPromptPreset(preset: (typeof PROMPT_PRESETS)[number]) {
    setPromptType(preset.type);
    setPromptText(preset.text);
  }

  function toggleTarget(target: PeopleListItem) {
    const key = targetKey(target);
    setSelectedTargetKeys((prev) => (
      prev.includes(key)
        ? prev.filter((targetKeyValue) => targetKeyValue !== key)
        : [...prev, key]
    ));
  }

  async function handleSend() {
    if (!currentUser) return;
    if (selectedRecipientIds.length === 0) {
      setError('Choose at least one friend.');
      return;
    }
    if (!promptText.trim()) {
      setError('Write a prompt first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await Promise.all(selectedRecipientIds.map((recipientUserId) =>
        createMemoryPromptRequest(currentUser.id, {
          recipientUserId,
          promptType,
          promptText,
        }),
      ));
      replaceOnce(router, backTo ? (backTo as any) : '/friends');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send prompt.');
      setBusy(false);
    }
  }

  return (
    <AppScreen header={header} floatingHeaderOnScroll footer={<ActionButton label={busy ? 'Sending...' : selectedRecipientIds.length > 1 ? `Send to ${selectedRecipientIds.length} friends` : 'Send prompt'} onPress={handleSend} disabled={busy || selectedRecipientIds.length === 0} />}>
      <Text style={styles.title}>Send a Memory Prompt</Text>
      <Text style={styles.subtitle}>Ask friends to answer with a song, a note, or a photo memory from your shared wall.</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Ask {selectedRecipientIds.length > 0 ? `(${selectedRecipientIds.length} selected)` : ''}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.targetScroll}>
          {targets.map((target) => {
            const active = selectedTargetKeys.includes(targetKey(target));
            return (
              <Pressable key={targetKey(target)} onPress={() => toggleTarget(target)} style={[styles.targetChip, active && styles.targetChipActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
                <View style={[styles.targetAvatar, { backgroundColor: target.avatarColor }]}>
                  {target.imageUri ? <Image source={{ uri: target.imageUri }} style={styles.targetAvatarImage} /> : <Text style={styles.targetInitials}>{getInitials(target.title)}</Text>}
                  {active ? (
                    <View style={styles.targetCheck}>
                      <Ionicons name="checkmark" size={12} color={colors.white} />
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.targetChipText, active && styles.targetChipTextActive]} numberOfLines={1}>{target.title}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Prompt type</Text>
        <View style={styles.typeGrid}>
          {PROMPT_PRESETS.map((preset) => {
            const active = promptType === preset.type;
            return (
              <Pressable key={preset.type} onPress={() => selectPromptPreset(preset)} style={[styles.typeCard, active && styles.typeCardActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
                <Ionicons name={preset.icon} size={20} color={active ? colors.white : colors.accent} />
                <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{preset.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Prompt</Text>
        <TextInput
          multiline
          value={promptText}
          onChangeText={setPromptText}
          placeholder="Write the question you want them to answer..."
          placeholderTextColor={colors.inkMuted}
          style={styles.promptInput}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AppScreen>
  );
}

function getRecipientUserId(target: PeopleListItem) {
  return target.entityType === 'user' ? target.id : target.linkedUserId ?? null;
}

function targetKey(target: PeopleListItem) {
  return `${target.entityType}:${target.id}`;
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
}

const makeStyles = (colors: ReturnType<typeof useTheme>['colors'], fonts: ReturnType<typeof useTheme>['fonts']) => StyleSheet.create({
  backButton: { paddingVertical: spacing.xs },
  backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
  title: { fontFamily: fonts.heading, fontSize: 32, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 32) },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
  section: { gap: spacing.sm },
  sectionLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.8 },
  targetScroll: { gap: spacing.sm, paddingRight: spacing.md },
  targetChip: { width: 104, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.sm, alignItems: 'center', gap: spacing.xs },
  targetChipActive: { borderColor: colors.accent, backgroundColor: colors.accent + '14' },
  targetAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  targetAvatarImage: { width: '100%', height: '100%' },
  targetCheck: { position: 'absolute', right: 0, bottom: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.paper },
  targetInitials: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.white },
  targetChipText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkSoft },
  targetChipTextActive: { color: colors.accent },
  typeGrid: { flexDirection: 'row', gap: spacing.sm },
  typeCard: { flex: 1, minHeight: 76, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.sm },
  typeCardActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  typeLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkSoft },
  typeLabelActive: { color: colors.white },
  promptInput: { minHeight: 130, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.md, textAlignVertical: 'top', fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.error },
});
