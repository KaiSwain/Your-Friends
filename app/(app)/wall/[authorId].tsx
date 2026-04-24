import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '../../../src/components/AppScreen';
import { CardFlourish } from '../../../src/components/CardFlourish';
import {
  MonthMemoryWallContent,
  MonthMemoryWallPicker,
  MonthMemoryWallStickyHeader,
  useMonthScrollableMemoryWall,
} from '../../../src/components/MonthScrollableMemoryWall';
import { SectionCard } from '../../../src/components/SectionCard';
import { ProfileSkeleton } from '../../../src/components/Skeleton';
import { WallPostCard } from '../../../src/components/WallPostCard';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import type { ColorTokens, ThemeName } from '../../../src/features/theme/themes';
import { themes, themeNames } from '../../../src/features/theme/themes';
import { contrastText, contrastTextSoft, contrastAccent } from '../../../src/lib/contrastText';
import type { FontSet } from '../../../src/theme/typography';
import { fontSets } from '../../../src/theme/typography';
import { radius, spacing } from '../../../src/theme/tokens';
import type { WallPost } from '../../../src/types/domain';

function getInitials(value: string) {
  return value.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

export default function ViewYourWallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ authorId: string | string[] }>();
  const { currentUser } = useAuth();
  const { loading, getUserById, isConnected, getVisiblePostsByAuthor, getContactAboutMe, notifications, markNotificationRead, refresh } = useSocialGraph();
  const { colors, fonts, resolvedMode } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  const authorId = Array.isArray(params.authorId) ? params.authorId[0] : params.authorId;
  const author = authorId ? getUserById(authorId) : undefined;

  // Resolve bgPreset early so styles can adapt to the profile background.
  const theirContactEarly = (!loading && author && currentUser && isConnected(currentUser.id, author.id))
    ? getContactAboutMe(author.id, currentUser.id) : undefined;
  // Use the theme the author selected for the viewer's contact card (stored in profileBg).
  const profileThemeName = theirContactEarly?.profileBg && (themeNames as string[]).includes(theirContactEarly.profileBg)
    ? (theirContactEarly.profileBg as ThemeName)
    : null;
  const themedColors = profileThemeName ? themes[profileThemeName][resolvedMode] : null;
  const effectiveColors = themedColors ?? colors;
  const effectiveFonts = profileThemeName ? (fontSets[profileThemeName] ?? fonts) : fonts;

  const styles = useMemo(() => makeStyles(effectiveColors, effectiveFonts), [effectiveColors, effectiveFonts]);

  // The contact card the author created about the current user.
  const theirContact = author && currentUser ? getContactAboutMe(author.id, currentUser.id) : undefined;
  const visiblePosts = author ? getVisiblePostsByAuthor(author.id) : [];
  const monthWall = useMonthScrollableMemoryWall(visiblePosts);

  // Derive style values from the contact card color if present.
  const cardColor = theirContact?.cardColor ?? null;
  const heroCt = contrastText(cardColor);
  const heroCtSoft = contrastTextSoft(cardColor);
  const heroCtAccent = contrastAccent(cardColor, effectiveColors.accent);

  // Use the contact's display name for you, or fall back to your own name.
  const displayName = theirContact?.displayName ?? currentUser?.displayName ?? '';
  const avatarPath = theirContact?.avatarPath ?? currentUser?.avatarPath ?? null;
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

  // ── Hero card flip animation ──
  const [showHeroBack, setShowHeroBack] = useState(false);
  const [heroFrontHeight, setHeroFrontHeight] = useState(0);
  const heroFlipAnim = useRef(new Animated.Value(0)).current;
  const heroFlipping = useRef(false);
  const heroFlipTarget = useRef(0);
  // Continuous 0°→180° rotation with counter-rotated back face so
  // backfaceVisibility hides the side that's facing away each frame — no ghosted photo.
  const heroFrontRotateY = heroFlipAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const heroBackRotateY = heroFlipAnim.interpolate({ inputRange: [0, 1], outputRange: ['180deg', '360deg'] });
  const handleHeroFlip = useCallback(() => {
    if (heroFlipping.current) return;
    heroFlipping.current = true;
    const next = heroFlipTarget.current === 0 ? 1 : 0;
    heroFlipTarget.current = next;
    setShowHeroBack(next === 1);
    Animated.timing(heroFlipAnim, { toValue: next, duration: 360, useNativeDriver: true }).start(() => {
      heroFlipping.current = false;
    });
  }, [heroFlipAnim]);

  // All hooks are above this line. Now guard for auth / loading / missing author.
  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;
  if (loading) {
    return <AppScreen><ProfileSkeleton /></AppScreen>;
  }
  if (!author || !isConnected(currentUser.id, author.id)) {
    return (
      <AppScreen
        header={(
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
            <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
          </Pressable>
        )}
        floatingHeaderOnScroll
      >
        <SectionCard title="This wall is not available.">
          <Text style={styles.emptyHint}>Use the back button to return to the previous screen.</Text>
        </SectionCard>
      </AppScreen>
    );
  }

  const heroBackText = theirContact?.backText ?? null;
  const topBar = (
    <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
      <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
    </Pressable>
  );

  const screenContent: ReactNode[] = [];
  let stickyHeaderIndex: number | undefined;

  screenContent.push(
    <View key="hero" style={styles.heroSection}>
      <Pressable onPress={handleHeroFlip}>
        <View style={styles.heroAmbientShadow} renderToHardwareTextureAndroid>
          <View onLayout={(e) => { const h = e.nativeEvent.layout.height; if (h > 0) setHeroFrontHeight(h); }} style={styles.heroFaceHost}>
            <Animated.View pointerEvents={showHeroBack ? 'none' : 'auto'} style={[styles.heroFace, { transform: [{ perspective: 1000 }, { rotateY: heroFrontRotateY }] }]}>
              <View style={styles.heroTape} />
              <View style={[styles.heroCard, cardColor ? { backgroundColor: cardColor } : undefined, glowHero && styles.glowRow]}>
                <View style={styles.heroPhotoFrame}>
                  {avatarPath ? (
                    <>
                      <Image source={{ uri: avatarPath }} style={styles.heroPhoto} fadeDuration={0} />
                      <View style={styles.heroWarmBaseTint} />
                      <LinearGradient
                        colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.06)']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.heroPhotoSheen}
                      />
                      <View style={styles.heroInsetShadowTop} />
                      <View style={styles.heroInsetShadowLeft} />
                    </>
                  ) : (
                    <View style={[styles.heroPhotoSurface, { backgroundColor: colors.accent }]}> 
                      <Text style={styles.heroInitials}>{getInitials(displayName)}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.heroBottom}>
                  <Text style={[styles.heroName, cardColor && { color: heroCt }]} numberOfLines={1}>{displayName}</Text>
                  <View style={styles.heroNoteSlot}>
                    {note ? (
                      <Text style={[styles.heroNote, cardColor && { color: heroCtSoft }]} numberOfLines={HERO_NOTE_LINES}>{note}</Text>
                    ) : null}
                  </View>
                </View>
                <CardFlourish size={16} color={cardColor ? heroCtSoft : effectiveColors.inkMuted} opacity={0.28} inset={12} />
              </View>
            </Animated.View>

            <Animated.View pointerEvents={showHeroBack ? 'auto' : 'none'} style={[styles.heroFaceOverlay, styles.heroFace, { transform: [{ perspective: 1000 }, { rotateY: heroBackRotateY }] }]}>
              <View style={styles.heroTape} />
              <View style={[styles.heroCard, styles.heroCardBack, cardColor ? { backgroundColor: cardColor } : undefined, heroFrontHeight > 0 && { height: heroFrontHeight }]}> 
                {heroBackText ? (
                  <Text style={[styles.heroBackText, cardColor && { color: heroCt }]}>{heroBackText}</Text>
                ) : (
                  <Text style={[styles.heroBackPlaceholder, cardColor && { color: heroCtSoft }]}>Nothing written on the back</Text>
                )}
                <Text style={[styles.heroBackHint, cardColor && { color: heroCtSoft }]}>tap to flip back</Text>
              </View>
            </Animated.View>
          </View>
        </View>
      </Pressable>
      <Text style={styles.heroSubtitle}>{author.displayName}'s profile of you — tap to flip</Text>
    </View>,
  );

  if (facts.length > 0) {
    screenContent.push(
      <View key="facts" style={styles.section}>
        <Text style={styles.sectionTitle}>Facts</Text>
        <View style={styles.factList}>
          {facts.map((fact) => (
            <View key={fact} style={[styles.factChip, glowFactTexts.has(fact) && styles.glowRow]}>
              <Text style={styles.factChipText}>{fact}</Text>
            </View>
          ))}
        </View>
      </View>,
    );
  }

  screenContent.push(
    <View key="memory-wall-controls" style={styles.section}>
      <Text style={styles.sectionTitle}>Memory Wall</Text>
      <MonthMemoryWallPicker
        monthGroups={monthWall.monthGroups}
        activeMonthKey={monthWall.activeMonth?.key ?? ''}
        onSelectMonth={monthWall.setSelectedMonthKey}
        themeColors={effectiveColors}
      />
    </View>,
  );

  if (!monthWall.activeMonth) {
    screenContent.push(
      <Text key="memory-wall-empty" style={styles.emptyHint}>{author.displayName} hasn't shared any memories about you yet.</Text>,
    );
  } else {
    stickyHeaderIndex = screenContent.length;
    screenContent.push(
      <MonthMemoryWallStickyHeader key="memory-wall-month" label={monthWall.activeMonth.label} themeColors={effectiveColors} />,
    );
    screenContent.push(
      <View key="memory-wall-posts" style={styles.monthWallPostsBlock}>
        <MonthMemoryWallContent
          dayGroups={monthWall.activeMonth.dayGroups}
          themeColors={effectiveColors}
          renderPost={(post) => (
            <View key={post.id} style={glowPostIds.has(post.id) ? styles.glowRow : undefined}>
              <WallPostCard authorName={author.displayName} post={post} cardColor={post.cardColor} themeColors={effectiveColors} shareable />
            </View>
          )}
        />
      </View>,
    );
  }

  return (
    <AppScreen header={topBar} floatingHeaderOnScroll gradientColors={themedColors ? [themedColors.canvas, themedColors.canvasAlt, themedColors.canvas] : undefined} onRefresh={async () => { setRefreshing(true); await refresh(); setRefreshing(false); }} refreshing={refreshing} stickyHeaderIndices={stickyHeaderIndex !== undefined ? [stickyHeaderIndex] : undefined}>
      {screenContent}
    </AppScreen>
  );
}

const HERO_PHOTO = 200;
const HERO_PAD_SIDE = 10;
const HERO_PAD_TOP = 10;
const HERO_NOTE_LINES = 2;
const HERO_NOTE_LINE_HEIGHT = 18;
const HERO_NOTE_SLOT_HEIGHT = HERO_NOTE_LINES * HERO_NOTE_LINE_HEIGHT;
const HERO_BOTTOM_MIN_HEIGHT = 104;

const POLAROID_FRAME = '#F5F2EA';
const FRAME_INK = '#2A2218';
const FRAME_INK_SOFT = '#6B6052';

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    backButton: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
    backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },

    /* ── Hero polaroid card ── */
    heroSection: { alignItems: 'center', gap: spacing.sm },
    heroAmbientShadow: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.18,
      shadowRadius: 14,
      elevation: 8,
    },
    heroTape: {
      position: 'absolute',
      top: -7,
      alignSelf: 'center',
      width: 48,
      height: 14,
      backgroundColor: 'rgba(255,255,220,0.55)',
      borderRadius: 2,
      zIndex: 10,
    },
    heroFaceHost: {
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    heroFaceOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    heroFace: {
      backfaceVisibility: 'hidden',
    },
    heroHiddenFace: {
      opacity: 0,
    },
    heroCard: {
      width: HERO_PHOTO + HERO_PAD_SIDE * 2,
      borderRadius: 2,
      backgroundColor: POLAROID_FRAME,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(0,0,0,0.10)',
      paddingTop: HERO_PAD_TOP,
      paddingHorizontal: HERO_PAD_SIDE,
      paddingBottom: 0,
      alignItems: 'center',
    },
    heroPhotoFrame: {
      width: HERO_PHOTO,
      height: HERO_PHOTO,
      borderRadius: 1,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.045)',
    },
    heroPhoto: { width: '100%', height: '100%', transform: [{ scale: 1.01 }] },
    heroWarmBaseTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(200,170,110,0.06)',
    },
    heroPhotoSheen: {
      ...StyleSheet.absoluteFillObject,
    },
    heroInsetShadowTop: {
      position: 'absolute', top: 0, left: 0, right: 0, height: 18,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: 'rgba(0,0,0,0.12)',
    },
    heroInsetShadowLeft: {
      position: 'absolute', top: 0, left: 0, bottom: 0, width: 18,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderLeftColor: 'rgba(0,0,0,0.08)',
    },
    heroPhotoSurface: {
      flex: 1, width: '100%', height: '100%',
      alignItems: 'center', justifyContent: 'center',
    },
    heroInitials: { fontFamily: fonts.heading, fontSize: 64, color: colors.white },
    heroBottom: {
      width: '100%', paddingTop: 6, paddingBottom: 28,
      alignItems: 'center', gap: 4,
      overflow: 'visible' as const,
      minHeight: HERO_BOTTOM_MIN_HEIGHT,
      justifyContent: 'flex-start',
    },
    heroNoteSlot: { width: '100%', minHeight: HERO_NOTE_SLOT_HEIGHT, justifyContent: 'flex-start' },
    heroName: {
      fontFamily: fonts.handwrittenBold,
      fontSize: 26,
      color: FRAME_INK,
      textAlign: 'center',
      width: '100%',
      paddingHorizontal: 10,
      overflow: 'visible' as const,
    },
    heroTagRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4 },
    heroTag: {
      backgroundColor: colors.accent + '1A',
      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
    },
    heroTagText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.accent, textTransform: 'uppercase', letterSpacing: 0.5 },
    heroTagMore: { fontFamily: fonts.bodyMedium, fontSize: 10, color: FRAME_INK_SOFT },
    heroNote: {
      fontFamily: fonts.handwritten,
      fontSize: 15,
      lineHeight: HERO_NOTE_LINE_HEIGHT,
      color: FRAME_INK_SOFT,
      textAlign: 'center',
      width: '100%',
      paddingHorizontal: 10,
      overflow: 'visible' as const,
    },
    heroSubtitle: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkSoft },
    /* ── Hero back face ── */
    heroCardBack: {
      justifyContent: 'center',
      paddingTop: 20,
      paddingBottom: 20,
      paddingHorizontal: 16,
    },
    heroBackText: {
      fontFamily: fonts.handwritten,
      fontSize: 17,
      lineHeight: 24,
      color: FRAME_INK,
      textAlign: 'center',
      flex: 1,
    },
    heroBackPlaceholder: {
      fontFamily: fonts.handwritten,
      fontSize: 17,
      color: FRAME_INK_SOFT,
      textAlign: 'center',
      flex: 1,
      opacity: 0.5,
    },
    heroBackHint: { fontFamily: fonts.body, fontSize: 10, color: FRAME_INK_SOFT, textAlign: 'center', marginTop: 'auto' as any, opacity: 0.6 },

    /* ── Sections ── */
    section: { gap: spacing.sm },
    sectionTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
    factList: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: spacing.sm },
    factChip: {
      borderRadius: radius.pill,
      backgroundColor: colors.accent + '18',
      borderWidth: 1,
      borderColor: colors.accent + '40',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    factChipText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
    glowRow: {
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.5,
      shadowRadius: 12,
      elevation: 6,
    },
    emptyHint: { fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted },
    monthWallPostsBlock: { marginTop: -spacing.md },
  });
