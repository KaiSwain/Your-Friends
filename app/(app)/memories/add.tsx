import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../../src/components/ActionButton';
import { AppScreen } from '../../../src/components/AppScreen';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../src/features/theme/themes';
import { useAddMemory } from '../../../src/hooks/useAddMemory';
import { fonts } from '../../../src/theme/typography';
import { radius, spacing } from '../../../src/theme/tokens';
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
  const [error, setError] = useState('');

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;
  const authenticatedUser = currentUser;

  const subjectId = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId;
  const subjectType = (Array.isArray(params.subjectType) ? params.subjectType[0] : params.subjectType) as 'user' | 'contact';
  const subjectName = subjectType === 'user'
    ? getUserById(subjectId ?? '')?.displayName
    : getContactById(subjectId ?? '')?.displayName;

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { setError('Camera permission is required to take photos.'); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  }

  async function handleSave() {
    if (!body.trim()) { setError('Write something to remember.'); return; }
    if (!subjectId) { setError('Missing subject.'); return; }
    setError('');
    addMemory.mutate(
      {
        authorUserId: authenticatedUser.id,
        imageUri,
        post: {
          subjectUserId: subjectType === 'user' ? subjectId : null,
          subjectContactId: subjectType === 'contact' ? subjectId : null,
          visibility,
          body: body.trim(),
          imageUri: null,
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

      <View style={styles.photoSection}>
        {imageUri ? (
          <Pressable onPress={() => setImageUri(null)}>
            <Image source={{ uri: imageUri }} style={styles.preview} />
            <Text style={styles.removeHint}>Tap to remove</Text>
          </Pressable>
        ) : (
          <View style={styles.photoButtons}>
            <Pressable onPress={takePhoto} style={styles.photoOption}>
              <Text style={styles.photoOptionIcon}>📷</Text>
              <Text style={styles.photoOptionLabel}>Camera</Text>
            </Pressable>
            <Pressable onPress={pickImage} style={styles.photoOption}>
              <Text style={styles.photoOptionIcon}>🖼️</Text>
              <Text style={styles.photoOptionLabel}>Gallery</Text>
            </Pressable>
          </View>
        )}
      </View>

      <TextInput
        multiline
        onChangeText={setBody}
        placeholder="What do you want to remember?"
        placeholderTextColor={colors.inkMuted}
        style={styles.textInput}
        value={body}
      />

      <View style={styles.visibilityRow}>
        <Pressable onPress={() => setVisibility('private')} style={[styles.visibilityOption, visibility === 'private' && styles.visibilityActive]}>
          <Text style={[styles.visibilityLabel, visibility === 'private' && styles.visibilityLabelActive]}>Private</Text>
        </Pressable>
        <Pressable onPress={() => setVisibility('visible_to_subject')} style={[styles.visibilityOption, visibility === 'visible_to_subject' && styles.visibilityActive]}>
          <Text style={[styles.visibilityLabel, visibility === 'visible_to_subject' && styles.visibilityLabelActive]}>Visible to them</Text>
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AppScreen>
  );
}

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    backButton: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
    backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
    title: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink },
    subtitle: { fontFamily: fonts.body, fontSize: 15, color: colors.inkSoft },
    photoSection: { alignItems: 'center' },
    photoButtons: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap', justifyContent: 'center' },
    photoOption: {
      width: 100, height: 100, borderRadius: radius.md, backgroundColor: colors.paper,
      borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    },
    photoOptionIcon: { fontSize: 28 },
    photoOptionLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkSoft },
    preview: { width: 200, height: 150, borderRadius: radius.md },
    removeHint: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkMuted, textAlign: 'center', marginTop: spacing.xs },
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
  });
