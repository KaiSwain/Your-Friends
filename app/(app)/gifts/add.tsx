import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton } from '../../../src/components/ActionButton';
import { AppScreen } from '../../../src/components/AppScreen';
import { DateDropdownPicker } from '../../../src/components/DateDropdownPicker';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { usePremium } from '../../../src/features/premium/PremiumContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import { backOnce, pushOnce, replaceOnce } from '../../../src/lib/navigationGuard';
import { showGiftNotePaywall } from '../../../src/lib/premiumGates';
import { protectTextFromFontClipping } from '../../../src/theme/fontProtection';
import { radius, spacing } from '../../../src/theme/tokens';
import type { PeopleListItem } from '../../../src/types/domain';

const TIME_PRESETS = [
  { label: 'Midnight', value: '00:00' },
  { label: '9 AM', value: '09:00' },
  { label: 'Noon', value: '12:00' },
  { label: '7 PM', value: '19:00' },
];

export default function AddGiftNoteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subjectId?: string | string[]; subjectType?: string | string[]; backTo?: string | string[] }>();
  const { currentUser } = useAuth();
  const { isPremium } = usePremium();
  const { createGiftNote, getPeopleListForUser, getUserById } = useSocialGraph();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const subjectId = Array.isArray(params.subjectId) ? params.subjectId[0] : params.subjectId;
  const subjectType = Array.isArray(params.subjectType) ? params.subjectType[0] : params.subjectType;
  const backTo = Array.isArray(params.backTo) ? params.backTo[0] : params.backTo;

  const giftTargets = useMemo(() => {
    if (!currentUser) return [];
    return getPeopleListForUser(currentUser.id).filter((person) => getRecipientUserId(person));
  }, [currentUser, getPeopleListForUser]);
  const initialTarget = giftTargets.find((target) => target.id === subjectId && target.entityType === subjectType) ?? giftTargets[0] ?? null;
  const [selectedTargetKey, setSelectedTargetKey] = useState(() => initialTarget ? targetKey(initialTarget) : '');
  const selectedTarget = giftTargets.find((target) => targetKey(target) === selectedTargetKey) ?? initialTarget;
  const selectedRecipientId = selectedTarget ? getRecipientUserId(selectedTarget) : null;
  const selectedRecipient = selectedRecipientId ? getUserById(selectedRecipientId) : null;
  const [body, setBody] = useState('');
  const [unlockDate, setUnlockDate] = useState(getTomorrowDateKey());
  const [unlockTime, setUnlockTime] = useState('09:00');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  function handleBack() {
    if (backTo) {
      replaceOnce(router, backTo as any);
      return;
    }
    backOnce(router);
  }

  async function handleSave() {
    if (!currentUser) return;
    if (!isPremium) {
      showGiftNotePaywall(() => pushOnce(router, '/(app)/store'));
      return;
    }
    if (!selectedTarget || !selectedRecipientId) {
      setError('Choose a friend with a real account.');
      return;
    }
    if (!body.trim()) {
      setError('Write the gift note before locking it.');
      return;
    }
    if (!isValidFutureUnlock(unlockDate, unlockTime)) {
      setError('Choose a future unlock time.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await createGiftNote(currentUser.id, {
        recipientUserId: selectedRecipientId,
        subjectContactId: selectedTarget.entityType === 'contact' ? selectedTarget.id : null,
        unlockDate,
        unlockTime,
        title: `A gift note for ${selectedTarget.title}`,
        body,
      });
      replaceOnce(router, backTo ? (backTo as any) : '/friends');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not lock this gift note.');
      setBusy(false);
    }
  }

  const header = (
    <Pressable onPress={handleBack} style={styles.backButton}>
      <Text style={styles.backLabel}><Ionicons name="chevron-back" size={16} /> Back</Text>
    </Pressable>
  );

  return (
    <AppScreen header={header} floatingHeaderOnScroll footer={<ActionButton label={!isPremium ? 'Unlock Premium to lock gift notes' : busy ? 'Locking…' : 'Lock gift note'} onPress={handleSave} disabled={busy || !selectedTarget} />}>
      <Text style={styles.title}>Private Gift Note</Text>
      <Text style={styles.subtitle}>They’ll see a locked surprise now. Your note becomes a memory on unlock day.</Text>
      {!isPremium ? (
        <View style={styles.premiumNotice}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.accent} />
          <Text style={styles.premiumNoticeText}>Gift notes are a Premium feature.</Text>
        </View>
      ) : null}

      {giftTargets.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Send to</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.targetScroll}>
            {giftTargets.map((target) => {
              const active = targetKey(target) === selectedTargetKey;
              return (
                <Pressable
                  key={targetKey(target)}
                  onPress={() => {
                    setSelectedTargetKey(targetKey(target));
                    const recipient = getRecipientUserId(target);
                    const birthday = recipient ? getUserById(recipient)?.birthday : null;
                    if (birthday && unlockDate === getTomorrowDateKey()) setUnlockDate(getNextBirthdayDateKey(birthday));
                  }}
                  style={[styles.targetChip, active && styles.targetChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <View style={[styles.targetAvatar, { backgroundColor: target.avatarColor }]}>
                    {target.imageUri ? <Image source={{ uri: target.imageUri }} style={styles.targetAvatarImage} /> : <Text style={styles.targetInitials}>{getInitials(target.title)}</Text>}
                  </View>
                  <Text style={[styles.targetChipText, active && styles.targetChipTextActive]} numberOfLines={1}>{target.title}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : (
        <Text style={styles.emptyText}>Add a friend with a real account before sending gift notes.</Text>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Unlock date</Text>
        <View style={styles.presetRow}>
          {[
            { label: 'Today', value: getTodayDateKey() },
            { label: 'Tomorrow', value: getTomorrowDateKey() },
            { label: 'Next week', value: getDaysFromNowDateKey(7) },
            ...(selectedRecipient?.birthday ? [{ label: 'Birthday', value: getNextBirthdayDateKey(selectedRecipient.birthday) }] : []),
          ].map((option) => {
            const active = unlockDate === option.value;
            return (
              <Pressable key={option.label} onPress={() => setUnlockDate(option.value)} style={[styles.presetChip, active && styles.presetChipActive]}>
                <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <DateDropdownPicker
          label="Unlocks"
          value={unlockDate}
          onChange={setUnlockDate}
          minDate={new Date()}
          maxYearOffset={5}
        />
        <View style={styles.timeSection}>
          <Text style={styles.timeLabel}>Time</Text>
          <View style={styles.presetRow}>
            {TIME_PRESETS.map((option) => {
              const active = unlockTime === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setUnlockTime(option.value)}
                  style={[styles.presetChip, active && styles.presetChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.timeStepperRow}>
            <Pressable onPress={() => setUnlockTime(stepTime(unlockTime, -30))} style={styles.timeStepButton} accessibilityRole="button" accessibilityLabel="Earlier by 30 minutes">
              <Ionicons name="remove" size={18} color={colors.ink} />
            </Pressable>
            <View style={styles.timeDisplay}>
              <Text style={styles.timeDisplayText}>{formatTimeDisplay(unlockTime)}</Text>
            </View>
            <Pressable onPress={() => setUnlockTime(stepTime(unlockTime, 30))} style={styles.timeStepButton} accessibilityRole="button" accessibilityLabel="Later by 30 minutes">
              <Ionicons name="add" size={18} color={colors.ink} />
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Gift note</Text>
        <TextInput
          multiline
          value={body}
          onChangeText={setBody}
          placeholder={`Write something ${selectedTarget?.title ?? 'your friend'} gets later...`}
          placeholderTextColor={colors.ink}
          style={styles.noteInput}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AppScreen>
  );
}

function getRecipientUserId(target: PeopleListItem) {
  return target.entityType === 'user' ? target.id : target.linkedUserId ?? null;
}

function targetKey(target: PeopleListItem) {
  return `${target.entityType}:${target.id}`;
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '?';
}

function getTodayDateKey() {
  return formatDateKey(new Date());
}

function getTomorrowDateKey() {
  return getDaysFromNowDateKey(1);
}

function getDaysFromNowDateKey(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return formatDateKey(date);
}

function getNextBirthdayDateKey(birthday: string) {
  const [, month, day] = birthday.split('-').map(Number);
  if (!month || !day) return getTomorrowDateKey();
  const today = new Date();
  const next = new Date(today.getFullYear(), month - 1, day, 12);
  if (next < startOfToday()) next.setFullYear(today.getFullYear() + 1);
  return formatDateKey(next);
}

function isValidFutureUnlock(dateValue: string, timeValue: string) {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue);
  if (!dateMatch || !timeMatch) return false;
  const date = new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  );
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() > Date.now();
}

function stepTime(value: string, deltaMinutes: number) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return '09:00';
  const total = (Number(match[1]) * 60 + Number(match[2]) + deltaMinutes + 24 * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function formatTimeDisplay(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return '9:00 AM';
  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  const suffix = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function startOfToday() {
  const today = new Date();
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const makeStyles = (colors: any, fonts: any) =>
  StyleSheet.create({
    backButton: { alignSelf: 'flex-start', minHeight: 38, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center' },
    backLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    title: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink, ...protectTextFromFontClipping(fonts.heading, 28) },
    subtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
    premiumNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.paper, padding: spacing.md },
    premiumNoticeText: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 13, color: colors.ink },
    section: { gap: spacing.sm },
    sectionLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink, textTransform: 'uppercase', letterSpacing: 0.5 },
    targetScroll: { gap: spacing.sm, paddingVertical: 2 },
    targetChip: {
      minWidth: 120,
      maxWidth: 158,
      minHeight: 44,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: 6,
      paddingLeft: 6,
      paddingRight: spacing.sm,
    },
    targetChipActive: { borderColor: colors.accent, backgroundColor: colors.paper },
    targetAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    targetAvatarImage: { width: '100%', height: '100%' },
    targetInitials: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.white },
    targetChipText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink },
    targetChipTextActive: { fontFamily: fonts.bodyBold, color: colors.ink },
    presetRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
    presetChip: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingVertical: 7 },
    presetChipActive: { borderColor: colors.accent, backgroundColor: colors.paper },
    presetChipText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.ink },
    presetChipTextActive: { fontFamily: fonts.bodyBold, color: colors.accent },
    timeSection: { gap: spacing.sm },
    timeLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.ink, textTransform: 'uppercase', letterSpacing: 0.5 },
    timeStepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    timeStepButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
    timeDisplay: { flex: 1, minHeight: 42, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
    timeDisplayText: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
    noteInput: { minHeight: 170, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, padding: spacing.md, fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink, textAlignVertical: 'top' },
    emptyText: { fontFamily: fonts.body, fontSize: 14, color: colors.ink },
    error: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.error },
  });
