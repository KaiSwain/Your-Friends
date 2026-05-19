import { ReactNode, useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, SafeAreaView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { useTheme } from '../../features/theme/ThemeContext';
import type { ColorTokens } from '../../features/theme/themes';
import { contrastText } from '../../lib/contrastText';
import type { SaveWallPostLayoutInput, WallPost, WallPostLayout, WallPostLayoutContext } from '../../types/domain';
import { radius, spacing } from '../../theme/tokens';
import { PinboardCard } from './PinboardCard';
import { buildPinboardFallbackLayouts, getPinColor, getPinboardCardMetrics, type PinboardPosition } from './pinboardLayout';

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

export function PinboardWallView({ onResetLayout, onSaveLayout, pinboardContext, posts, renderPost, savedLayouts, themeColors }: PinboardWallViewProps) {
  const { fonts } = useTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => makeStyles(themeColors, fonts), [fonts, themeColors]);
  const [arrangeMode, setArrangeMode] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const canvasX = useSharedValue(0);
  const canvasY = useSharedValue(0);
  const canvasScale = useSharedValue(1);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);
  const [positionOverrides, setPositionOverrides] = useState<Record<string, PinboardPosition>>({});
  const boardWidth = Math.max(width * 1.45, 720);
  const fallback = useMemo(() => buildPinboardFallbackLayouts(posts, boardWidth), [boardWidth, posts]);
  const savedLayoutByPostId = useMemo(() => new Map(savedLayouts.map((layout) => [layout.wallPostId, layout])), [savedLayouts]);
  const metricsByPostId = useMemo(() => new Map(posts.map((post) => [post.id, getPinboardCardMetrics(post)])), [posts]);

  const basePositions = useMemo(() => {
    const positions = new Map<string, PinboardPosition>();
    posts.forEach((post) => {
      const saved = savedLayoutByPostId.get(post.id);
      const fallbackPosition = fallback.layouts.get(post.id);
      if (!fallbackPosition) return;
      positions.set(post.id, saved ? { scale: saved.scale, x: saved.x, y: saved.y, zIndex: saved.zIndex } : fallbackPosition);
    });
    return positions;
  }, [fallback.layouts, posts, savedLayoutByPostId]);

  const resolvedPositions = useMemo(() => {
    const positions = new Map<string, PinboardPosition>();
    basePositions.forEach((position, postId) => {
      positions.set(postId, positionOverrides[postId] ?? position);
    });
    return positions;
  }, [basePositions, positionOverrides]);

  const boardHeight = useMemo(() => {
    let bottom = fallback.boardHeight;
    posts.forEach((post) => {
      const metrics = metricsByPostId.get(post.id);
      const position = resolvedPositions.get(post.id);
      if (!metrics || !position) return;
      bottom = Math.max(bottom, position.y + metrics.realHeight * position.scale + 140);
    });
    return Math.ceil(bottom);
  }, [fallback.boardHeight, metricsByPostId, posts, resolvedPositions]);

  const nextZIndex = useCallback(() => {
    let highest = 0;
    resolvedPositions.forEach((position) => {
      highest = Math.max(highest, position.zIndex);
    });
    return Math.max(highest + 1, Date.now());
  }, [resolvedPositions]);

  const bringCardToFront = useCallback((postId: string) => {
    const current = resolvedPositions.get(postId);
    if (!current) return;
    const zIndex = nextZIndex();
    setPositionOverrides((currentOverrides) => ({
      ...currentOverrides,
      [postId]: { ...(currentOverrides[postId] ?? current), zIndex },
    }));
  }, [nextZIndex, resolvedPositions]);

  const savePosition = useCallback((post: WallPost, position: PinboardPosition) => {
    const metrics = metricsByPostId.get(post.id);
    if (!metrics || !pinboardContext || !onSaveLayout) return;

    void onSaveLayout({
      ownerUserId: pinboardContext.ownerUserId,
      wallContext: pinboardContext.wallContext,
      wallContextId: pinboardContext.wallContextId,
      wallPostId: post.id,
      x: position.x,
      y: position.y,
      scale: position.scale,
      rotation: metrics.rotation,
      zIndex: position.zIndex,
    }).then((result) => {
      if (!result.ok) Alert.alert('Could not save board', result.error);
    });
  }, [metricsByPostId, onSaveLayout, pinboardContext]);

  const handleDragEnd = useCallback((post: WallPost, nextPosition: PinboardPosition) => {
    const current = resolvedPositions.get(post.id);
    const position = {
      ...(current ?? nextPosition),
      scale: nextPosition.scale,
      x: nextPosition.x,
      y: nextPosition.y,
      zIndex: Math.max(current?.zIndex ?? 0, nextPosition.zIndex, Date.now()),
    };

    setPositionOverrides((currentOverrides) => ({
      ...currentOverrides,
      [post.id]: position,
    }));
    savePosition(post, position);
  }, [resolvedPositions, savePosition]);

  const resetCard = useCallback((post: WallPost) => {
    const fallbackPosition = fallback.layouts.get(post.id);
    if (!fallbackPosition) return;

    Alert.alert('Reset card position?', 'This puts the memory back into the automatic pinboard layout.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          const applyFallback = () => {
            setPositionOverrides((currentOverrides) => ({
              ...currentOverrides,
              [post.id]: fallbackPosition,
            }));
          };

          if (!onResetLayout) {
            applyFallback();
            return;
          }

          void onResetLayout(post.id).then((result) => {
            if (!result.ok) {
              Alert.alert('Could not reset card', result.error);
              return;
            }
            applyFallback();
          });
        },
      },
    ]);
  }, [fallback.layouts, onResetLayout]);

  const changeZoom = useCallback((direction: 'in' | 'out') => {
    setZoom((current) => {
      const next = direction === 'in' ? current + 0.15 : current - 0.15;
      const clamped = Math.max(0.65, Math.min(1.8, Number(next.toFixed(2))));
      canvasScale.value = clamped;
      return clamped;
    });
  }, [canvasScale]);

  const syncZoom = useCallback((value: number) => {
    setZoom(value);
  }, []);

  const resizeCard = useCallback((post: WallPost, scale: number) => {
    const current = resolvedPositions.get(post.id);
    if (!current) return;
    const position = {
      ...current,
      scale,
      zIndex: Math.max(current.zIndex, Date.now()),
    };

    setPositionOverrides((currentOverrides) => ({
      ...currentOverrides,
      [post.id]: position,
    }));
    savePosition(post, position);
  }, [resolvedPositions, savePosition]);

  const canvasGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .minDistance(3)
      .onBegin(() => {
        panStartX.value = canvasX.value;
        panStartY.value = canvasY.value;
      })
      .onUpdate((event) => {
        canvasX.value = panStartX.value + event.translationX;
        canvasY.value = panStartY.value + event.translationY;
      });

    const pinch = Gesture.Pinch()
      .onBegin(() => {
        pinchStartScale.value = canvasScale.value;
      })
      .onUpdate((event) => {
        const next = Math.max(0.65, Math.min(1.8, pinchStartScale.value * event.scale));
        canvasScale.value = next;
      })
      .onEnd(() => {
        runOnJS(syncZoom)(Number(canvasScale.value.toFixed(2)));
      });

    return Gesture.Simultaneous(pan, pinch);
  }, [canvasScale, canvasX, canvasY, panStartX, panStartY, pinchStartScale, syncZoom]);

  const canvasAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: canvasX.value },
      { translateY: canvasY.value },
      { scale: canvasScale.value },
    ],
  }));

  const renderToolbar = (mode: 'inline' | 'fullScreen') => (
    <View style={styles.toolbar}>
      <View style={styles.toolbarText}>
        <Text style={styles.title}>Pinboard</Text>
        <Text style={styles.subtitle}>{arrangeMode ? 'Drag cards into place. Tap Done when it feels right.' : 'Scroll the board and open memories normally.'}</Text>
      </View>
      <View style={styles.toolbarActions}>
        <View style={styles.zoomControls}>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom out pinboard" onPress={() => changeZoom('out')} style={styles.zoomButton}>
            <Text style={styles.zoomButtonLabel}>-</Text>
          </Pressable>
          <Text style={styles.zoomValue}>{Math.round(zoom * 100)}%</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Zoom in pinboard" onPress={() => changeZoom('in')} style={styles.zoomButton}>
            <Text style={styles.zoomButtonLabel}>+</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={arrangeMode ? 'Finish arranging pinboard' : 'Arrange pinboard'} onPress={() => setArrangeMode((current) => !current)} style={[styles.modeButton, arrangeMode && styles.modeButtonActive]}>
          <Text style={[styles.modeButtonLabel, arrangeMode && styles.modeButtonLabelActive]}>{arrangeMode ? 'Done' : 'Arrange'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={mode === 'fullScreen' ? 'Close fullscreen pinboard' : 'Open fullscreen pinboard'} onPress={() => setFullScreen(mode !== 'fullScreen')} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonLabel}>{mode === 'fullScreen' ? 'Close' : 'Full screen'}</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderBoard = () => (
    <>
      {arrangeMode ? (
        <View style={styles.instructionPill}>
          <Text style={styles.instructionText}>Arrange mode: drag cards, resize with +/-, pinch to zoom, drag empty space to pan.</Text>
        </View>
      ) : null}
      <GestureDetector gesture={canvasGesture}>
        <View style={styles.canvasViewport}>
          <Animated.View style={[styles.surface, { width: boardWidth, height: boardHeight }, canvasAnimatedStyle]}>
            {arrangeMode ? <BoardGrid width={boardWidth} height={boardHeight} colors={themeColors} /> : null}
            <FairyLights width={boardWidth} colors={themeColors} />
            {posts.map((post) => {
              const metrics = metricsByPostId.get(post.id);
              const position = resolvedPositions.get(post.id);
              if (!metrics || !position) return null;

              return (
                <PinboardCard
                  key={post.id}
                  arrangeMode={arrangeMode}
                  colors={themeColors}
                  fonts={fonts}
                  gestureScale={zoom}
                  metrics={metrics}
                  onBringToFront={() => bringCardToFront(post.id)}
                  onDragEnd={(nextPosition) => handleDragEnd(post, nextPosition)}
                  onReset={() => resetCard(post)}
                  onResize={(scale) => resizeCard(post, scale)}
                  pinColor={getPinColor(post.id)}
                  position={position}
                >
                  {renderPost(post)}
                </PinboardCard>
              );
            })}
          </Animated.View>
        </View>
      </GestureDetector>
    </>
  );

  return (
    <>
      <View style={styles.frame}>
        {renderToolbar('inline')}
        {renderBoard()}
      </View>
      <Modal animationType="slide" presentationStyle="fullScreen" visible={fullScreen} onRequestClose={() => setFullScreen(false)}>
        <SafeAreaView style={styles.fullScreenRoot}>
          {renderToolbar('fullScreen')}
          {renderBoard()}
        </SafeAreaView>
      </Modal>
    </>
  );
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
    toolbarText: { flex: 1, minWidth: 0 },
    toolbarActions: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    zoomControls: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paperMuted, overflow: 'hidden' },
    zoomButton: { minWidth: 30, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
    zoomButtonLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },
    zoomValue: { minWidth: 42, textAlign: 'center', fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.inkSoft },
    title: { fontFamily: fonts.heading, fontSize: 18, color: colors.ink },
    subtitle: { marginTop: 2, fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted },
    modeButton: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paperMuted, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    modeButtonActive: { borderColor: colors.accent, backgroundColor: colors.accent },
    modeButtonLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.ink },
    modeButtonLabelActive: { color: contrastText(colors.accent) },
    secondaryButton: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
    secondaryButtonLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkSoft },
    fullScreenRoot: { flex: 1, backgroundColor: colors.paper },
    instructionPill: { marginHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.accent + '22', borderWidth: 1, borderColor: colors.accent + '66', paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
    instructionText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink, textAlign: 'center' },
    surface: { position: 'relative', backgroundColor: colors.paperMuted, overflow: 'hidden', transformOrigin: 'top left' },
  });

const stylesStatic = StyleSheet.create({
  fairyLayer: { position: 'absolute', top: 0, left: 0, right: 0, height: 82, zIndex: 1 },
  fairyCord: { position: 'absolute', left: 0, right: 0, top: 36, height: 2, transform: [{ rotate: '-1.5deg' }] },
  fairyBulb: { position: 'absolute', width: 14, height: 18, borderRadius: 7, borderWidth: 1, shadowColor: '#F8DDA8', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  gridLineVertical: { position: 'absolute', top: 0, bottom: 0, width: 1 },
  gridLineHorizontal: { position: 'absolute', left: 0, right: 0, height: 1 },
});
