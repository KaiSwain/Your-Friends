import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '../../../src/components/AppScreen';
import { SectionCard } from '../../../src/components/SectionCard';
import { WallPostCard } from '../../../src/components/WallPostCard';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../src/features/theme/themes';
import { fonts } from '../../../src/theme/typography';
import { spacing } from '../../../src/theme/tokens';

export default function ViewYourWallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ authorId: string | string[] }>();
  const { currentUser } = useAuth();
  const { getUserById, isConnected, getWallPostsForSubject } = useSocialGraph();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  const authorId = Array.isArray(params.authorId) ? params.authorId[0] : params.authorId;
  const author = authorId ? getUserById(authorId) : undefined;

  if (!author || !isConnected(currentUser.id, author.id)) {
    return (
      <AppScreen>
        <SectionCard title="This wall is not available.">
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backLabel}>← Back</Text>
          </Pressable>
        </SectionCard>
      </AppScreen>
    );
  }

  // Show posts the friend (author) wrote about YOU that are visible_to_subject
  const allPostsAboutMe = getWallPostsForSubject(currentUser.id, 'user');
  const visiblePosts = allPostsAboutMe.filter(
    (post) => post.authorUserId === author.id && post.visibility === 'visible_to_subject',
  );

  return (
    <AppScreen>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backLabel}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>Your Wall</Text>
      <Text style={styles.subtitle}>What {author.displayName} wrote about you</Text>

      {visiblePosts.length > 0 ? (
        <View style={styles.wallList}>
          {visiblePosts.map((post) => (
            <WallPostCard key={post.id} authorName={author.displayName} post={post} />
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📝</Text>
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptySubtitle}>
            {author.displayName} hasn't shared any visible memories about you yet.
          </Text>
        </View>
      )}
    </AppScreen>
  );
}

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    backButton: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
    backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
    title: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink },
    subtitle: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft },
    wallList: { gap: spacing.md },
    emptyState: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
    emptyEmoji: { fontSize: 48 },
    emptyTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
    emptySubtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft, textAlign: 'center' },
  });
