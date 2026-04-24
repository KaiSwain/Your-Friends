import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useCallback, useMemo, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, NativeScrollEvent, NativeSyntheticEvent, Platform, RefreshControl, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import { spacing } from '../theme/tokens';

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
}

export function AppScreen({ children, contentContainerStyle, footer, gradientColors, header, scroll = true, onRefresh, refreshing = false, stickyHeaderIndices, onScroll, floatingHeaderOnScroll = false }: AppScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const resolvedGradientColors = (gradientColors ?? [colors.canvas, colors.canvasAlt, colors.canvas]) as readonly [string, string, ...string[]];
  const headerAnim = useRef(new Animated.Value(1)).current;
  const headerVisibleRef = useRef(true);
  const lastScrollOffsetRef = useRef(0);
  const [headerInteractive, setHeaderInteractive] = useState(true);
  const [headerHeight, setHeaderHeight] = useState(0);

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
    ? (headerHeight > 0 ? headerHeight + spacing.sm : 72)
    : undefined;

  const body = scroll ? (
    <ScrollView
      style={styles.body}
      showsVerticalScrollIndicator={false}
      stickyHeaderIndices={stickyHeaderIndices}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      contentContainerStyle={[styles.scrollContent, floatingHeaderPaddingTop ? { paddingTop: floatingHeaderPaddingTop } : undefined, contentContainerStyle]}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.inkSoft} />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.body, styles.staticContent, floatingHeaderPaddingTop ? { paddingTop: floatingHeaderPaddingTop } : undefined, contentContainerStyle]}>{children}</View>
  );

  return (
    <LinearGradient colors={resolvedGradientColors} style={styles.gradient}>
      <SafeAreaView style={styles.safeArea}>
        {header ? (
          floatingHeaderOnScroll ? (
            <Animated.View
              pointerEvents={headerInteractive ? 'auto' : 'none'}
              onLayout={(event) => {
                const nextHeight = event.nativeEvent.layout.height;
                if (nextHeight > 0 && nextHeight !== headerHeight) setHeaderHeight(nextHeight);
              }}
              style={[styles.floatingHeader, { top: insets.top }, floatingHeaderStyle]}
            >
              {header}
            </Animated.View>
          ) : (
            <View style={styles.header}>{header}</View>
          )
        ) : null}
        <KeyboardAvoidingView
          style={styles.body}
          behavior={scroll ? undefined : Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
        >
          {body}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const makeStyles = (_colors: ColorTokens) =>
  StyleSheet.create({
    gradient: { flex: 1 },
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