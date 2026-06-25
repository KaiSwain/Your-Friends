import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../../src/components/ActionButton';
import { AppScreen } from '../../../src/components/AppScreen';
import { SectionCard } from '../../../src/components/SectionCard';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import { memoryImagePickerOptions } from '../../../src/lib/imagePickerPresets';
import { supabase } from '../../../src/lib/supabase';
import { backOnce } from '../../../src/lib/navigationGuard';
import { protectTextFromFontClipping } from '../../../src/theme/fontProtection';
import { radius, spacing } from '../../../src/theme/tokens';

export default function OfficialBroadcastScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { createOfficialBroadcast } = useSocialGraph();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [body, setBody] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resultText, setResultText] = useState('');
  const [updateMessage, setUpdateMessage] = useState('');
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateResult, setUpdateResult] = useState('');

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  const isAdmin = Boolean(currentUser.isOfficial && currentUser.isTeamAdmin);
  const header = (
    <Pressable onPress={() => backOnce(router)} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Go back">
      <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
    </Pressable>
  );

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync(memoryImagePickerOptions);
    if (result.canceled || !result.assets[0]) return;
    setImageUri(result.assets[0].uri);
  }

  function confirmBroadcast() {
    if (busy) return;
    if (!body.trim() && !imageUri) {
      Alert.alert('Add something first', 'Write a message or choose a photo before broadcasting.');
      return;
    }
    Alert.alert(
      'Send to every user?',
      'This creates a Your Friends memory on every user wall. Only send product updates or team posts you want everyone to receive.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send broadcast', style: 'destructive', onPress: () => void handleBroadcast() },
      ],
    );
  }

  async function handleBroadcast() {
    setBusy(true);
    setResultText('');
    try {
      const result = await createOfficialBroadcast({
        body,
        imageUri,
        memoryDate: new Date().toISOString().slice(0, 10),
      });
      setBody('');
      setImageUri(null);
      setResultText(`Sent ${result.postCount} posts and ${result.notificationCount} notifications.`);
      Alert.alert('Broadcast sent', `Posted to ${result.recipientCount} users.`);
    } catch (error) {
      Alert.alert('Could not send broadcast', error instanceof Error ? error.message : 'Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  function confirmUpdatePush() {
    if (updateBusy) return;
    Alert.alert(
      'Notify everyone about an update?',
      'This sends a push notification to every user with notifications enabled, telling them a new version is available. Send this only after the new version is live on the App Store.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send notification', onPress: () => void handleUpdatePush() },
      ],
    );
  }

  async function handleUpdatePush() {
    setUpdateBusy(true);
    setUpdateResult('');
    try {
      const { data, error } = await supabase.functions.invoke('broadcast-app-update', {
        body: updateMessage.trim() ? { body: updateMessage.trim() } : {},
      });
      if (error) throw new Error(error.message);
      const recipientCount = typeof data?.recipientCount === 'number' ? data.recipientCount : 0;
      const sentCount = typeof data?.sentCount === 'number' ? data.sentCount : 0;
      setUpdateMessage('');
      setUpdateResult(`Sent update notification to ${sentCount} of ${recipientCount} devices.`);
      Alert.alert('Update notification sent', `Pushed to ${sentCount} of ${recipientCount} devices.`);
    } catch (error) {
      Alert.alert('Could not send update notification', error instanceof Error ? error.message : 'Try again in a moment.');
    } finally {
      setUpdateBusy(false);
    }
  }

  return (
    <AppScreen header={header} floatingHeaderOnScroll footer={isAdmin ? <ActionButton label={busy ? 'Sending...' : 'Send to every user'} onPress={confirmBroadcast} disabled={busy || (!body.trim() && !imageUri)} /> : undefined}>
      <Text style={styles.title}>Official Broadcast</Text>
      <Text style={styles.subtitle}>Post from the Your Friends account directly to every user wall.</Text>

      {!isAdmin ? (
        <SectionCard eyebrow="Admin only" title="Broadcasts are locked">
          <Text style={styles.bodyText}>Only the official Your Friends admin account can send team broadcasts.</Text>
        </SectionCard>
      ) : (
        <>
          <SectionCard eyebrow="Message" title="What should everyone receive?">
            <TextInput
              multiline
              value={body}
              onChangeText={setBody}
              placeholder="Write the team update..."
              placeholderTextColor={colors.ink}
              style={styles.input}
            />
            <Text style={styles.helpText}>This becomes the text on each user's memory card.</Text>
          </SectionCard>

          <SectionCard eyebrow="Optional photo" title="Add a photo memory">
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
            ) : (
              <View style={styles.emptyImage}>
                <Ionicons name="image-outline" size={28} color={colors.ink} />
                <Text style={styles.helpText}>No photo selected</Text>
              </View>
            )}
            <View style={styles.photoActions}>
              <Pressable onPress={pickPhoto} disabled={busy} style={[styles.secondaryButton, busy && styles.disabled]} accessibilityRole="button">
                <Text style={styles.secondaryButtonText}>{imageUri ? 'Change photo' : 'Choose photo'}</Text>
              </Pressable>
              {imageUri ? (
                <Pressable onPress={() => setImageUri(null)} disabled={busy} style={[styles.secondaryButton, busy && styles.disabled]} accessibilityRole="button">
                  <Text style={styles.secondaryButtonText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
          </SectionCard>

          {resultText ? <Text style={styles.successText}>{resultText}</Text> : null}

          <SectionCard eyebrow="App update" title="Notify everyone to update">
            <Text style={styles.helpText}>Sends a push notification to every user with notifications on, letting them know a new version is available. Send this once the new build is live on the App Store.</Text>
            <TextInput
              multiline
              value={updateMessage}
              onChangeText={setUpdateMessage}
              placeholder="Optional custom message (leave blank for the default update text)"
              placeholderTextColor={colors.ink}
              style={styles.updateInput}
            />
            <Pressable onPress={confirmUpdatePush} disabled={updateBusy} style={[styles.secondaryButton, updateBusy && styles.disabled]} accessibilityRole="button">
              <Text style={styles.secondaryButtonText}>{updateBusy ? 'Sending...' : 'Send update notification'}</Text>
            </Pressable>
            {updateResult ? <Text style={styles.successText}>{updateResult}</Text> : null}
          </SectionCard>
        </>
      )}
    </AppScreen>
  );
}

const makeStyles = (colors: ReturnType<typeof useTheme>['colors'], fonts: ReturnType<typeof useTheme>['fonts']) => StyleSheet.create({
  backButton: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center' },
  backLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
  title: { fontFamily: fonts.heading, fontSize: 32, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 32) },
  subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft },
  bodyText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft },
  input: { minHeight: 150, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.md, textAlignVertical: 'top', fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  updateInput: { minHeight: 80, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.md, textAlignVertical: 'top', fontFamily: fonts.body, fontSize: 15, color: colors.ink },
  helpText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  previewImage: { width: '100%', aspectRatio: 1, borderRadius: radius.lg, backgroundColor: colors.paperMuted },
  emptyImage: { minHeight: 150, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paperMuted, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  photoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  secondaryButton: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  secondaryButtonText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.inkSoft },
  disabled: { opacity: 0.5 },
  successText: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.success },
});
