import { useRouter } from 'expo-router';
import { useMemo, useRef, useEffect } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../features/auth/AuthContext';
import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import type { FontSet } from '../theme/typography';
import { spacing } from '../theme/tokens';
import { ThemedGlyph } from './ThemedGlyph';

const DRAWER_WIDTH = Dimensions.get('window').width * 0.75;

interface DrawerMenuProps {
  visible: boolean;
  onClose: () => void;
}

export function DrawerMenu({ visible, onClose }: DrawerMenuProps) {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateX, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateX, { toValue: -DRAWER_WIDTH, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, translateX, opacity]);

  if (!visible && (translateX as any)._value === -DRAWER_WIDTH) return null;

  function navigate(href: string) {
    onClose();
    setTimeout(() => router.push(href as any), 260);
  }

  return (
    <View style={styles.overlay} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
        <Text style={styles.appName}>Your Friends</Text>
        {currentUser && <Text style={styles.userName}>{currentUser.displayName}</Text>}

        <View style={styles.links}>
          <Pressable onPress={() => navigate('/(app)/friends')} style={styles.linkRow}>
            <ThemedGlyph name="home" size={20} color={colors.accent} />
            <Text style={styles.linkLabel}>Home</Text>
          </Pressable>
          <Pressable onPress={() => navigate('/(app)/profiles/me')} style={styles.linkRow}>
            <ThemedGlyph name="profile" size={20} color={colors.accent} />
            <Text style={styles.linkLabel}>Your Profile</Text>
          </Pressable>
          <Pressable onPress={() => navigate('/(app)/settings')} style={styles.linkRow}>
            <ThemedGlyph name="settings" size={20} color={colors.accent} />
            <Text style={styles.linkLabel}>Settings</Text>
          </Pressable>
          <Pressable onPress={() => navigate('/(app)/store')} style={styles.linkRow}>
            <ThemedGlyph name="store" size={20} color={colors.accent} />
            <Text style={styles.linkLabel}>Store</Text>
          </Pressable>
          <Pressable onPress={() => navigate('/(app)/friends/add')} style={styles.linkRow}>
            <ThemedGlyph name="addFriend" size={20} color={colors.accent} />
            <Text style={styles.linkLabel}>Add Friend</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    overlay: { ...StyleSheet.absoluteFillObject, zIndex: 100 },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
    drawer: {
      position: 'absolute', top: 0, left: 0, bottom: 0, width: DRAWER_WIDTH,
      backgroundColor: colors.canvas, paddingTop: 60, paddingHorizontal: spacing.lg,
    },
    appName: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink, marginBottom: spacing.xs },
    userName: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, marginBottom: spacing.lg },
    links: { gap: spacing.xs },
    linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
    linkLabel: { fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.ink },
  });
