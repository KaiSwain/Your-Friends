import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../../../src/components/ActionButton';
import { AppScreen } from '../../../../src/components/AppScreen';
import { SongSearchPicker } from '../../../../src/components/SongSearchPicker';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../../src/features/theme/ThemeContext';
import { backOnce, replaceOnce } from '../../../../src/lib/navigationGuard';
import { compareWallPostsByMemoryDateDesc } from '../../../../src/lib/memoryDate';
import { protectTextFromFontClipping } from '../../../../src/theme/fontProtection';
import { radius, spacing } from '../../../../src/theme/tokens';
import type { SongAttachment, WallPost } from '../../../../src/types/domain';

export default function MemoryPromptResponseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ requestId?: string | string[] }>();
  const { currentUser } = useAuth();
  const { completeMemoryPromptRequest, getMemoryPromptRequestById, getUserById, getVisiblePostsByAuthor } = useSocialGraph();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const requestId = Array.isArray(params.requestId) ? params.requestId[0] : params.requestId;
  const request = requestId ? getMemoryPromptRequestById(requestId) : undefined;
  const requester = request ? getUserById(request.requesterUserId) : undefined;
  const [body, setBody] = useState('');
  const [selectedSong, setSelectedSong] = useState<SongAttachment | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const sharedPolaroids = useMemo(() => {
    if (!request || !currentUser) return [];
    const requesterPosts = getVisiblePostsByAuthor(request.requesterUserId).filter((post) => post.subjectUserId === currentUser.id);
    const myPosts = getVisiblePostsByAuthor(currentUser.id).filter((post) => post.subjectUserId === request.requesterUserId);
    return [...requesterPosts, ...myPosts]
      .filter((post, index, posts) => post.imageUri && posts.findIndex((candidate) => candidate.id === post.id) === index)
      .sort(compareWallPostsByMemoryDateDesc);
  }, [currentUser?.id, getVisiblePostsByAuthor, request?.requesterUserId]);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  const header = (
    <Pressable onPress={() => backOnce(router)} style={styles.backButton}>
      <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
    </Pressable>
  );

  async function handleSubmit() {
    if (!request || !currentUser) return;
    if (request.promptType === 'song' && !selectedSong) {
      setError('Choose a song first.');
      return;
    }
    if (request.promptType === 'text' && !body.trim()) {
      setError('Write a response first.');
      return;
    }
    if (request.promptType === 'photo_reference' && !selectedPostId) {
      setError('Choose a photo memory first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await completeMemoryPromptRequest(currentUser.id, {
        requestId: request.id,
        body,
        song: selectedSong,
        referencedWallPostId: selectedPostId,
      });
      replaceOnce(router, `/(app)/wall/${request.requesterUserId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not answer prompt.');
      setBusy(false);
    }
  }

  if (!request) {
    return (
      <AppScreen header={header} floatingHeaderOnScroll>
        <Text style={styles.title}>Prompt unavailable</Text>
        <Text style={styles.subtitle}>This prompt could not be opened.</Text>
      </AppScreen>
    );
  }

  if (request.recipientUserId !== currentUser.id) {
    return (
      <AppScreen header={header} floatingHeaderOnScroll>
        <Text style={styles.title}>Not your prompt</Text>
        <Text style={styles.subtitle}>This memory prompt belongs to another account.</Text>
      </AppScreen>
    );
  }

  if (request.status !== 'pending') {
    return (
      <AppScreen header={header} floatingHeaderOnScroll>
        <Text style={styles.title}>Already answered</Text>
        <Text style={styles.subtitle}>This prompt has already been handled.</Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen header={header} floatingHeaderOnScroll footer={<ActionButton label={busy ? 'Sending...' : 'Add to memory wall'} onPress={handleSubmit} disabled={busy} />}>
      <Text style={styles.title}>Answer Prompt</Text>
      <Text style={styles.subtitle}>{requester?.displayName ?? 'A friend'} asked you to add something to the wall.</Text>

      <View style={styles.promptCard}>
        <View style={styles.promptIcon}>
          <Ionicons name={iconForPromptType(request.promptType)} size={20} color={colors.accent} />
        </View>
        <View style={styles.promptBody}>
          <Text style={styles.promptLabel}>{labelForPromptType(request.promptType)}</Text>
          <Text style={styles.promptText}>{request.promptText}</Text>
        </View>
      </View>

      {request.promptType === 'song' ? (
        <View style={styles.section}>
          <SongSearchPicker selectedSong={selectedSong} onSelect={setSelectedSong} onRemove={() => setSelectedSong(null)} />
        </View>
      ) : null}

      {request.promptType === 'photo_reference' ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Choose a photo memory</Text>
          <View style={styles.photoGrid}>
            {sharedPolaroids.length > 0 ? sharedPolaroids.map((post) => (
              <PhotoChoice key={post.id} post={post} selected={selectedPostId === post.id} onPress={() => setSelectedPostId(post.id)} />
            )) : (
              <Text style={styles.helperText}>No shared photo memories yet. Try a song or text prompt instead.</Text>
            )}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{request.promptType === 'text' ? 'Your answer' : 'Optional note'}</Text>
        <TextInput
          multiline
          value={body}
          onChangeText={setBody}
          placeholder={request.promptType === 'song' ? 'Why this song?' : request.promptType === 'photo_reference' ? 'Why this photo memory?' : 'Write your memory...'}
          placeholderTextColor={colors.inkMuted}
          style={styles.responseInput}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AppScreen>
  );
}

function PhotoChoice({ post, selected, onPress }: { post: WallPost; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={[photoChoiceStyles.choice, { borderColor: selected ? colors.accent : colors.line, backgroundColor: colors.paper }]} accessibilityRole="button" accessibilityState={{ selected }}>
      {post.imageUri ? <Image source={{ uri: post.imageUri }} style={photoChoiceStyles.image} /> : null}
      {selected ? (
        <View style={[photoChoiceStyles.check, { backgroundColor: colors.accent }]}>
          <Ionicons name="checkmark" size={14} color={colors.white} />
        </View>
      ) : null}
    </Pressable>
  );
}

function iconForPromptType(promptType: string) {
  if (promptType === 'photo_reference') return 'images-outline' as const;
  if (promptType === 'text') return 'chatbubble-ellipses-outline' as const;
  return 'musical-notes-outline' as const;
}

function labelForPromptType(promptType: string) {
  if (promptType === 'photo_reference') return 'Photo prompt';
  if (promptType === 'text') return 'Text prompt';
  return 'Song prompt';
}

const photoChoiceStyles = StyleSheet.create({
  choice: { width: 96, height: 116, borderRadius: radius.md, borderWidth: 2, overflow: 'hidden' },
  image: { width: '100%', height: '100%' },
  check: { position: 'absolute', right: 6, top: 6, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});

const makeStyles = (colors: ReturnType<typeof useTheme>['colors'], fonts: ReturnType<typeof useTheme>['fonts']) => StyleSheet.create({
  backButton: { paddingVertical: spacing.xs },
  backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
  title: { fontFamily: fonts.heading, fontSize: 32, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 32) },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
  section: { gap: spacing.sm },
  sectionLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.8 },
  promptCard: { flexDirection: 'row', gap: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.md },
  promptIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent + '14', alignItems: 'center', justifyContent: 'center' },
  promptBody: { flex: 1, gap: spacing.xs },
  promptLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.7 },
  promptText: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 27, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 22) },
  responseInput: { minHeight: 120, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.md, textAlignVertical: 'top', fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  helperText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.inkMuted },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.error },
});
