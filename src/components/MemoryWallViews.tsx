import { ReactNode, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import type { FontSet } from '../theme/typography';
import { radius, spacing } from '../theme/tokens';
import type { WallPost } from '../types/domain';
import { MonthMemoryWallContent, type DayGroup } from './MonthScrollableMemoryWall';

export type MemoryWallViewMode = 'timeline' | 'grid' | 'prompts';
type RenderedMemoryWallViewMode = Exclude<MemoryWallViewMode, 'prompts'>;
const INITIAL_WALL_RENDER_COUNT = 8;
const WALL_RENDER_BATCH_SIZE = 8;

export const memoryWallViewOptions: { key: MemoryWallViewMode; label: string }[] = [
  { key: 'timeline', label: 'Timeline' },
  { key: 'grid', label: 'Grid' },
  { key: 'prompts', label: 'Prompts' },
];

interface MemoryWallViewToggleProps {
  colors?: ColorTokens;
  fonts?: FontSet;
  indicators?: Partial<Record<MemoryWallViewMode, number | boolean>>;
  onChange: (mode: MemoryWallViewMode) => void;
  tint?: string;
  value: MemoryWallViewMode;
}

export function MemoryWallViewToggle({ colors: overrideColors, fonts: overrideFonts, indicators, onChange, tint, value }: MemoryWallViewToggleProps) {
  const { colors: appColors, fonts: appFonts } = useTheme();
  const colors = overrideColors ?? appColors;
  const fonts = overrideFonts ?? appFonts;
  const activeTint = tint ?? colors.ink;
  const styles = useMemo(() => makeStyles(colors, fonts, activeTint), [activeTint, colors, fonts]);

  return (
    <View style={styles.viewToggle} accessibilityRole="tablist">
      {memoryWallViewOptions.map((option) => {
        const active = value === option.key;
        const indicatorValue = indicators?.[option.key];
        const indicatorCount = typeof indicatorValue === 'number' ? indicatorValue : indicatorValue ? 1 : 0;
        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={[styles.viewToggleChip, active && styles.viewToggleChipActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${option.label} memory wall view`}
          >
            <Text style={[styles.viewToggleLabel, active && styles.viewToggleLabelActive]}>{option.label}</Text>
            {indicatorCount > 0 ? (
              <View style={styles.viewToggleBadge}>
                <Text style={styles.viewToggleBadgeText}>{indicatorCount > 9 ? '9+' : indicatorCount}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

interface MemoryWallViewsProps {
  dayGroups: DayGroup[];
  emptyAction?: ReactNode;
  emptyHint: string;
  getGridExtraHeight?: (post: WallPost) => number;
  promptContent?: ReactNode;
  renderPost: (post: WallPost, context?: { viewMode: RenderedMemoryWallViewMode }) => ReactNode;
  themeColors?: ColorTokens;
  viewMode: MemoryWallViewMode;
}

export function MemoryWallViews({ dayGroups, emptyAction, emptyHint, getGridExtraHeight, promptContent, renderPost, themeColors, viewMode }: MemoryWallViewsProps) {
  const { colors: appColors, fonts } = useTheme();
  const colors = themeColors ?? appColors;
  const styles = useMemo(() => makeStyles(colors, fonts, colors.accent), [colors, fonts]);
  const posts = useMemo(() => dayGroups.flatMap((group) => group.posts), [dayGroups]);
  const postSignature = useMemo(() => posts.map((post) => post.id).join('|'), [posts]);
  const [visiblePostLimit, setVisiblePostLimit] = useState(INITIAL_WALL_RENDER_COUNT);

  useEffect(() => {
    setVisiblePostLimit(INITIAL_WALL_RENDER_COUNT);
  }, [postSignature, viewMode]);

  useEffect(() => {
    if (viewMode === 'prompts' || visiblePostLimit >= posts.length) return undefined;
    const id = setTimeout(() => {
      setVisiblePostLimit((current) => Math.min(posts.length, current + WALL_RENDER_BATCH_SIZE));
    }, 120);
    return () => clearTimeout(id);
  }, [posts.length, viewMode, visiblePostLimit]);
  const visiblePosts = useMemo(() => posts.slice(0, visiblePostLimit), [posts, visiblePostLimit]);
  const visibleDayGroups = useMemo(() => limitDayGroups(dayGroups, visiblePostLimit), [dayGroups, visiblePostLimit]);

  if (viewMode === 'prompts') {
    return (
      <View style={styles.promptState}>
        {promptContent ?? (
          <>
            <Text style={styles.emptyHint}>No prompt questions yet.</Text>
            {emptyAction}
          </>
        )}
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyHint}>{emptyHint}</Text>
        {emptyAction}
      </View>
    );
  }

  if (viewMode === 'grid') {
    return <MemoryWallGrid getGridExtraHeight={getGridExtraHeight} posts={visiblePosts} renderPost={renderPost} themeColors={colors} />;
  }

  return <MonthMemoryWallContent dayGroups={visibleDayGroups} renderPost={(post) => renderPost(post, { viewMode: 'timeline' })} themeColors={colors} />;
}

function limitDayGroups(dayGroups: DayGroup[], limit: number): DayGroup[] {
  let remaining = limit;
  const limited: DayGroup[] = [];
  for (const group of dayGroups) {
    if (remaining <= 0) break;
    const posts = group.posts.slice(0, remaining);
    if (posts.length > 0) limited.push({ ...group, posts });
    remaining -= posts.length;
  }
  return limited;
}

interface MemoryWallModeContentProps {
  getGridExtraHeight?: (post: WallPost) => number;
  posts: WallPost[];
  renderPost: (post: WallPost, context?: { viewMode: RenderedMemoryWallViewMode }) => ReactNode;
  themeColors: ColorTokens;
}

function MemoryWallGrid({ getGridExtraHeight, posts, renderPost, themeColors }: MemoryWallModeContentProps) {
  const { fonts } = useTheme();
  const { width } = useWindowDimensions();
  const columnCount = width >= 620 ? 3 : 2;
  const baseScale = columnCount === 3 ? 0.54 : 0.62;
  const approximateGridWidth = Math.max(300, width - spacing.xl * 2);
  const columnVisualWidth = (approximateGridWidth - spacing.md * (columnCount - 1)) / columnCount;
  const columns = useMemo(() => buildMasonryColumns(posts, columnCount, baseScale, columnVisualWidth, getGridExtraHeight), [baseScale, columnCount, columnVisualWidth, getGridExtraHeight, posts]);
  const styles = useMemo(() => makeStyles(themeColors, fonts, themeColors.accent), [fonts, themeColors]);

  return (
    <View style={styles.gridColumns}>
      {columns.map((column, columnIndex) => (
        <View key={`grid-column-${columnIndex}`} style={styles.gridColumn}>
          {column.items.map(({ post, scale, visualWidth, visualHeight, cardRealHeight, cardRealWidth }) => (
            <View key={post.id} style={[styles.gridCell, { height: visualHeight }]}>
              <View
                style={[
                  styles.scaledViewport,
                  {
                    width: visualWidth,
                    height: visualHeight,
                  },
                ]}
              >
                <View
                  style={[
                    styles.scaledCard,
                    {
                      width: cardRealWidth,
                      height: cardRealHeight,
                      transform: [{ scale }],
                    },
                  ]}
                >
                  {renderPost(post, { viewMode: 'grid' })}
                </View>
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

interface MasonryItem {
  post: WallPost;
  scale: number;
  visualWidth: number;
  visualHeight: number;
  cardRealHeight: number;
  cardRealWidth: number;
}

interface MasonryColumn {
  items: MasonryItem[];
  height: number;
}

function buildMasonryColumns(posts: WallPost[], columnCount: number, baseScale: number, columnVisualWidth: number, getGridExtraHeight?: (post: WallPost) => number): MasonryColumn[] {
  const columns: MasonryColumn[] = Array.from({ length: columnCount }, () => ({ items: [], height: 0 }));

  for (const post of posts) {
    const item = getMasonryItem(post, baseScale, columnVisualWidth, getGridExtraHeight?.(post) ?? 0);
    const targetColumn = columns.reduce((shortest, column) => (column.height < shortest.height ? column : shortest), columns[0]);
    targetColumn.items.push(item);
    targetColumn.height += item.visualHeight + spacing.lg;
  }

  return columns;
}

function getMasonryItem(post: WallPost, baseScale: number, columnVisualWidth: number, extraHeight: number): MasonryItem {
  const cardRealHeight = getRealCardHeight(post) + extraHeight;
  const cardRealWidth = getRealCardWidth(post);
  const widthScale = (columnVisualWidth + getGridOverflowAllowance(post)) / cardRealWidth;
  const scale = Math.min(getMaxGridScale(post, baseScale), widthScale);

  return {
    post,
    scale,
    visualWidth: cardRealWidth * scale,
    visualHeight: cardRealHeight * scale,
    cardRealHeight,
    cardRealWidth,
  };
}

function getMaxGridScale(post: WallPost, baseScale: number) {
  if (post.song && post.postType !== 'song') return Math.min(0.56, baseScale);
  if (post.postType === 'song') return Math.min(0.62, baseScale);
  if (post.postType === 'voice') return Math.min(0.66, baseScale);
  return baseScale;
}

function getGridOverflowAllowance(post: WallPost) {
  if (post.song && post.postType !== 'song') return 34;
  return 6;
}

const POLAROID_REAL_WIDTH = 260;
const ATTACHED_SONG_REAL_WIDTH = 360;
const ATTACHED_VOICE_REAL_HEIGHT = 48;
const PROMPT_TEXT_REAL_HEIGHT = 56;
const PROMPT_VOICE_REAL_HEIGHT = 34;

function getRealCardHeight(post: WallPost) {
  const promptExtra = !post.imageUri
    ? (post.promptText ? PROMPT_TEXT_REAL_HEIGHT : 0) + (post.promptVoice ? PROMPT_VOICE_REAL_HEIGHT : 0)
    : 0;
  const referenceExtra = post.referencedWallPostId && post.promptType !== 'photo_reference' ? 315 : 0;
  const voiceExtra = post.voice && post.postType !== 'voice' ? ATTACHED_VOICE_REAL_HEIGHT : 0;
  if (post.song && post.postType !== 'song') return 780 + promptExtra + referenceExtra + voiceExtra;
  if (post.postType === 'song') return (promptExtra > 0 ? 255 : 530) + promptExtra + voiceExtra;
  if (post.postType === 'voice') return 360 + promptExtra;
  if (post.postType === 'movie') return 390 + promptExtra + voiceExtra;
  if (post.postType === 'note') {
    if (post.promptType === 'photo_reference' && post.referencedWallPostId) {
      return 440 + promptExtra + voiceExtra;
    }
    return 320 + promptExtra + referenceExtra + voiceExtra;
  }
  return 440 + promptExtra + voiceExtra;
}

function getRealCardWidth(post: WallPost) {
  if (post.song && post.postType !== 'song') return ATTACHED_SONG_REAL_WIDTH;
  if (post.postType === 'movie') return POLAROID_REAL_WIDTH;
  return POLAROID_REAL_WIDTH;
}

const makeStyles = (colors: ColorTokens, fonts: FontSet, tint: string) =>
  StyleSheet.create({
    emptyState: {
      gap: spacing.md,
      alignItems: 'center',
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: withAlpha(colors.line, 0.7),
      backgroundColor: withAlpha(colors.paper, 0.72),
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 18,
      elevation: 3,
    },
    promptState: {
      gap: spacing.sm,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: withAlpha(colors.line, 0.62),
      backgroundColor: withAlpha(colors.paper, 0.58),
      padding: spacing.sm,
    },
    emptyHint: { fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 21, color: colors.inkSoft, textAlign: 'center' },
    viewToggle: {
      flexDirection: 'row',
      gap: spacing.xs,
      borderRadius: radius.pill,
      backgroundColor: withAlpha(colors.paper, 0.68),
      padding: 5,
      borderWidth: 1,
      borderColor: withAlpha(colors.line, 0.7),
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.08,
      shadowRadius: 14,
      elevation: 2,
    },
    viewToggleChip: {
      flex: 1,
      alignItems: 'center',
      borderRadius: radius.pill,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.xs,
      position: 'relative',
    },
    viewToggleChipActive: {
      backgroundColor: withAlpha(tint, 0.14),
      borderWidth: 1,
      borderColor: withAlpha(colors.line, 0.42),
    },
    viewToggleLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.ink,
    },
    viewToggleLabelActive: { color: tint },
    viewToggleBadge: {
      position: 'absolute',
      top: -6,
      right: spacing.sm,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      backgroundColor: colors.error,
      borderWidth: 1,
      borderColor: colors.paper,
    },
    viewToggleBadgeText: {
      fontFamily: fonts.bodyBold,
      fontSize: 9,
      color: colors.white,
    },
    gridColumns: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
    },
    gridColumn: {
      flex: 1,
      alignItems: 'center',
      gap: spacing.lg,
    },
    gridCell: {
      alignItems: 'center',
      justifyContent: 'flex-start',
      overflow: 'visible',
    },
    scaledViewport: {
      overflow: 'visible',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
    },
    scaledCard: {
      alignItems: 'center',
      overflow: 'visible',
      transformOrigin: 'top left',
    },
  });

function withAlpha(color: string, alpha: number) {
  const match = /^#([0-9a-f]{6})$/i.exec(color);
  if (!match) return color;
  const value = match[1];
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
