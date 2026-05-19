import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Keyboard, KeyboardAvoidingView, NativeScrollEvent, NativeSyntheticEvent, Platform, RefreshControl, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { useAuth } from '../features/auth/AuthContext';
import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { spacing } from '../theme/tokens';

const FLOATING_TAB_BAR_CLEARANCE = 64 + spacing.xxl + spacing.sm;

interface AppScreenProps {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
  gradientColors?: readonly string[];
  header?: ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  stickyHeaderIndices?: number[];
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  floatingHeaderOnScroll?: boolean;
  safeAreaEdges?: Edge[];
  scrollViewRef?: RefObject<ScrollView | null>;
}

const EDGE_TO_EDGE_SAFE_AREA_EDGES: Edge[] = ['left', 'right'];

export function AppScreen({ children, contentContainerStyle, footer, gradientColors, header, scroll = true, onRefresh, refreshing = false, stickyHeaderIndices, onScroll, floatingHeaderOnScroll = false, safeAreaEdges = EDGE_TO_EDGE_SAFE_AREA_EDGES, scrollViewRef }: AppScreenProps) {
  const { backgroundBlur, colors } = useTheme();
  const { currentUser } = useAuth();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const appBackgroundUri = gradientColors ? null : currentUser?.profileBgImagePath ?? null;
  const resolvedGradientColors = (gradientColors ?? (appBackgroundUri ? ['transparent', 'transparent'] : [colors.canvas, colors.canvasAlt, colors.canvas])) as readonly [string, string, ...string[]];
  const transparentGradient = Boolean(gradientColors?.every(isTransparentColor));
  const hasTopSafeArea = safeAreaEdges.includes('top');
  const hasBottomSafeArea = safeAreaEdges.includes('bottom');
  const topInset = hasTopSafeArea ? 0 : insets.top;
  const bottomInset = hasBottomSafeArea ? 0 : insets.bottom;
  const headerAnim = useRef(new Animated.Value(1)).current;
  const headerVisibleRef = useRef(true);
  const lastScrollOffsetRef = useRef(0);
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

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    onScroll?.(event);

    if (!floatingHeaderOnScroll || !header) return;

    const offsetY = Math.max(0, event.nativeEvent.contentOffset.y);
    const delta = offsetY - lastScrollOffsetRef.current;
    lastScrollOffsetRef.current = offsetY;

    if (offsetY <= 24) {
      setFloatingHeaderVisible(true);
      return;
    }

    if (Math.abs(delta) < 8) return;

    if (delta > 0) {
      setFloatingHeaderVisible(false);
      return;
    }

    setFloatingHeaderVisible(true);
  }, [floatingHeaderOnScroll, header, onScroll, setFloatingHeaderVisible]);

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

  const body = scroll ? (
    <ScrollView
      ref={scrollViewRef}
      style={styles.body}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={stickyHeaderIndices}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      contentContainerStyle={[styles.scrollContent, contentContainerStyle, { paddingBottom: contentPaddingBottom }, contentPaddingTop ? { paddingTop: contentPaddingTop } : undefined, floatingHeaderPaddingTop ? { paddingTop: floatingHeaderPaddingTop } : undefined]}
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.inkSoft} />
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
      {appBackgroundUri ? (
        <View pointerEvents="none" style={styles.backgroundLayer}>
          <Image source={{ uri: appBackgroundUri }} style={styles.backgroundImage} blurRadius={backgroundBlur} />
          <View style={styles.backgroundScrim} />
        </View>
      ) : null}
      <SafeAreaView style={styles.safeArea} edges={safeAreaEdges}>
        {header ? (
          floatingHeaderOnScroll ? (
            <Animated.View
              pointerEvents={headerInteractive ? 'auto' : 'none'}
              onLayout={(event) => {
                const nextHeight = event.nativeEvent.layout.height;
                if (nextHeight > 0 && nextHeight !== headerHeight) setHeaderHeight(nextHeight);
              }}
              style={[styles.floatingHeader, { top: topInset }, floatingHeaderStyle]}
            >
              {header}
            </Animated.View>
          ) : (
            <View style={[styles.header, { paddingTop: topInset + spacing.md }]}>{header}</View>
          )
        ) : null}
        <KeyboardAvoidingView
          style={styles.body}
          behavior={scroll ? undefined : Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        >
          {body}
          {footer ? <View style={[styles.footer, { paddingBottom: bottomInset + spacing.lg }]}>{footer}</View> : null}
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

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    gradient: { flex: 1, backgroundColor: colors.canvas },
    transparentGradient: { backgroundColor: 'transparent' },
    backgroundLayer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 0,
      backgroundColor: colors.canvas,
    },
    backgroundImage: {
      ...StyleSheet.absoluteFillObject,
      width: '100%',
      height: '100%',
      opacity: 0.68,
      transform: [{ scale: 1.04 }],
    },
    backgroundScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.canvas + '99',
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
    },
  });