import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../../src/components/ActionButton';
import { AppScreen } from '../../../src/components/AppScreen';
import { TextOrVoiceComposer } from '../../../src/components/TextOrVoiceComposer';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { usePremium } from '../../../src/features/premium/PremiumContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import { backOnce, pushOnce, replaceOnce } from '../../../src/lib/navigationGuard';
import { showPromptPaywall } from '../../../src/lib/premiumGates';
import { protectTextFromFontClipping } from '../../../src/theme/fontProtection';
import { radius, spacing } from '../../../src/theme/tokens';
import type { MemoryPromptType, PeopleListItem, VoiceAttachment } from '../../../src/types/domain';

const ANSWER_TYPE_OPTIONS: { type: MemoryPromptType; label: string; defaultPrompt: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: 'song', label: 'Song', defaultPrompt: 'What song reminds you of us?', icon: 'musical-notes-outline' },
  { type: 'text', label: 'Note', defaultPrompt: 'What memory should we never forget?', icon: 'chatbubble-ellipses-outline' },
  { type: 'photo', label: 'Photo', defaultPrompt: 'Send me a photo that feels like us.', icon: 'camera-outline' },
];
const DEFAULT_PROMPT_TEXTS = ANSWER_TYPE_OPTIONS.map((option) => option.defaultPrompt);

export default function MemoryPromptRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subjectId?: string | string[]; subjectType?: string | string[]; backTo?: string | string[] }>();
  const { currentUser } = useAuth();
  const { isPremium } = usePremium();
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
  const [promptText, setPromptText] = useState(ANSWER_TYPE_OPTIONS[0].defaultPrompt);
  const [promptVoice, setPromptVoice] = useState<VoiceAttachment | null>(null);
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

  function selectAnswerType(option: (typeof ANSWER_TYPE_OPTIONS)[number]) {
    setPromptType(option.type);
    setPromptText((currentText) => {
      const trimmed = currentText.trim();
      if (!trimmed || DEFAULT_PROMPT_TEXTS.includes(trimmed)) return option.defaultPrompt;
      return currentText;
    });
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
    if (!isPremium) {
      showPromptPaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
    if (selectedRecipientIds.length === 0) {
      setError('Choose at least one friend.');
      return;
    }
    if (!promptText.trim() && !promptVoice) {
      setError('Write or record a prompt first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await Promise.all(selectedRecipientIds.map((recipientUserId) =>
        createMemoryPromptRequest(currentUser.id, {
          recipientUserId,
          promptType,
          promptText: promptText.trim() || 'Voice prompt',
          promptVoice,
        }),
      ));
      replaceOnce(router, backTo ? (backTo as any) : '/friends');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send prompt.');
      setBusy(false);
    }
  }

  return (
    <AppScreen header={header} floatingHeaderOnScroll footer={<ActionButton label={!isPremium ? 'Unlock Premium to send prompts' : busy ? 'Sending...' : selectedRecipientIds.length > 1 ? `Send to ${selectedRecipientIds.length} friends` : 'Send prompt'} onPress={handleSend} disabled={busy || (isPremium && selectedRecipientIds.length === 0)} />}>
      <Text style={styles.title}>Send a Memory Prompt</Text>
      <Text style={styles.subtitle}>Write any prompt, then choose how your friend should answer it.</Text>
      {!isPremium ? (
        <View style={styles.premiumNotice}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.accent} />
          <Text style={styles.premiumNoticeText}>Sending prompts is a Premium feature. You can still answer prompts friends send you.</Text>
        </View>
      ) : null}

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
        <Text style={styles.sectionLabel}>Answer format</Text>
        <View style={styles.typeGrid}>
          {ANSWER_TYPE_OPTIONS.map((option) => {
            const active = promptType === option.type;
            return (
              <Pressable key={option.type} onPress={() => selectAnswerType(option)} style={[styles.typeCard, active && styles.typeCardActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
                <Ionicons name={option.icon} size={20} color={active ? colors.white : colors.accent} />
                <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Prompt</Text>
        <TextOrVoiceComposer
          text={promptText}
          onTextChange={setPromptText}
          voice={promptVoice}
          onVoiceChange={(voice) => {
            setPromptVoice(voice);
            setError('');
          }}
          previewAuthorName={currentUser.displayName}
          placeholder="Write whatever you want them to answer..."
          voiceLabel="Record prompt"
          voiceHelperText="Say the prompt out loud. Friends will hear it before answering."
          textInputStyle={styles.promptInput}
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
  backButton: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center' },
  backLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  title: { fontFamily: fonts.heading, fontSize: 32, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 32) },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
  premiumNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.paper, padding: spacing.md },
  premiumNoticeText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.ink },
  section: { gap: spacing.sm },
  sectionLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.8 },
  targetScroll: { gap: spacing.sm, paddingRight: spacing.md },
  targetChip: { width: 104, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.sm, alignItems: 'center', gap: spacing.xs },
  targetChipActive: { borderColor: colors.accent, backgroundColor: colors.paper },
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
