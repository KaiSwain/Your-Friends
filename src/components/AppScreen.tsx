import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Keyboard, KeyboardAvoidingView, NativeScrollEvent, NativeSyntheticEvent, Platform, RefreshControl, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { CachedRemoteImage } from './CachedRemoteImage';
import { useAuth } from '../features/auth/AuthContext';
import { useScrollChrome } from '../features/navigation/ScrollChromeContext';
import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { spacing } from '../theme/tokens';

const FLOATING_TAB_BAR_CLEARANCE = 64 + spacing.xxl + spacing.sm;
const FLOATING_TAB_BAR_FOOTER_CLEARANCE = 64 + spacing.sm;

interface AppScreenProps {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
  footerAvoidsFloatingTabBar?: boolean;
  gradientColors?: readonly string[];
  header?: ReactNode;
  scroll?: boolean;
  scrollEnabled?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  stickyHeaderIndices?: number[];
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  floatingHeaderOnScroll?: boolean;
  safeAreaEdges?: Edge[];
  scrollViewRef?: RefObject<ScrollView | null>;
}

const EDGE_TO_EDGE_SAFE_AREA_EDGES: Edge[] = ['left', 'right'];

export function AppScreen({ children, contentContainerStyle, footer, footerAvoidsFloatingTabBar = false, gradientColors, header, scroll = true, scrollEnabled = true, onRefresh, refreshing = false, stickyHeaderIndices, onScroll, floatingHeaderOnScroll = false, safeAreaEdges = EDGE_TO_EDGE_SAFE_AREA_EDGES, scrollViewRef }: AppScreenProps) {
  const { backgroundBlur, colors, resolvedMode } = useTheme();
  const { currentUser } = useAuth();
  const { setScrollChromeHidden } = useScrollChrome();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors, resolvedMode), [colors, resolvedMode]);
  const appBackgroundUri = gradientColors ? null : currentUser?.profileBgImagePath ?? null;
  const resolvedGradientColors = (gradientColors ?? (appBackgroundUri ? ['transparent', 'transparent'] : [colors.canvas, colors.canvasAlt, colors.canvas])) as readonly [string, string, ...string[]];
  const transparentGradient = Boolean(gradientColors?.every(isTransparentColor));
  const appBackgroundImageStyle = appBackgroundUri
    ? [styles.backgroundImage, { opacity: resolvedMode === 'light' ? 0.82 : 0.72 }]
    : styles.backgroundImage;
  const appBackgroundScrimStyle = resolvedMode === 'light'
    ? [styles.backgroundScrim, { backgroundColor: colors.canvas + '73' }]
    : [styles.backgroundScrim, { backgroundColor: colors.canvas + '99' }];
  const appBackgroundTintStyle = [
    styles.backgroundTint,
    {
      backgroundColor: colors.accentSoft ?? colors.accent,
      opacity: resolvedMode === 'light' ? 0.035 : 0.14,
    },
  ];
  const hasTopSafeArea = safeAreaEdges.includes('top');
  const hasBottomSafeArea = safeAreaEdges.includes('bottom');
  const topInset = hasTopSafeArea ? 0 : insets.top;
  const bottomInset = hasBottomSafeArea ? 0 : insets.bottom;
  const headerAnim = useRef(new Animated.Value(1)).current;
  const headerVisibleRef = useRef(true);
  const isDraggingRef = useRef(false);
  const isMomentumScrollingRef = useRef(false);
  const scrollIdleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [headerInteractive, setHeaderInteractive] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => () => {
    if (scrollIdleTimerRef.current) clearTimeout(scrollIdleTimerRef.current);
    setScrollChromeHidden(false);
  }, [setScrollChromeHidden]);

  const setFloatingHeaderVisible = useCallback((visible: boolean) => {
    if (headerVisibleRef.current === visible) return;
    headerVisibleRef.current = visible;
    setHeaderInteractive(visible);
    Animated.timing(headerAnim, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [headerAnim]);

  const setScrollChromeVisible = useCallback((visible: boolean) => {
    if (floatingHeaderOnScroll && header) setFloatingHeaderVisible(visible);
    setScrollChromeHidden(!visible);
  }, [floatingHeaderOnScroll, header, setFloatingHeaderVisible, setScrollChromeHidden]);

  const clearScrollIdleTimer = useCallback(() => {
    if (!scrollIdleTimerRef.current) return;
    clearTimeout(scrollIdleTimerRef.current);
    scrollIdleTimerRef.current = null;
  }, []);

  const finishScrollIfIdle = useCallback(() => {
    if (isDraggingRef.current || isMomentumScrollingRef.current) return;
    clearScrollIdleTimer();
    setScrollChromeVisible(true);
  }, [clearScrollIdleTimer, setScrollChromeVisible]);

  const scheduleScrollFinish = useCallback(() => {
    clearScrollIdleTimer();
    scrollIdleTimerRef.current = setTimeout(finishScrollIfIdle, 140);
  }, [clearScrollIdleTimer, finishScrollIfIdle]);

  const handleScrollBeginDrag = useCallback(() => {
    isDraggingRef.current = true;
    clearScrollIdleTimer();
    setScrollChromeVisible(false);
  }, [clearScrollIdleTimer, setScrollChromeVisible]);

  const handleScrollEndDrag = useCallback(() => {
    isDraggingRef.current = false;
    scheduleScrollFinish();
  }, [scheduleScrollFinish]);

  const handleMomentumScrollBegin = useCallback(() => {
    isMomentumScrollingRef.current = true;
    clearScrollIdleTimer();
    setScrollChromeVisible(false);
  }, [clearScrollIdleTimer, setScrollChromeVisible]);

  const handleMomentumScrollEnd = useCallback(() => {
    isMomentumScrollingRef.current = false;
    finishScrollIfIdle();
  }, [finishScrollIfIdle]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    onScroll?.(event);

    setScrollChromeVisible(false);
    scheduleScrollFinish();
  }, [onScroll, scheduleScrollFinish, setScrollChromeVisible]);

  const floatingHeaderStyle = useMemo(
    () => ({
      opacity: headerAnim,
      transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
    }),
    [headerAnim],
  );

  const floatingHeaderPaddingTop = floatingHeaderOnScroll && header
    ? topInset + (headerHeight > 0 ? headerHeight + spacing.sm : 72)
    : undefined;
  const contentPaddingTop = !header ? topInset + spacing.md : undefined;
  const screenPaddingBottom = getNumericPaddingBottom(contentContainerStyle);
  const keyboardFallbackPadding = Platform.OS === 'ios' ? 0 : keyboardHeight;
  const contentPaddingBottom = bottomInset + FLOATING_TAB_BAR_CLEARANCE + screenPaddingBottom + keyboardFallbackPadding;
  const footerPaddingBottom = bottomInset + spacing.lg + (footerAvoidsFloatingTabBar ? FLOATING_TAB_BAR_FOOTER_CLEARANCE : 0);

  const body = scroll ? (
    <ScrollView
      ref={scrollViewRef}
      style={styles.body}
      showsVerticalScrollIndicator={false}
      scrollEnabled={scrollEnabled}
      stickyHeaderIndices={stickyHeaderIndices}
      onScroll={handleScroll}
      onScrollBeginDrag={handleScrollBeginDrag}
      onScrollEndDrag={handleScrollEndDrag}
      onMomentumScrollBegin={handleMomentumScrollBegin}
      onMomentumScrollEnd={handleMomentumScrollEnd}
      scrollEventThrottle={16}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle, { paddingBottom: contentPaddingBottom }, contentPaddingTop ? { paddingTop: contentPaddingTop } : undefined, floatingHeaderPaddingTop ? { paddingTop: floatingHeaderPaddingTop } : undefined]}
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.body, styles.staticContent, contentContainerStyle, { paddingBottom: contentPaddingBottom }, contentPaddingTop ? { paddingTop: contentPaddingTop } : undefined, floatingHeaderPaddingTop ? { paddingTop: floatingHeaderPaddingTop } : undefined]}>{children}</View>
  );

  return (
    <LinearGradient colors={resolvedGradientColors} style={[styles.gradient, transparentGradient && styles.transparentGradient]}>
      <View pointerEvents="none" style={styles.backgroundTexture}>
        <View style={styles.backgroundGlowTop} />
        <View style={styles.backgroundGlowMiddle} />
        <View style={styles.backgroundGlowBottom} />
        <View style={styles.backgroundPaperWash} />
      </View>
      {appBackgroundUri ? (
        <View pointerEvents="none" style={styles.backgroundLayer}>
          <CachedRemoteImage uri={appBackgroundUri} style={appBackgroundImageStyle} blurRadius={backgroundBlur} priority="low" />
          <View style={appBackgroundTintStyle} />
          <View style={appBackgroundScrimStyle} />
        </View>
      ) : null}
      <SafeAreaView style={styles.safeArea} edges={safeAreaEdges}>
        {header ? (
          floatingHeaderOnScroll ? (
            <Animated.View
              pointerEvents={headerInteractive ? 'box-none' : 'none'}
              onLayout={(event) => {
                const nextHeight = event.nativeEvent.layout.height;
                if (nextHeight > 0 && nextHeight !== headerHeight) setHeaderHeight(nextHeight);
              }}
              style={[styles.floatingHeader, { top: topInset }, floatingHeaderStyle]}
            >
              {header}
            </Animated.View>
          ) : (
            <View style={[styles.header, { paddingTop: topInset + spacing.md }]}>
              {header}
            </View>
          )
        ) : null}
        <KeyboardAvoidingView
          style={styles.body}
          behavior={scroll ? undefined : Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        >
          {body}
          {footer ? <View style={[styles.footer, { paddingBottom: footerPaddingBottom }]}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function getNumericPaddingBottom(style: StyleProp<ViewStyle>) {
  const flattened = StyleSheet.flatten(style);
  return typeof flattened?.paddingBottom === 'number' ? flattened.paddingBottom : 0;
}

function isTransparentColor(color: string) {
  return color === 'transparent' || /^rgba\([^)]*,\s*0(?:\.0+)?\)$/i.test(color.trim());
}

const makeStyles = (colors: ColorTokens, mode: 'light' | 'dark') => {
  const light = mode === 'light';
  return StyleSheet.create({
    gradient: { flex: 1, backgroundColor: colors.canvas },
    transparentGradient: { backgroundColor: 'transparent' },
    backgroundTexture: {
      ...StyleSheet.absoluteFillObject,
      overflow: 'hidden',
    },
    backgroundGlowTop: {
      position: 'absolute',
      top: -150,
      right: -110,
      width: 320,
      height: 320,
      borderRadius: 160,
      backgroundColor: colors.accent + (light ? '0D' : '14'),
    },
    backgroundGlowMiddle: {
      position: 'absolute',
      top: '26%',
      left: -130,
      width: 270,
      height: 270,
      borderRadius: 135,
      backgroundColor: (colors.accentSoft ?? colors.accent) + (light ? '07' : '09'),
    },
    backgroundGlowBottom: {
      position: 'absolute',
      bottom: -160,
      left: -120,
      width: 340,
      height: 340,
      borderRadius: 170,
      backgroundColor: (colors.accentAlt ?? colors.accent) + (light ? '08' : '0D'),
    },
    backgroundPaperWash: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.white + (light ? '18' : '03'),
    },
    backgroundLayer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 0,
      backgroundColor: colors.canvas,
    },
    backgroundImage: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
      transform: [{ scale: 1.04 }],
    },
    backgroundScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.canvas + '99',
    },
    backgroundTint: {
      ...StyleSheet.absoluteFillObject,
    },
    safeArea: { flex: 1 },
    body: { flex: 1 },
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      gap: spacing.lg,
    },
    staticContent: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xxl,
      gap: spacing.lg,
    },
    footer: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.lg,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      alignItems: 'flex-start',
    },
    floatingHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 20,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      alignItems: 'flex-start',
    },
  });
};