import { BlurView } from 'expo-blur';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import { subscribePhotoSourceSheet, type PhotoSourceSheetRequest } from '../lib/photoSourceSheet';
import type { ColorTokens } from '../features/theme/themes';
import type { FontSet } from '../theme/typography';
import { radius, spacing } from '../theme/tokens';

export function PhotoSourceSheetHost() {
  const { colors, fonts, resolvedMode } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [request, setRequest] = useState<PhotoSourceSheetRequest | null>(null);

  useEffect(() => subscribePhotoSourceSheet(setRequest), []);

  function close() {
    setRequest(null);
  }

  function choose(action: () => void) {
    close();
    requestAnimationFrame(action);
  }

  return (
    <Modal visible={!!request} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheetHitArea} onPress={(event) => event.stopPropagation()}>
          <BlurView intensity={64} tint={resolvedMode === 'dark' ? 'dark' : 'light'} style={styles.sheet}>
            <View style={styles.sheetTintStrong} />
            <View style={styles.sheetTintSoft} />
            <View style={styles.glassHighlight} />
            <View style={styles.content}>
              <Text style={styles.title}>{request?.title ?? 'Add Photo'}</Text>
              <Pressable onPress={() => request && choose(request.onCamera)} style={({ pressed }) => [styles.option, pressed && styles.optionPressed]} accessibilityRole="button" accessibilityLabel="Take photo">
                <Text style={styles.optionLabel}>Take Photo</Text>
              </Pressable>
              <Pressable onPress={() => request && choose(request.onGallery)} style={({ pressed }) => [styles.option, pressed && styles.optionPressed]} accessibilityRole="button" accessibilityLabel={request?.galleryLabel ?? 'Choose from Gallery'}>
                <Text style={styles.optionLabel}>{request?.galleryLabel ?? 'Choose from Gallery'}</Text>
              </Pressable>
            </View>
          </BlurView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
      backgroundColor: 'rgba(20, 12, 18, 0.18)',
    },
    sheetHitArea: {
      width: '100%',
      maxWidth: 330,
      borderRadius: 34,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 0.22,
      shadowRadius: 30,
      elevation: 18,
    },
    sheet: {
      overflow: 'hidden',
      borderRadius: 34,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.white + '55',
      backgroundColor: colors.paper + '77',
    },
    sheetTintStrong: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.ink + '4D',
    },
    sheetTintSoft: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.paper + '2E',
    },
    glassHighlight: {
      position: 'absolute',
      left: 18,
      right: 18,
      top: 1,
      height: 1,
      backgroundColor: colors.white + '75',
    },
    content: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
      gap: spacing.md,
    },
    title: {
      fontFamily: fonts.bodyMedium,
      fontSize: 19,
      lineHeight: 26,
      color: colors.white,
      textAlign: 'center',
    },
    option: {
      minHeight: 58,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.white + '17',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.white + '1F',
    },
    optionPressed: {
      backgroundColor: colors.white + '28',
      transform: [{ scale: 0.99 }],
    },
    optionLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 18,
      color: colors.white,
      textAlign: 'center',
    },
  });
