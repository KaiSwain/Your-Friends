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
import { backOnce, pushOnce, replaceOnce, shouldPopForBackTarget } from '../../../src/lib/navigationGuard';
import { showPromptPaywall } from '../../../src/lib/premiumGates';
import { CURATED_PROMPT_IDEAS, PROMPT_IDEA_CATEGORIES, generatePromptIdeas, type PromptIdea, type PromptIdeaCategory } from '../../../src/lib/promptIdeas';
import { protectTextFromFontClipping } from '../../../src/theme/fontProtection';
import { radius, spacing } from '../../../src/theme/tokens';
import type { MemoryPromptType, PeopleListItem, SavedMemoryPrompt, VoiceAttachment } from '../../../src/types/domain';

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
  const { createMemoryPromptRequest, createSavedMemoryPrompt, deleteSavedMemoryPrompt, getContactAboutMe, getContactById, getFriendFactsFor, getPeopleListForUser, savedMemoryPrompts } = useSocialGraph();
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
  const [selectedIdeaCategory, setSelectedIdeaCategory] = useState<PromptIdeaCategory>('funny');
  const [aiIdeas, setAiIdeas] = useState<PromptIdea[]>([]);
  const [ideasBusy, setIdeasBusy] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const categoryIdeas = useMemo(
    () => CURATED_PROMPT_IDEAS.filter((idea) => idea.category === selectedIdeaCategory),
    [selectedIdeaCategory],
  );
  const savedPromptMatch = useMemo(
    () => findSavedPrompt(savedMemoryPrompts, promptText, promptType),
    [promptText, promptType, savedMemoryPrompts],
  );

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  const header = (
    <Pressable onPress={handleBack} style={styles.backButton}>
      <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
    </Pressable>
  );

  function handleBack() {
    if (backTo) {
      if (shouldPopForBackTarget(backTo)) {
        backOnce(router);
        return;
      }
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

  function applyPromptIdea(idea: PromptIdea | SavedMemoryPrompt) {
    setPromptType(idea.promptType);
    setPromptText('text' in idea ? idea.text : idea.promptText);
    setPromptVoice(null);
    setError('');
  }

  async function handleSaveCurrentPrompt() {
    if (!currentUser || savingPrompt) return;
    const trimmed = promptText.trim();
    if (!trimmed) {
      setError('Write a prompt before saving.');
      return;
    }
    if (savedPromptMatch) {
      setError('That prompt is already saved.');
      return;
    }
    setSavingPrompt(true);
    setError('');
    try {
      await createSavedMemoryPrompt(currentUser.id, {
        promptType,
        promptText: trimmed,
        category: selectedIdeaCategory,
        source: DEFAULT_PROMPT_TEXTS.includes(trimmed) ? 'curated' : 'user',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save prompt.');
    } finally {
      setSavingPrompt(false);
    }
  }

  async function saveIdea(idea: PromptIdea, source: 'curated' | 'ai') {
    if (!currentUser) return;
    if (findSavedPrompt(savedMemoryPrompts, idea.text, idea.promptType)) {
      setError('That prompt is already saved.');
      return;
    }
    setError('');
    try {
      await createSavedMemoryPrompt(currentUser.id, {
        promptType: idea.promptType,
        promptText: idea.text,
        category: source === 'ai' ? selectedIdeaCategory : idea.category,
        source,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save prompt.');
    }
  }

  async function handleDeleteSavedPrompt(promptId: string) {
    if (!currentUser) return;
    setError('');
    try {
      await deleteSavedMemoryPrompt(promptId, currentUser.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove saved prompt.');
    }
  }

  async function handleGenerateIdeas() {
    if (ideasBusy) return;
    setIdeasBusy(true);
    setError('');
    try {
      const recipientContext = selectedTargets.map((target) => {
        const recipientUserId = getRecipientUserId(target);
        const myContactForThem = recipientUserId && currentUser
          ? getContactAboutMe(currentUser.id, recipientUserId)
          : target.entityType === 'contact'
            ? getContactById(target.id)
            : undefined;
        const theirContactForMe = recipientUserId && currentUser ? getContactAboutMe(recipientUserId, currentUser.id) : undefined;
        const facts = recipientUserId && currentUser ? getFriendFactsFor(currentUser.id, recipientUserId).map((fact) => fact.body) : myContactForThem?.facts ?? [];
        const theirFacts = recipientUserId && currentUser ? getFriendFactsFor(recipientUserId, currentUser.id).map((fact) => fact.body) : [];
        return {
          name: target.title,
          relationshipTags: myContactForThem?.tags.length ? myContactForThem.tags : target.tags,
          personalityTraits: myContactForThem?.personalityTraits ?? [],
          facts,
          note: myContactForThem?.note ?? target.note,
          theirRelationshipTagsForMe: theirContactForMe?.tags ?? [],
          theirPersonalityTraitsAboutMe: theirContactForMe?.personalityTraits ?? [],
          theirFactsAboutMe: theirFacts.length > 0 ? theirFacts : theirContactForMe?.facts ?? [],
          theirNoteAboutMe: theirContactForMe?.note ?? null,
        };
      });
      const ideas = await generatePromptIdeas({
        mood: selectedIdeaCategory,
        promptType,
        recipients: recipientContext,
      });
      setAiIdeas(ideas);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate ideas. Curated ideas still work.');
    } finally {
      setIdeasBusy(false);
    }
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
      if (shouldPopForBackTarget(backTo)) {
        backOnce(router);
        return;
      }
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
        <View style={styles.sectionHeadingRow}>
          <View>
            <Text style={styles.sectionLabel}>Prompt ideas</Text>
            <Text style={styles.sectionHelper}>Tap one to fill the composer, or save your own favorite.</Text>
          </View>
          <Pressable onPress={handleGenerateIdeas} disabled={ideasBusy} style={styles.generateButton} accessibilityRole="button">
            <Ionicons name="sparkles-outline" size={14} color={colors.accent} />
            <Text style={styles.generateButtonText}>{ideasBusy ? 'Thinking...' : 'AI ideas'}</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ideaCategoryScroll}>
          {PROMPT_IDEA_CATEGORIES.map((category) => {
            const active = selectedIdeaCategory === category.id;
            return (
              <Pressable key={category.id} onPress={() => setSelectedIdeaCategory(category.id)} style={[styles.ideaCategoryChip, active && styles.ideaCategoryChipActive]} accessibilityRole="button" accessibilityState={{ selected: active }}>
                <Text style={[styles.ideaCategoryText, active && styles.ideaCategoryTextActive]}>{category.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promptIdeaScroll}>
          {categoryIdeas.map((idea) => (
            <PromptIdeaCard key={`${idea.category}:${idea.text}`} colors={colors} fonts={fonts} idea={idea} onPress={() => applyPromptIdea(idea)} onSave={() => void saveIdea(idea, 'curated')} />
          ))}
        </ScrollView>

        {aiIdeas.length > 0 ? (
          <View style={styles.ideaSubsection}>
            <Text style={styles.savedTitle}>AI suggestions</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promptIdeaScroll}>
              {aiIdeas.map((idea) => (
                <PromptIdeaCard key={`ai:${idea.text}`} colors={colors} fonts={fonts} idea={idea} onPress={() => applyPromptIdea(idea)} onSave={() => void saveIdea(idea, 'ai')} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.savedHeaderRow}>
          <Text style={styles.savedTitle}>Saved</Text>
          <Pressable onPress={handleSaveCurrentPrompt} disabled={savingPrompt || Boolean(savedPromptMatch)} style={styles.saveCurrentButton} accessibilityRole="button">
            <Ionicons name={savedPromptMatch ? 'bookmark' : 'bookmark-outline'} size={14} color={savedPromptMatch ? colors.inkSoft : colors.accent} />
            <Text style={[styles.saveCurrentText, savedPromptMatch && styles.saveCurrentTextDisabled]}>{savedPromptMatch ? 'Saved' : savingPrompt ? 'Saving...' : 'Save this prompt'}</Text>
          </Pressable>
        </View>
        {savedMemoryPrompts.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promptIdeaScroll}>
            {savedMemoryPrompts.map((savedPrompt) => (
              <SavedPromptCard key={savedPrompt.id} colors={colors} fonts={fonts} prompt={savedPrompt} onPress={() => applyPromptIdea(savedPrompt)} onDelete={() => void handleDeleteSavedPrompt(savedPrompt.id)} />
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.emptySavedText}>Saved prompts will show up here for quick reuse.</Text>
        )}
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

function findSavedPrompt(savedPrompts: SavedMemoryPrompt[], promptText: string, promptType: MemoryPromptType) {
  const normalizedText = promptText.trim().toLowerCase();
  if (!normalizedText) return null;
  return savedPrompts.find((prompt) => prompt.promptType === promptType && prompt.promptText.trim().toLowerCase() === normalizedText) ?? null;
}

function getPromptTypeLabel(promptType: MemoryPromptType) {
  if (promptType === 'photo_reference') return 'Photo reply';
  return promptType.charAt(0).toUpperCase() + promptType.slice(1);
}

function PromptIdeaCard({
  colors,
  fonts,
  idea,
  onPress,
  onSave,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  fonts: ReturnType<typeof useTheme>['fonts'];
  idea: PromptIdea;
  onPress: () => void;
  onSave: () => void;
}) {
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <Pressable onPress={onPress} style={styles.promptIdeaCard} accessibilityRole="button">
      <View style={styles.promptIdeaTopRow}>
        <Text style={styles.promptIdeaPill}>{getPromptTypeLabel(idea.promptType)}</Text>
        <Pressable onPress={onSave} hitSlop={10} style={styles.promptIdeaSaveButton} accessibilityRole="button" accessibilityLabel="Save prompt idea">
          <Ionicons name="bookmark-outline" size={15} color={colors.accent} />
        </Pressable>
      </View>
      <Text style={styles.promptIdeaText} numberOfLines={4}>{idea.text}</Text>
    </Pressable>
  );
}

function SavedPromptCard({
  colors,
  fonts,
  prompt,
  onPress,
  onDelete,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
  fonts: ReturnType<typeof useTheme>['fonts'];
  prompt: SavedMemoryPrompt;
  onPress: () => void;
  onDelete: () => void;
}) {
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  return (
    <Pressable onPress={onPress} style={styles.promptIdeaCard} accessibilityRole="button">
      <View style={styles.promptIdeaTopRow}>
        <Text style={styles.promptIdeaPill}>{getPromptTypeLabel(prompt.promptType)}</Text>
        <Pressable onPress={onDelete} hitSlop={10} style={styles.promptIdeaSaveButton} accessibilityRole="button" accessibilityLabel="Remove saved prompt">
          <Ionicons name="close" size={16} color={colors.inkSoft} />
        </Pressable>
      </View>
      <Text style={styles.promptIdeaText} numberOfLines={4}>{prompt.promptText}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: ReturnType<typeof useTheme>['colors'], fonts: ReturnType<typeof useTheme>['fonts']) => StyleSheet.create({
  backButton: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center' },
  backLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  title: { fontFamily: fonts.heading, fontSize: 32, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 32) },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
  premiumNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.paper, padding: spacing.md },
  premiumNoticeText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.ink },
  section: { gap: spacing.sm },
  sectionHeadingRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  sectionLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.8 },
  sectionHelper: { marginTop: 2, maxWidth: 220, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.inkSoft },
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
  generateButton: { minHeight: 34, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  generateButtonText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent },
  ideaCategoryScroll: { gap: spacing.xs, paddingRight: spacing.md },
  ideaCategoryChip: { borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  ideaCategoryChipActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  ideaCategoryText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkSoft },
  ideaCategoryTextActive: { color: colors.white },
  promptIdeaScroll: { gap: spacing.sm, paddingRight: spacing.md },
  promptIdeaCard: { width: 212, minHeight: 126, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.md, gap: spacing.sm },
  promptIdeaTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  promptIdeaPill: { overflow: 'hidden', borderRadius: 999, backgroundColor: colors.accentSoft, paddingHorizontal: spacing.sm, paddingVertical: 4, fontFamily: fonts.bodyBold, fontSize: 11, color: colors.accent },
  promptIdeaSaveButton: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  promptIdeaText: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 19, color: colors.ink },
  ideaSubsection: { gap: spacing.sm },
  savedHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  savedTitle: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  saveCurrentButton: { minHeight: 32, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  saveCurrentText: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent },
  saveCurrentTextDisabled: { color: colors.inkSoft },
  emptySavedText: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
  promptInput: { minHeight: 130, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.md, textAlignVertical: 'top', fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.error },
});
