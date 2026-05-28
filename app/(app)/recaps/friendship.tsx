import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../../src/components/ActionButton';
import { AppScreen } from '../../../src/components/AppScreen';
import { WallPostCard } from '../../../src/components/WallPostCard';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { buildFriendshipRecap, type FriendshipRecapRange } from '../../../src/features/recaps/friendshipRecap';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import { backOnce, pushOnce } from '../../../src/lib/navigationGuard';
import { protectTextFromFontClipping } from '../../../src/theme/fontProtection';
import { radius, spacing } from '../../../src/theme/tokens';

export default function FriendshipRecapScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ friendUserId?: string | string[]; range?: string | string[]; date?: string | string[] }>();
  const { currentUser } = useAuth();
  const { getUserById, getVisiblePostsByAuthor, isConnected } = useSocialGraph();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const friendUserId = Array.isArray(params.friendUserId) ? params.friendUserId[0] : params.friendUserId;
  const initialRange = normalizeRange(Array.isArray(params.range) ? params.range[0] : params.range);
  const initialDate = parseDateParam(Array.isArray(params.date) ? params.date[0] : params.date);
  const [range, setRange] = useState<FriendshipRecapRange>(initialRange);
  const [cursorDate, setCursorDate] = useState(initialDate);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;
  const friend = friendUserId ? getUserById(friendUserId) : undefined;
  if (!friend || !isConnected(currentUser.id, friend.id)) {
    return (
      <AppScreen header={<BackButton onPress={() => backOnce(router)} styles={styles} />} floatingHeaderOnScroll>
        <Text style={styles.emptyTitle}>Recap unavailable</Text>
        <Text style={styles.emptyText}>This friendship recap could not be opened.</Text>
      </AppScreen>
    );
  }
  const recapFriend = friend;

  const recapPosts = [
    ...getVisiblePostsByAuthor(currentUser.id).filter((post) => post.subjectUserId === recapFriend.id),
    ...getVisiblePostsByAuthor(recapFriend.id).filter((post) => post.subjectUserId === currentUser.id),
  ].filter((post, index, posts) => posts.findIndex((candidate) => candidate.id === post.id) === index);
  const recap = buildFriendshipRecap({
    currentUserId: currentUser.id,
    friendUserId: recapFriend.id,
    friendName: recapFriend.displayName,
    posts: recapPosts,
    range,
    cursorDate,
  });

  function openAddMemory() {
    pushOnce(router, {
      pathname: '/(app)/memories/add',
      params: {
        subjectId: recapFriend.id,
        subjectType: 'user',
        targetKeys: `user:${recapFriend.id}`,
        backTo: `/(app)/recaps/friendship?friendUserId=${recapFriend.id}&range=${range}`,
      },
    });
  }

  function shiftCursor(delta: number) {
    setCursorDate((current) => {
      const next = new Date(current);
      if (range === 'month') next.setMonth(next.getMonth() + delta);
      else next.setFullYear(next.getFullYear() + delta);
      return next;
    });
  }

  const periodLabel = range === 'month'
    ? cursorDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : String(cursorDate.getFullYear());

  return (
    <AppScreen
      header={<BackButton onPress={() => backOnce(router)} styles={styles} />}
      floatingHeaderOnScroll
      footer={recap.memoryCount === 0 ? <ActionButton label="Add a memory" onPress={openAddMemory} /> : undefined}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Friendship recap</Text>
        <Text style={styles.title}>{recapFriend.displayName}</Text>
        <Text style={styles.subtitle}>{recap.subtitle}</Text>
      </View>

      <View style={styles.rangeRow}>
        {(['month', 'year'] as FriendshipRecapRange[]).map((option) => {
          const active = range === option;
          return (
            <Pressable
              key={option}
              onPress={() => setRange(option)}
              style={[styles.rangeChip, active && styles.rangeChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.rangeChipText, active && styles.rangeChipTextActive]}>{option === 'month' ? 'Month' : 'Year'}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.periodRow}>
        <Pressable onPress={() => shiftCursor(-1)} style={styles.periodButton} accessibilityRole="button" accessibilityLabel="Previous recap period">
          <Ionicons name="chevron-back" size={18} color={colors.ink} />
        </Pressable>
        <Text style={styles.periodLabel}>{periodLabel}</Text>
        <Pressable onPress={() => shiftCursor(1)} style={styles.periodButton} accessibilityRole="button" accessibilityLabel="Next recap period">
          <Ionicons name="chevron-forward" size={18} color={colors.ink} />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <StatCard label="Memories" value={recap.memoryCount} styles={styles} />
        <StatCard label="Photos" value={recap.photoCount} styles={styles} />
        <StatCard label="Notes" value={recap.noteCount} styles={styles} />
        <StatCard label="Songs" value={recap.songCount} styles={styles} />
      </View>

      {recap.featuredPost ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Memory of the moment</Text>
          <WallPostCard
            authorName={getUserById(recap.featuredPost.authorUserId)?.displayName ?? 'Someone'}
            post={recap.featuredPost}
            cardColor={recap.featuredPost.cardColor}
            shareable
          />
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="sparkles-outline" size={34} color={colors.ink} />
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptyText}>Add a memory with {recapFriend.displayName} and this recap will start filling itself in.</Text>
        </View>
      )}

      {recap.groupedPosts.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          {recap.groupedPosts.map((group) => (
            <View key={group.key} style={styles.groupBlock}>
              <Text style={styles.groupLabel}>{group.label}</Text>
              {group.posts.slice(0, 3).map((post) => (
                <View key={post.id} style={styles.timelineRow}>
                  <Ionicons name={post.postType === 'song' ? 'musical-notes-outline' : post.postType === 'voice' ? 'mic-outline' : post.postType === 'note' ? 'document-text-outline' : 'image-outline'} size={16} color={colors.accent} />
                  <Text style={styles.timelineText} numberOfLines={2}>
                    {post.body.trim() || (post.postType === 'song' ? post.song?.title ?? 'Song memory' : post.postType === 'voice' ? 'Voice memory' : 'Photo memory')}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </AppScreen>
  );
}

function BackButton({ onPress, styles }: { onPress: () => void; styles: ReturnType<typeof makeStyles> }) {
  return (
    <Pressable onPress={onPress} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
      <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
    </Pressable>
  );
}

function StatCard({ label, value, styles }: { label: string; value: number; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function normalizeRange(value: string | undefined): FriendshipRecapRange {
  return value === 'month' ? 'month' : 'year';
}

function parseDateParam(value: string | undefined) {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

const makeStyles = (colors: any, fonts: any) =>
  StyleSheet.create({
    backButton: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center' },
    backLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    hero: { gap: spacing.xs },
    eyebrow: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.accent, textTransform: 'uppercase', letterSpacing: 1 },
    title: { fontFamily: fonts.heading, fontSize: 34, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 34) },
    subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
    rangeRow: { flexDirection: 'row', gap: spacing.xs, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paperMuted, padding: 4 },
    rangeChip: { flex: 1, alignItems: 'center', borderRadius: radius.pill, paddingVertical: spacing.sm },
    rangeChipActive: { backgroundColor: colors.accent },
    rangeChipText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft },
    rangeChipTextActive: { color: colors.white },
    periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
    periodButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
    periodLabel: { flex: 1, textAlign: 'center', fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    statCard: { flexGrow: 1, flexBasis: '45%', borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.md, gap: 2 },
    statValue: { fontFamily: fonts.heading, fontSize: 28, color: colors.accent, ...protectTextFromFontClipping(fonts.heading, 28) },
    statLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkSoft },
    section: { gap: spacing.sm },
    sectionTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 22) },
    emptyState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
    emptyTitle: { fontFamily: fonts.heading, fontSize: 23, color: colors.ink, textAlign: 'center', ...protectTextFromFontClipping(fonts.heading, 23) },
    emptyText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft, textAlign: 'center' },
    groupBlock: { gap: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.md },
    groupLabel: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.7 },
    timelineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    timelineText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.ink },
  });
