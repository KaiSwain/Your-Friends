import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../../../src/components/ActionButton';
import { AppScreen } from '../../../../src/components/AppScreen';
import { TextOrVoiceComposer } from '../../../../src/components/TextOrVoiceComposer';
import { VoiceMemoryCard } from '../../../../src/components/VoiceMemoryCard';
import { WallPostCard } from '../../../../src/components/WallPostCard';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../../src/features/social/SocialGraphContext';
import { fetchWallPostById } from '../../../../src/features/social/queries';
import { useTheme } from '../../../../src/features/theme/ThemeContext';
import { backOnce } from '../../../../src/lib/navigationGuard';
import { uploadMemoryAudio } from '../../../../src/lib/memoryMediaUpload';
import { getNotificationIdsForWallPost, markProfileNotificationIdsRead } from '../../../../src/lib/profileNotificationIndicators';
import { useSyntheticNotificationReads } from '../../../../src/hooks/useSyntheticNotificationReads';
import { protectTextFromFontClipping } from '../../../../src/theme/fontProtection';
import { radius, semanticColors, spacing } from '../../../../src/theme/tokens';
import type { VoiceAttachment } from '../../../../src/types/domain';

export default function MemoryRepliesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ postId?: string | string[] }>();
  const { currentUser } = useAuth();
  const { addMemoryReply, deleteMemoryReply, getRepliesForWallPost, getUserById, getWallPostById, markNotificationRead, notifications } = useSocialGraph();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const cachedPost = postId ? getWallPostById(postId) : undefined;
  const fallbackPostQuery = useQuery({
    queryKey: ['social', 'wallPost', postId],
    queryFn: () => fetchWallPostById(postId!),
    enabled: Boolean(currentUser?.id && postId && !cachedPost),
  });
  const post = cachedPost ?? fallbackPostQuery.data ?? undefined;
  const replies = postId ? getRepliesForWallPost(postId) : [];
  const [replyDraft, setReplyDraft] = useState('');
  const [replyVoice, setReplyVoice] = useState<VoiceAttachment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { markSyntheticRead } = useSyntheticNotificationReads(currentUser?.id ?? null);

  useEffect(() => {
    if (!postId) return;
    markProfileNotificationIdsRead(
      getNotificationIdsForWallPost(notifications, postId),
      markNotificationRead,
      markSyntheticRead,
    );
  }, [markNotificationRead, markSyntheticRead, notifications, postId]);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  const header = (
    <Pressable onPress={() => backOnce(router)} style={styles.backButton}>
      <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
    </Pressable>
  );

  async function handleSendReply() {
    if (!post || !currentUser) return;
    if (!replyDraft.trim() && !replyVoice) {
      setError('Write or record a reply first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const uploadedVoice = replyVoice
        ? {
          ...replyVoice,
          uri: await uploadMemoryAudio(replyVoice.uri, { prefix: `${currentUser.id}/voice-replies` }),
        }
        : null;
      await addMemoryReply(post.id, currentUser.id, replyDraft, uploadedVoice);
      setReplyDraft('');
      setReplyVoice(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add reply.');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(replyId: string) {
    if (!currentUser) return;
    const authorUserId = currentUser.id;
    Alert.alert('Delete reply?', 'This removes your reply from the memory.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteMemoryReply(replyId, authorUserId).catch((err) => setError(err instanceof Error ? err.message : 'Could not delete reply.')) },
    ]);
  }

  if (!post && fallbackPostQuery.isFetching) {
    return (
      <AppScreen header={header} floatingHeaderOnScroll>
        <Text style={styles.title}>Opening memory...</Text>
        <Text style={styles.subtitle}>Loading the memory from your shared wall.</Text>
      </AppScreen>
    );
  }

  if (!post) {
    return (
      <AppScreen header={header} floatingHeaderOnScroll>
        <Text style={styles.title}>Memory unavailable</Text>
        <Text style={styles.subtitle}>This memory could not be opened.</Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen header={header} floatingHeaderOnScroll footer={<ActionButton label={busy ? 'Replying...' : 'Send reply'} onPress={handleSendReply} disabled={busy || (!replyDraft.trim() && !replyVoice)} accentColor={semanticColors.replyPurple} />}>
      <Text style={styles.title}>Memory Replies</Text>
      <Text style={styles.subtitle}>Keep the conversation tied to this memory.</Text>

      <View style={styles.preview}>
        <WallPostCard
          authorName={getUserById(post.authorUserId)?.displayName ?? 'Someone'}
          post={post}
          cardColor={post.cardColor}
          preview
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{replies.length === 1 ? '1 reply' : `${replies.length} replies`}</Text>
        {replies.length > 0 ? replies.map((reply) => {
          const author = getUserById(reply.authorUserId);
          const mine = reply.authorUserId === currentUser.id;
          return (
            <Pressable key={reply.id} onLongPress={mine ? () => confirmDelete(reply.id) : undefined} style={styles.replyCard}>
              <View style={[styles.replyAvatar, { backgroundColor: author?.avatarColor ?? colors.accent }]}>
                <Text style={styles.replyAvatarText}>{(author?.displayName ?? '?').trim().slice(0, 1).toUpperCase() || '?'}</Text>
              </View>
              <View style={styles.replyBody}>
                <View style={styles.replyHeader}>
                  <Text style={styles.replyAuthor}>{author?.displayName ?? 'Someone'}</Text>
                  <Text style={styles.replyTime}>{formatReplyDate(reply.createdAt)}</Text>
                </View>
                {reply.body ? <Text style={styles.replyText}>{reply.body}</Text> : null}
                {reply.voice ? (
                  <VoiceMemoryCard
                    key={`${reply.id}:${reply.voice.uri}`}
                    voice={reply.voice}
                    postId={`reply:${reply.id}`}
                    authorName={author?.displayName ?? 'Someone'}
                    themeColors={colors}
                    variant="embedded"
                    label={`${author?.displayName ?? 'Someone'}'s voice`}
                    preview
                  />
                ) : null}
              </View>
            </Pressable>
          );
        }) : (
          <Text style={styles.emptyText}>No replies yet. Be the first to add one.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add a reply</Text>
        <TextOrVoiceComposer
          text={replyDraft}
          onTextChange={setReplyDraft}
          voice={replyVoice}
          onVoiceChange={(voice) => {
            setReplyVoice(voice);
            setError('');
          }}
          previewAuthorName={currentUser.displayName}
          placeholder="Write a quick reply..."
          voiceLabel="Voice reply"
          voiceHelperText="Record a voice reply instead of typing."
          textInputStyle={styles.replyInput}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AppScreen>
  );
}

function formatReplyDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const makeStyles = (colors: ReturnType<typeof useTheme>['colors'], fonts: ReturnType<typeof useTheme>['fonts']) => StyleSheet.create({
  backButton: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center' },
  backLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  title: { fontFamily: fonts.heading, fontSize: 32, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 32) },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
  preview: { alignItems: 'center' },
  section: { gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.7 },
  replyCard: { flexDirection: 'row', gap: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.md },
  replyAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  replyAvatarText: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.white },
  replyBody: { flex: 1, gap: 4 },
  replyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  replyAuthor: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
  replyTime: { fontFamily: fonts.body, fontSize: 11, color: colors.inkMuted },
  replyText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  emptyText: { fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted },
  replyInput: { minHeight: 110, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.md, textAlignVertical: 'top', fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  error: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.error },
});
