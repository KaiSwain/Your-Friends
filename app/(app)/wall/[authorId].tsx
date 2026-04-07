import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '../../../src/components/AppScreen';
import { SectionCard } from '../../../src/components/SectionCard';
import { WallPostCard } from '../../../src/components/WallPostCard';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../src/features/theme/themes';
import { contrastText, contrastTextSoft, contrastAccent } from '../../../src/lib/contrastText';
import { fonts } from '../../../src/theme/typography';
import { profileBackgrounds, radius, spacing } from '../../../src/theme/tokens';
import type { WallPost } from '../../../src/types/domain';

function groupPostsByDate(posts: WallPost[]) {
  const groups: { label: string; posts: WallPost[] }[] = [];
  let currentLabel = '';
  for (const post of posts) {
    const d = new Date(post.createdAt);
    const label = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    if (label !== currentLabel) {
      currentLabel = label;
      groups.push({ label, posts: [] });
    }
    groups[groups.length - 1].posts.push(post);
  }
  return groups;
}

function getInitials(value: string) {
  return value.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

export default function ViewYourWallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ authorId: string | string[] }>();
  const { currentUser } = useAuth();
  const { getUserById, isConnected, getVisiblePostsByAuthor, getContactAboutMe, notifications, markNotificationRead } = useSocialGraph();
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

  // The contact card the author created about the current user.
  const theirContact = getContactAboutMe(author.id, currentUser.id);
  const visiblePosts = getVisiblePostsByAuthor(author.id);

  // Derive style values from the contact card color if present.
  const cardColor = theirContact?.cardColor ?? null;
  const heroCt = contrastText(cardColor);
  const heroCtSoft = contrastTextSoft(cardColor);
  const heroCtAccent = contrastAccent(cardColor, colors.accent);
  const bgPreset = theirContact?.profileBg ? profileBackgrounds.find((b) => b.key === theirContact.profileBg) : undefined;

  // Use the contact's display name for you, or fall back to your own name.
  const displayName = theirContact?.displayName ?? currentUser.displayName;
  const avatarPath = theirContact?.avatarPath ?? currentUser.avatarPath;
  const tags = theirContact?.tags ?? [];
  const note = theirContact?.note ?? null;
  const facts = theirContact?.facts ?? [];

  // Unread notifications from this author — used to highlight fresh items.
  const authorNotifications = useMemo(() => {
    const filtered = notifications.filter((n) => !n.read && n.actorUserId === authorId);
    console.log('[wall glow] authorId:', authorId, 'unread from author:', filtered.length, filtered.map((n) => ({ type: n.type, msg: n.message, ref: n.referenceId })));
    return filtered;
  }, [notifications, authorId]);
  const glowFactTexts = useMemo(() => {
    const set = new Set<string>();
    for (const n of authorNotifications) {
      if (n.message.includes('added a fact about you: ')) {
        const fact = n.message.split('added a fact about you: ')[1];
        if (fact) set.add(fact);
      }
    }
    return set;
  }, [authorNotifications]);
  const glowPostIds = useMemo(() => {
    const set = new Set<string>();
    for (const n of authorNotifications) {
      if (n.type === 'wall_post' && n.referenceId) set.add(n.referenceId);
    }
    return set;
  }, [authorNotifications]);
  const glowHero = useMemo(() =>
    authorNotifications.some((n) => n.type === 'contact_update' && n.message.includes('updated your profile')),
    [authorNotifications],
  );

  // Mark notifications as read when leaving the screen (not immediately).
  const seenNotificationIds = useRef<string[]>([]);
  useEffect(() => {
    if (authorNotifications.length > 0) {
      seenNotificationIds.current = authorNotifications.map((n) => n.id);
    }
  }, [authorNotifications]);
  useEffect(() => {
    return () => {
      seenNotificationIds.current.forEach((id) => markNotificationRead(id));
    };
  }, []);

  return (
    <AppScreen gradientColors={bgPreset?.gradient}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backLabel}>← Back</Text>
      </Pressable>

      {/* Hero polaroid card — mirrors the contact profile card */}
      <View style={styles.heroSection}>
        <View style={[styles.heroCard, cardColor ? { backgroundColor: cardColor } : undefined, glowHero && styles.glowRow]}>
          <View style={styles.heroPhotoFrame}>
            {avatarPath ? (
              <Image source={{ uri: avatarPath }} style={styles.heroPhoto} />
            ) : (
              <View style={[styles.heroPhotoSurface, { backgroundColor: colors.accent }]}>
                <Text style={styles.heroInitials}>{getInitials(displayName)}</Text>
              </View>
            )}
          </View>
          <View style={styles.heroBottom}>
            <Text style={[styles.heroName, cardColor && { color: heroCt }]} numberOfLines={1}>{displayName}</Text>
            {tags.length > 0 && (
              <View style={styles.heroTagRow}>
                {tags.slice(0, 2).map((tag) => (
                  <View key={tag} style={[styles.heroTag, cardColor && { backgroundColor: heroCtAccent + '1A' }]}>
                    <Text style={[styles.heroTagText, cardColor && { color: heroCtAccent }]} numberOfLines={1}>{tag}</Text>
                  </View>
                ))}
                {tags.length > 2 && (
                  <Text style={[styles.heroTagMore, cardColor && { color: heroCtSoft }]}>+{tags.length - 2}</Text>
                )}
              </View>
            )}
            {note ? (
              <Text style={[styles.heroNote, cardColor && { color: heroCtSoft }]} numberOfLines={2}>{note}</Text>
            ) : null}
          </View>
        </View>
        <Text style={styles.heroSubtitle}>{author.displayName}'s profile of you</Text>
      </View>

      {/* Facts section */}
      {facts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Facts</Text>
          <View style={styles.factList}>
            {facts.map((fact) => (
              <View key={fact} style={[styles.factRow, glowFactTexts.has(fact) && styles.glowRow]}>
                <Text style={styles.factText}>{fact}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Memory Wall */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Memory Wall</Text>
        {visiblePosts.length > 0 ? (
          <View style={styles.wallList}>
            {groupPostsByDate(visiblePosts).map((group) => (
              <View key={group.label}>
                <View style={styles.dateHeader}>
                  <View style={styles.dateLine} />
                  <Text style={styles.dateLabel}>{group.label}</Text>
                  <View style={styles.dateLine} />
                </View>
                {group.posts.map((post) => (
                  <View key={post.id} style={glowPostIds.has(post.id) ? styles.glowRow : undefined}>
                    <WallPostCard authorName={author.displayName} post={post} cardColor={post.cardColor} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyHint}>{author.displayName} hasn't shared any memories about you yet.</Text>
        )}
      </View>
    </AppScreen>
  );
}

const HERO_PHOTO = 200;
const HERO_PADDING = 14;

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    backButton: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
    backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },

    /* ── Hero polaroid card ── */
    heroSection: { alignItems: 'center', gap: spacing.sm },
    heroCard: {
      width: HERO_PHOTO + HERO_PADDING * 2,
      borderRadius: 2,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.line,
      padding: HERO_PADDING,
      paddingBottom: 0,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 4,
    },
    heroPhotoFrame: {
      width: HERO_PHOTO,
      height: HERO_PHOTO,
      borderRadius: 1,
      overflow: 'hidden',
    },
    heroPhoto: { width: '100%', height: '100%' },
    heroPhotoSurface: {
      flex: 1, width: '100%', height: '100%',
      alignItems: 'center', justifyContent: 'center',
    },
    heroInitials: { fontFamily: fonts.heading, fontSize: 64, color: colors.white },
    heroBottom: {
      width: '100%', paddingVertical: spacing.md,
      alignItems: 'center', gap: 4,
    },
    heroName: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink, textAlign: 'center' },
    heroTagRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 },
    heroTag: {
      backgroundColor: colors.accent + '1A',
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
    },
    heroTagText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.5 },
    heroTagMore: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.inkMuted },
    heroNote: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.inkSoft, textAlign: 'center' },
    heroSubtitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkSoft },

    /* ── Sections ── */
    section: { gap: spacing.sm },
    sectionTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
    factList: { gap: spacing.xs },
    factRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
    factText: { fontFamily: fonts.body, fontSize: 15, color: colors.ink },
    glowRow: {
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 12,
      elevation: 6,
      backgroundColor: colors.accent + '12',
      borderRadius: radius.sm,
    },
    emptyHint: { fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted },
    wallList: { gap: spacing.sm },
    dateHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
    dateLine: { flex: 1, height: 1, backgroundColor: colors.line },
    dateLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  });
