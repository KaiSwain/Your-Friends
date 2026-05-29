import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { protectTextFromFontClipping } from '../theme/fontProtection';
import type { FontSet } from '../theme/typography';
import { spacing } from '../theme/tokens';
import type { VoiceAttachment } from '../types/domain';
import { VoiceMemoryCard } from './VoiceMemoryCard';

export interface MemoryReplyPreviewItem {
  id: string;
  body: string;
  authorName: string;
  voice?: VoiceAttachment | null;
}

interface MemoryReplyThreadPreviewProps {
  allowReply?: boolean;
  replies: MemoryReplyPreviewItem[];
  onOpenThread?: () => void;
  maxVisible?: number;
  themeColors?: ColorTokens;
}

export function MemoryReplyThreadPreview({ allowReply = true, replies, onOpenThread, maxVisible = 3, themeColors }: MemoryReplyThreadPreviewProps) {
  const { colors: appColors, fonts } = useTheme();
  const colors = themeColors ?? appColors;
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const visibleReplies = replies.slice(-maxVisible);
  const hiddenCount = Math.max(0, replies.length - visibleReplies.length);

  return (
    <View style={styles.wrapper}>
      {visibleReplies.length > 0 ? (
        <Pressable
          onPress={onOpenThread}
          disabled={!onOpenThread}
          style={styles.thread}
          accessibilityRole={onOpenThread ? 'button' : undefined}
          accessibilityLabel={onOpenThread ? 'Open memory replies' : undefined}
        >
          <View style={styles.line} />
          {visibleReplies.map((reply) => (
            <View key={reply.id} style={styles.replyRow}>
              <View style={styles.node} />
              {reply.body ? <Text style={styles.replyText} numberOfLines={2}>- {reply.body} - {reply.authorName}</Text> : null}
              {reply.voice ? (
                <VoiceMemoryCard
                  voice={reply.voice}
                  postId={`reply-preview:${reply.id}`}
                  authorName={reply.authorName}
                  themeColors={colors}
                  variant="embedded"
                  label={`${reply.authorName}'s voice`}
                  preview
                />
              ) : null}
            </View>
          ))}
          {hiddenCount > 0 ? (
            <Text style={styles.moreText}>View {hiddenCount} more {hiddenCount === 1 ? 'reply' : 'replies'}</Text>
          ) : null}
        </Pressable>
      ) : null}

      {allowReply && onOpenThread ? (
        <Pressable onPress={onOpenThread} style={styles.replyAction} accessibilityRole="button" accessibilityLabel="Reply to memory">
          <Ionicons name="chatbubble-ellipses-outline" size={13} color={colors.inkSoft} />
          <Text style={styles.replyActionText}>{replies.length > 0 ? 'Reply' : 'Add a reply'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) => StyleSheet.create({
  wrapper: {
    width: 300,
    maxWidth: '100%',
    alignSelf: 'center',
    marginTop: -2,
    gap: spacing.xs,
  },
  thread: {
    position: 'relative',
    paddingLeft: 22,
    gap: 3,
  },
  line: {
    position: 'absolute',
    left: 7,
    top: -10,
    bottom: 4,
    width: 1,
    backgroundColor: colors.line,
  },
  replyRow: {
    minHeight: 22,
    justifyContent: 'center',
  },
  node: {
    position: 'absolute',
    left: -18,
    top: 10,
    width: 12,
    height: 1,
    backgroundColor: colors.line,
  },
  replyText: {
    fontFamily: fonts.handwritten,
    fontSize: 15,
    lineHeight: 19,
    color: colors.inkMuted,
    ...protectTextFromFontClipping(fonts.handwritten, 15),
  },
  moreText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    color: colors.white,
    marginTop: 1,
  },
  replyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingLeft: 22,
    paddingVertical: 2,
  },
  replyActionText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.inkSoft,
  },
});
