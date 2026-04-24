import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../../src/components/ActionButton';
import { AppScreen } from '../../../src/components/AppScreen';
import { MemoryTextStylePicker } from '../../../src/components/MemoryTextStylePicker';
import { WallPostCard } from '../../../src/components/WallPostCard';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../src/features/theme/themes';
import { getCureProgress } from '../../../src/lib/polaroidCure';
import {
  defaultWallPostTextColor,
  defaultWallPostTextEffect,
  defaultWallPostTextFont,
  defaultWallPostTextSize,
  encodeWallPostTextStyle,
  resolveWallPostTextColor,
  resolveWallPostTextStyle,
} from '../../../src/lib/wallPostTextStyle';
import type { FontSet } from '../../../src/theme/typography';
import { ThemedGlyph } from '../../../src/components/ThemedGlyph';
import { radius, spacing } from '../../../src/theme/tokens';
import { WallPostTextColor, WallPostTextEffect, WallPostTextFont, WallPostTextSize, WallPostVisibility } from '../../../src/types/domain';

export default function EditMemoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ postId: string | string[] }>();
  const { currentUser } = useAuth();
  const { getWallPostById, updateWallPost, deleteWallPost, getUserById } = useSocialGraph();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId;
  const post = getWallPostById(postId ?? '');

  const [body, setBody] = useState(post?.body ?? '');
  const [backText, setBackText] = useState(post?.backText ?? '');
  const [visibility, setVisibility] = useState<WallPostVisibility>(post?.visibility ?? 'private');
  const [showingBack, setShowingBack] = useState(false);
  const [textFont, setTextFont] = useState<WallPostTextFont>(post?.textFont ?? defaultWallPostTextFont);
  const [textSize, setTextSize] = useState<WallPostTextSize>(post?.textSize ?? defaultWallPostTextSize);
  const [textEffect, setTextEffect] = useState<WallPostTextEffect>(post?.textEffect ?? defaultWallPostTextEffect);
  const [textColor, setTextColor] = useState<WallPostTextColor>(post?.textColor ?? defaultWallPostTextColor);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Live developing progress
  const [now, setNow] = useState(Date.now());
  const developing = post ? getCureProgress(post.createdAt, now) < 1 : false;

  useEffect(() => {
    if (!developing) return;
    const id = setInterval(() => setNow(Date.now()), 3000);
    return () => clearInterval(id);
  }, [developing]);

  const onFlip = useCallback((back: boolean) => setShowingBack(back), []);
  const textInputTypography = useMemo(
    () => (!post?.imageUri ? resolveWallPostTextStyle(fonts, textFont, textSize) : null),
    [fonts, post?.imageUri, textFont, textSize],
  );
  const selectedTextColor = useMemo(() => resolveWallPostTextColor(textColor, colors), [colors, textColor]);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;
  if (!post) return <Redirect href="/" />;

  const authenticatedUser = currentUser;
  const authorName = getUserById(post.authorUserId)?.displayName ?? 'Unknown';

  function handleBack() {
    router.back();
  }

  async function handleSave() {
    if (!body.trim() && !post!.imageUri) { setError('Add some text.'); return; }
    setSaving(true);
    try {
      await updateWallPost(
        post!.id,
        body.trim(),
        undefined,
        undefined,
        backText.trim() || null,
        post!.imageUri ? undefined : encodeWallPostTextStyle(textFont, textSize, textEffect, textColor),
        visibility,
      );
      router.back();
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong.');
    }
    setSaving(false);
  }

  function handleDelete() {
    Alert.alert('Delete Memory', 'Are you sure you want to delete this memory?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteWallPost(post!.id);
          router.back();
        },
      },
    ]);
  }

  const header = (
    <Pressable onPress={handleBack} style={styles.backButton}>
      <Text style={styles.backLabel}>‹ Back</Text>
    </Pressable>
  );

  return (
    <AppScreen header={header} floatingHeaderOnScroll footer={<ActionButton label={saving ? 'Saving…' : 'Save Changes'} onPress={handleSave} disabled={saving} />}>

      <Text style={styles.title}>Edit Memory</Text>

      <View style={styles.visibilityRow}>
        <Text style={styles.visibilityLabel}>Private</Text>
        <Switch
          value={visibility === 'private'}
          onValueChange={(val) => setVisibility(val ? 'private' : 'visible_to_subject')}
          trackColor={{ false: colors.line, true: colors.accent }}
          thumbColor={colors.white}
        />
      </View>

      {(body.trim() || backText.trim() || post.imageUri) && (
        <View style={styles.previewSection}>
          <WallPostCard
            authorName={authorName}
            cardColor={post.cardColor}
            onFlip={onFlip}
            post={{ ...post, body: body.trim(), backText: backText.trim() || null, textFont, textSize, textEffect, textColor }}
          />
          {developing && (
            <View style={styles.developingRow}>
              <ThemedGlyph name="polaroid" size={16} color={colors.inkSoft} />
              <Text style={styles.developingHint}>Still developing… your photo will appear shortly</Text>
            </View>
          )}
          <Text style={styles.previewHint}>Tap card to flip</Text>
        </View>
      )}

      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>{showingBack ? 'Back of Card' : 'Front Caption'}</Text>
        <TextInput
          multiline
          onChangeText={showingBack ? setBackText : setBody}
          placeholder={showingBack ? 'Write something on the back…' : 'What do you want to remember?'}
          placeholderTextColor={colors.inkMuted}
          style={[styles.textInput, !post.imageUri && !showingBack && textInputTypography, !post.imageUri && !showingBack && { color: selectedTextColor }]}
          value={showingBack ? backText : body}
        />
      </View>

      {!post.imageUri ? (
        <MemoryTextStylePicker
          selectedFont={textFont}
          selectedSize={textSize}
          selectedEffect={textEffect}
          selectedColor={textColor}
          onSelectFont={setTextFont}
          onSelectSize={setTextSize}
          onSelectEffect={setTextEffect}
          onSelectColor={setTextColor}
        />
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={handleDelete} style={styles.deleteButton}>
        <Text style={styles.deleteLabel}>Delete Memory</Text>
      </Pressable>
    </AppScreen>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    backButton: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
    backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
    title: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink },
    textInput: {
      minHeight: 100, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line,
      padding: spacing.md, fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink, textAlignVertical: 'top',
    },
    error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.error },
    inputSection: { gap: spacing.xs },
    inputLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    previewSection: { gap: spacing.sm, alignItems: 'center' as const },
    previewHint: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, textAlign: 'center' as const },
    developingRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: spacing.xs },
    developingHint: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft, textAlign: 'center' as const },
    visibilityRow: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },
    visibilityLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
    deleteButton: { alignSelf: 'center', paddingVertical: spacing.md },
    deleteLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.error },
  });
