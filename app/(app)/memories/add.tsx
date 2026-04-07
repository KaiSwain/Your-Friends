import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../../src/components/ActionButton';
import { AppScreen } from '../../../src/components/AppScreen';
import { WallPostCard } from '../../../src/components/WallPostCard';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../src/features/theme/themes';
import { useAddMemory } from '../../../src/hooks/useAddMemory';
import { fonts } from '../../../src/theme/typography';
import { accentPalette, radius, spacing } from '../../../src/theme/tokens';
import { WallPostVisibility } from '../../../src/types/domain';

export default function AddMemoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subjectId: string | string[]; subjectType: string | string[] }>();
  const { currentUser } = useAuth();
  const { getUserById, getContactById } = useSocialGraph();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const addMemory = useAddMemory();

  const [body, setBody] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<WallPostVisibility>('private');
  const [cardColor, setCardColor] = useState<string | null>(null);
  const [error, setError] = useState('');

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;
  const authenticatedUser = currentUser;

  const subjectId = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId;
  const subjectType = (Array.isArray(params.subjectType) ? params.subjectType[0] : params.subjectType) as 'user' | 'contact';
  const subjectName = subjectType === 'user'
    ? getUserById(subjectId ?? '')?.displayName
    : getContactById(subjectId ?? '')?.displayName;

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { setError('Camera permission is required to take photos.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  }

  async function handleSave() {
    if (!body.trim() && !imageUri) { setError('Add a photo or write something to remember.'); return; }
    if (!subjectId) { setError('Missing subject.'); return; }
    setError('');

    // When the subject is a contact linked to a real user, target the user directly
    // so the post shows up via RLS on their wall.
    let finalSubjectUserId: string | null = subjectType === 'user' ? subjectId : null;
    let finalSubjectContactId: string | null = subjectType === 'contact' ? subjectId : null;
    let finalVisibility = visibility;
    if (subjectType === 'contact' && subjectId) {
      const contact = getContactById(subjectId);
      if (contact?.linkedUserId) {
        finalSubjectUserId = contact.linkedUserId;
        finalSubjectContactId = null;
        // Default to visible so the friend can see it on their wall.
        if (finalVisibility === 'private') finalVisibility = 'visible_to_subject';
      }
    }

    addMemory.mutate(
      {
        authorUserId: authenticatedUser.id,
        imageUri,
        post: {
          subjectUserId: finalSubjectUserId,
          subjectContactId: finalSubjectContactId,
          visibility: finalVisibility,
          body: body.trim(),
          imageUri: null,
          cardColor: cardColor,
        },
      },
      {
        onSuccess: () => router.back(),
        onError: (err) => setError(err.message ?? 'Something went wrong.'),
      },
    );
  }

  return (
    <AppScreen footer={<ActionButton label={addMemory.isPending ? 'Saving…' : 'Save Memory'} onPress={handleSave} disabled={addMemory.isPending} />}>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backLabel}>← Back</Text>
      </Pressable>

      <Text style={styles.title}>New Memory</Text>
      <Text style={styles.subtitle}>About {subjectName ?? 'someone'}</Text>

      <TextInput
        multiline
        onChangeText={setBody}
        placeholder="What do you want to remember?"
        placeholderTextColor={colors.inkMuted}
        style={styles.textInput}
        value={body}
      />

      <View style={styles.photoRow}>
        {!imageUri && (
          <>
            <Pressable onPress={takePhoto} style={styles.photoOption}>
              <Text style={styles.photoOptionIcon}>📷</Text>
              <Text style={styles.photoOptionLabel}>Camera</Text>
            </Pressable>
            <Pressable onPress={pickImage} style={styles.photoOption}>
              <Text style={styles.photoOptionIcon}>🖼️</Text>
              <Text style={styles.photoOptionLabel}>Gallery</Text>
            </Pressable>
          </>
        )}
        {imageUri && (
          <Pressable onPress={() => setImageUri(null)} style={styles.changePhotoButton}>
            <Text style={styles.changePhotoLabel}>Remove Photo</Text>
          </Pressable>
        )}
        {imageUri && (
          <Pressable onPress={pickImage} style={styles.changePhotoButton}>
            <Text style={styles.changePhotoLabel}>Change Photo</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.visibilityRow}>
        <Pressable onPress={() => setVisibility('private')} style={[styles.visibilityOption, visibility === 'private' && styles.visibilityActive]}>
          <Text style={[styles.visibilityLabel, visibility === 'private' && styles.visibilityLabelActive]}>Private</Text>
        </Pressable>
        <Pressable onPress={() => setVisibility('visible_to_subject')} style={[styles.visibilityOption, visibility === 'visible_to_subject' && styles.visibilityActive]}>
          <Text style={[styles.visibilityLabel, visibility === 'visible_to_subject' && styles.visibilityLabelActive]}>Visible to them</Text>
        </Pressable>
      </View>

      <View style={styles.colorSection}>
        <Text style={styles.colorLabel}>Card Color</Text>
        <View style={styles.colorRow}>
          <Pressable onPress={() => setCardColor(null)} style={[styles.colorSwatch, { backgroundColor: colors.paper, borderColor: !cardColor ? colors.accent : colors.line }]}>
            {!cardColor && <Text style={styles.colorCheck}>✓</Text>}
          </Pressable>
          {accentPalette.map((c) => (
            <Pressable key={c} onPress={() => setCardColor(c)} style={[styles.colorSwatch, { backgroundColor: c, borderColor: cardColor === c ? colors.ink : 'transparent' }]}>
              {cardColor === c && <Text style={styles.colorCheck}>✓</Text>}
            </Pressable>
          ))}
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {(body.trim() || imageUri) && (
        <View style={styles.previewSection}>
          <Text style={styles.previewLabel}>Preview</Text>
          <WallPostCard
            authorName={authenticatedUser.displayName}
            cardColor={cardColor}
            post={{
              id: 'preview',
              authorUserId: authenticatedUser.id,
              subjectUserId: subjectType === 'user' ? (subjectId ?? null) : null,
              subjectContactId: subjectType === 'contact' ? (subjectId ?? null) : null,
              visibility,
              body: body.trim(),
              imageUri,
              createdAt: new Date().toISOString(),
            }}
          />
        </View>
      )}
    </AppScreen>
  );
}

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    backButton: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
    backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
    title: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink },
    subtitle: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft },
    photoRow: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap', justifyContent: 'center' },
    photoOption: {
      width: 100, height: 100, borderRadius: radius.md, backgroundColor: colors.paper,
      borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    },
    photoOptionIcon: { fontSize: 28 },
    photoOptionLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkSoft },
    changePhotoButton: {
      paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.pill,
      borderWidth: 1, borderColor: colors.line,
    },
    changePhotoLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft },
    textInput: {
      minHeight: 120, borderRadius: radius.md, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line,
      padding: spacing.md, fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink, textAlignVertical: 'top',
    },
    visibilityRow: { flexDirection: 'row', gap: spacing.sm },
    visibilityOption: {
      flex: 1, paddingVertical: spacing.sm, borderRadius: radius.pill,
      borderWidth: 1, borderColor: colors.line, alignItems: 'center',
    },
    visibilityActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    visibilityLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft },
    visibilityLabelActive: { color: colors.white },
    error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.error },
    colorSection: { gap: spacing.xs },
    colorLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
    colorRow: { flexDirection: 'row' as const, gap: spacing.sm, flexWrap: 'wrap' as const },
    colorSwatch: {
      width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: 'center' as const, justifyContent: 'center' as const,
    },
    colorCheck: { fontSize: 14, fontFamily: fonts.bodyBold, color: colors.ink },
    previewSection: { gap: spacing.sm },
    previewLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  });
