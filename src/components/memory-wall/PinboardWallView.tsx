import { ComponentType, ReactNode, useMemo } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { useTheme } from '../../features/theme/ThemeContext';
import type { ColorTokens } from '../../features/theme/themes';
import type { SaveWallPostLayoutInput, WallPost, WallPostLayout, WallPostLayoutContext } from '../../types/domain';
import { radius, spacing } from '../../theme/tokens';
import { buildPinboardFallbackLayouts, getPinColor, getPinboardCardMetrics } from './pinboardLayout';

interface PinboardContext {
  ownerUserId: string;
  wallContext: WallPostLayoutContext;
  wallContextId: string;
}

export interface PinboardWallViewProps {
  onResetLayout?: (wallPostId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onSaveLayout?: (layout: SaveWallPostLayoutInput) => Promise<{ ok: true } | { ok: false; error: string }>;
  pinboardContext?: PinboardContext;
  posts: WallPost[];
  renderPost: (post: WallPost) => ReactNode;
  savedLayouts: WallPostLayout[];
  themeColors: ColorTokens;
}

export function PinboardWallView(props: PinboardWallViewProps) {
  if (shouldUseNativePinboard()) {
    const NativePinboard = require('./PinboardWallViewNativeImpl').PinboardWallView as ComponentType<PinboardWallViewProps>;
    return <NativePinboard {...props} />;
  }

  const { posts, renderPost, savedLayouts, themeColors } = props;
  const { fonts } = useTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(themeColors, fonts), [fonts, themeColors]);
  const boardWidth = Math.max(width * 1.45, 720);
  const fallback = useMemo(() => buildPinboardFallbackLayouts(posts, boardWidth), [boardWidth, posts]);
  const savedLayoutByPostId = useMemo(() => new Map(savedLayouts.map((layout) => [layout.wallPostId, layout])), [savedLayouts]);
  const positionedPosts = useMemo(() => posts.map((post, index) => {
    const metrics = getPinboardCardMetrics(post);
    const saved = savedLayoutByPostId.get(post.id);
    const fallbackPosition = fallback.layouts.get(post.id);
    if (!fallbackPosition) return null;
    const position = saved ? { scale: saved.scale, x: saved.x, y: saved.y, zIndex: saved.zIndex } : fallbackPosition;
    return { index, metrics, pinColor: getPinColor(post.id), position, post };
  }).filter((item): item is NonNullable<typeof item> => item !== null), [fallback.layouts, posts, savedLayoutByPostId]);

  return (
    <View style={styles.frame}>
      <View style={styles.toolbar}>
        <View style={styles.toolbarText}>
          <Text style={styles.title}>Pinboard preview</Text>
          <Text style={styles.subtitle}>Interactive Miro-style editing needs a development build. Expo Go shows this safe preview.</Text>
        </View>
      </View>
      <ScrollView horizontal bounces style={styles.canvasViewport}>
        <ScrollView bounces>
          <View style={[styles.surface, { width: boardWidth, height: fallback.boardHeight }]}>
            <BoardGrid width={boardWidth} height={fallback.boardHeight} colors={themeColors} />
            <FairyLights width={boardWidth} colors={themeColors} />
            {positionedPosts.map(({ metrics, pinColor, position, post }) => (
              <View
                key={post.id}
                style={[
                  styles.previewCard,
                  {
                    left: position.x,
                    top: position.y,
                    width: metrics.realWidth * position.scale,
                    height: metrics.realHeight * position.scale,
                    transform: [{ rotate: `${metrics.rotation}deg` }],
                    zIndex: position.zIndex,
                  },
                ]}
              >
                <View pointerEvents="none" style={[styles.pinDot, { backgroundColor: pinColor }]} />
                <View style={[styles.scaledCard, { width: metrics.realWidth, height: metrics.realHeight, transform: [{ scale: position.scale }] }]}>
                  {renderPost(post)}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

function shouldUseNativePinboard() {
  return Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
}

function BoardGrid({ colors, height, width }: { colors: ColorTokens; height: number; width: number }) {
  const gridSize = 72;
  const verticalLines = Math.ceil(width / gridSize);
  const horizontalLines = Math.ceil(height / gridSize);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: verticalLines }).map((_, index) => (
        <View key={`v-${index}`} style={[stylesStatic.gridLineVertical, { left: index * gridSize, backgroundColor: colors.line + '66' }]} />
      ))}
      {Array.from({ length: horizontalLines }).map((_, index) => (
        <View key={`h-${index}`} style={[stylesStatic.gridLineHorizontal, { top: index * gridSize, backgroundColor: colors.line + '66' }]} />
      ))}
    </View>
  );
}

function FairyLights({ colors, width }: { colors: ColorTokens; width: number }) {
  const lightCount = Math.max(8, Math.floor(width / 74));
  const lights = Array.from({ length: lightCount });
  return (
    <View pointerEvents="none" style={stylesStatic.fairyLayer}>
      <View style={[stylesStatic.fairyCord, { backgroundColor: colors.inkSoft + '55' }]} />
      {lights.map((_, index) => (
        <View
          key={index}
          style={[
            stylesStatic.fairyBulb,
            {
              left: 24 + index * 72,
              top: index % 2 === 0 ? 24 : 40,
              backgroundColor: index % 3 === 0 ? colors.accent : index % 3 === 1 ? '#F8DDA8' : colors.paper,
              borderColor: colors.paper,
            },
          ]}
        />
      ))}
    </View>
  );
}

const makeStyles = (colors: ColorTokens, fonts: ReturnType<typeof useTheme>['fonts']) =>
  StyleSheet.create({
    frame: {
      height: 580,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      overflow: 'hidden',
      backgroundColor: colors.paper,
    },
    canvasViewport: {
      flex: 1,
      overflow: 'hidden',
      backgroundColor: colors.paperMuted,
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
      backgroundColor: colors.paper,
    },
    toolbarText: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontFamily: fonts.heading,
      fontSize: 18,
      color: colors.ink,
    },
    subtitle: {
      marginTop: 2,
      fontFamily: fonts.body,
      fontSize: 12,
      color: colors.inkMuted,
    },
    surface: {
      position: 'relative',
      backgroundColor: colors.paperMuted,
      overflow: 'hidden',
      transformOrigin: 'top left',
    },
    previewCard: {
      position: 'absolute',
      alignItems: 'center',
      overflow: 'visible',
    },
    pinDot: {
      position: 'absolute',
      top: 2,
      width: 12,
      height: 12,
      borderRadius: 6,
      zIndex: 6,
      borderWidth: 2,
      borderColor: colors.paper,
    },
    scaledCard: {
      alignItems: 'center',
      overflow: 'visible',
      transformOrigin: 'top left',
    },
  });

const stylesStatic = StyleSheet.create({
  fairyLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 82,
    zIndex: 1,
  },
  fairyCord: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 36,
    height: 2,
    transform: [{ rotate: '-1.5deg' }],
  },
  fairyBulb: {
    position: 'absolute',
    width: 14,
    height: 18,
    borderRadius: 7,
    borderWidth: 1,
    shadowColor: '#F8DDA8',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  gridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
  },
  gridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
  },
});
