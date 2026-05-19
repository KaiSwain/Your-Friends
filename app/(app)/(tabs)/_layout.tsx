import { Ionicons } from '@expo/vector-icons';
import {
  MaterialTopTabBarProps,
  MaterialTopTabNavigationEventMap,
  MaterialTopTabNavigationOptions,
  createMaterialTopTabNavigator,
} from '@react-navigation/material-top-tabs';
import { ParamListBase, TabNavigationState } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { useRouter, withLayoutContext } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../src/features/theme/themes';
import { spacing } from '../../../src/theme/tokens';
import type { FontSet } from '../../../src/theme/typography';

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

// Dock metrics shared with screens so they can pad bottom content correctly.
export const DOCK_BAR_HEIGHT = 64;
export const DOCK_BOTTOM_PADDING = spacing.sm;

export default function TabsLayout() {
  return (
    <MaterialTopTabs
      tabBarPosition="bottom"
      tabBar={(props) => <FloatingDockTabBar {...props} />}
      initialRouteName="friends/index"
      screenOptions={{
        swipeEnabled: true,
        animationEnabled: true,
        lazy: true,
        sceneStyle: { backgroundColor: 'transparent' },
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'transparent',
          elevation: 0,
          shadowOpacity: 0,
          borderTopWidth: 0,
        },
      }}
      style={{ backgroundColor: 'transparent' }}
    >
      <MaterialTopTabs.Screen name="calendar" />
      <MaterialTopTabs.Screen name="friends/index" />
      <MaterialTopTabs.Screen name="profiles/me" />
    </MaterialTopTabs>
  );
}

type TabRouteName = 'calendar' | 'friends/index' | 'profiles/me';

function FloatingDockTabBar({ state, navigation }: MaterialTopTabBarProps) {
  const { colors, fonts, resolvedMode } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const blurTint = resolvedMode === 'dark' ? 'dark' : 'light';

  const activeName = state.routes[state.index]?.name as TabRouteName | undefined;
  const isHome = activeName === 'friends/index';
  const isCalendar = activeName === 'calendar';
  const isProfile = activeName === 'profiles/me';

  const bottomPad = Math.max(insets.bottom, spacing.sm) + spacing.sm;

  // Switch tabs by URL navigation (works through expo-router's withLayoutContext
  // wrapper). Falling back to React Navigation's navigate() if needed.
  const goTo = (path: '/calendar' | '/friends' | '/profiles/me', routeName: TabRouteName) => {
    try {
      router.navigate(path);
    } catch {
      (navigation.navigate as (n: string) => void)(routeName);
    }
  };

  return (
    <View pointerEvents="box-none" style={[styles.dockContainer, { paddingBottom: bottomPad }]}>
      <View style={styles.dockBar}>
        <BlurView
          intensity={42}
          tint={blurTint}
          style={[StyleSheet.absoluteFill, styles.dockBlur]}
          pointerEvents="none"
        />
        <Pressable
          onPress={() => router.navigate('/(app)/store')}
          style={({ pressed }) => [styles.storeButton, pressed && styles.dockTabPressed]}
          accessibilityRole="button"
          accessibilityLabel="Open store"
        >
          <Ionicons name="bag-handle-outline" size={20} color={colors.inkSoft} />
        </Pressable>
        <Pressable
          onPress={() => goTo('/calendar', 'calendar')}
          style={({ pressed }) => [
            styles.dockTab,
            isCalendar && styles.dockTabActive,
            pressed && styles.dockTabPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Calendar tab"
          accessibilityState={{ selected: isCalendar }}
        >
          <Ionicons name="calendar-outline" size={20} color={isCalendar ? colors.white : colors.inkSoft} />
          <Text style={[styles.dockTabLabel, isCalendar && styles.dockTabLabelActive]}>Calendar</Text>
        </Pressable>

        <Pressable
          onPress={() => goTo('/friends', 'friends/index')}
          style={({ pressed }) => [
            styles.dockHome,
            !isHome && styles.dockHomeInactive,
            pressed && styles.dockTabPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Home tab"
          accessibilityState={{ selected: isHome }}
        >
          <Ionicons name="home" size={18} color={isHome ? colors.white : colors.inkSoft} />
          <Text style={[styles.dockHomeLabel, !isHome && styles.dockHomeLabelInactive]}>Home</Text>
        </Pressable>

        <Pressable
          onPress={() => goTo('/profiles/me', 'profiles/me')}
          style={({ pressed }) => [
            styles.dockTab,
            isProfile && styles.dockTabActive,
            pressed && styles.dockTabPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Profile tab"
          accessibilityState={{ selected: isProfile }}
        >
          <Ionicons name="person-circle-outline" size={21} color={isProfile ? colors.white : colors.inkSoft} />
          <Text style={[styles.dockTabLabel, isProfile && styles.dockTabLabelActive]}>Profile</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    dockContainer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      paddingTop: spacing.sm,
      backgroundColor: 'transparent',
    },
    dockBar: {
      width: '92%',
      maxWidth: 380,
      height: DOCK_BAR_HEIGHT,
      paddingHorizontal: spacing.xs,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: 'transparent',
      borderRadius: 32,
      borderWidth: 1,
      borderColor: colors.line + '44',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 18,
      elevation: 8,
    },
    dockBlur: {
      borderRadius: 32,
    },
    dockTab: {
      flex: 1,
      height: 52,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 26,
      backgroundColor: 'transparent',
    },
    dockTabActive: {
      backgroundColor: colors.accent,
    },
    dockTabPressed: {
      opacity: 0.6,
    },
    dockTabLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: colors.inkSoft,
    },
    dockTabLabelActive: {
      color: colors.white,
    },
    dockHome: {
      paddingHorizontal: spacing.lg,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.accent,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginHorizontal: 4,
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 8,
    },
    dockHomeInactive: {
      backgroundColor: 'transparent',
      shadowOpacity: 0,
      elevation: 0,
    },
    dockHomeLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 14,
      color: colors.white,
    },
    dockHomeLabelInactive: {
      color: colors.inkSoft,
    },
    storeButton: {
      position: 'absolute',
      top: -56,
      left: 4,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.14,
      shadowRadius: 12,
      elevation: 8,
    },
  });
