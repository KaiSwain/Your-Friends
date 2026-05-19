import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../../../src/components/ActionButton';
import { AppScreen } from '../../../../src/components/AppScreen';
import { WallPostCard } from '../../../../src/components/WallPostCard';
import { useAuth } from '../../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../../src/features/theme/ThemeContext';
import { backOnce } from '../../../../src/lib/navigationGuard';
import { protectTextFromFontClipping } from '../../../../src/theme/fontProtection';
import { radius, spacing } from '../../../../src/theme/tokens';

export default function MemoryRepliesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ postId?: string | string[] }>();
  const { currentUser } = useAuth();
  const { addMemoryReply, deleteMemoryReply, getRepliesForWallPost, getUserById, getWallPostById } = useSocialGraph();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const post = postId ? getWallPostById(postId) : undefined;
  const replies = postId ? getRepliesForWallPost(postId) : [];
  const [replyDraft, setReplyDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  const header = (
    <Pressable onPress={() => backOnce(router)} style={styles.backButton}>
      <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
    </Pressable>
  );

  async function handleSendReply() {
    if (!post || !currentUser) return;
    if (!replyDraft.trim()) {
      setError('Write a reply first.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await addMemoryReply(post.id, currentUser.id, replyDraft);
      setReplyDraft('');
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

  if (!post) {
    return (
      <AppScreen header={header} floatingHeaderOnScroll>
        <Text style={styles.title}>Memory unavailable</Text>
        <Text style={styles.subtitle}>This memory could not be opened.</Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen header={header} floatingHeaderOnScroll footer={<ActionButton label={busy ? 'Replying...' : 'Send reply'} onPress={handleSendReply} disabled={busy || !replyDraft.trim()} />}>
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
                <Text style={styles.replyText}>{reply.body}</Text>
              </View>
            </Pressable>
          );
        }) : (
          <Text style={styles.emptyText}>No replies yet. Be the first to add one.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add a reply</Text>
        <TextInput
          multiline
          value={replyDraft}
          onChangeText={setReplyDraft}
          placeholder="Write a quick reply..."
          placeholderTextColor={colors.inkMuted}
          style={styles.replyInput}
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
  backButton: { paddingVertical: spacing.xs },
  backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
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
