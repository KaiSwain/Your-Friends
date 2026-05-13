import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { AppScreen } from '../../src/components/AppScreen';
import { useAuth } from '../../src/features/auth/AuthContext';
import { useCalendar } from '../../src/features/calendar/CalendarContext';
import type { CalendarMemoryActivity } from '../../src/features/calendar/memoryActivity';
import { getLocalDateKey, groupMemoryActivityByDay } from '../../src/features/calendar/memoryActivity';
import { usePremium } from '../../src/features/premium/PremiumContext';
import { useSocialGraph } from '../../src/features/social/SocialGraphContext';
import { useTheme } from '../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../src/features/theme/themes';
import { showCalendarPaywall } from '../../src/lib/premiumGates';
import type { FontSet } from '../../src/theme/typography';
import { radius, shadow, spacing } from '../../src/theme/tokens';
import type {
  CalendarEvent,
  CalendarEventInput,
  CalendarEventType,
  CalendarRecurrence,
  CalendarReminderOffset,
} from '../../src/types/domain';

type SubjectDraft = { kind: 'none' | 'user' | 'contact'; id: string | null; label: string };

type EventDraft = {
  type: CalendarEventType;
  title: string;
  eventDate: string;
  eventTime: string;
  allDay: boolean;
  recurrence: CalendarRecurrence;
  reminderOffsets: CalendarReminderOffset[];
  note: string;
  subject: SubjectDraft;
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const EVENT_TYPES: { value: CalendarEventType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'birthday', label: 'Birthday', icon: 'gift-outline' },
  { value: 'anniversary', label: 'Anniversary', icon: 'heart-outline' },
  { value: 'custom', label: 'Event', icon: 'sparkles-outline' },
];
const RECURRENCE_OPTIONS: { value: CalendarRecurrence; label: string }[] = [
  { value: 'none', label: 'Once' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'monthly', label: 'Monthly' },
];
const REMINDER_OPTIONS: { value: CalendarReminderOffset; label: string }[] = [
  { value: 0, label: 'On the day' },
  { value: 1, label: 'Day before' },
  { value: 7, label: 'Week before' },
];
const TIME_PRESETS: { label: string; value: string }[] = [
  { label: '8a', value: '08:00' },
  { label: '12p', value: '12:00' },
  { label: '5p', value: '17:00' },
  { label: '7p', value: '19:00' },
  { label: '9p', value: '21:00' },
];

type CategoryKey = 'birthday' | 'anniversary' | 'custom' | 'photo' | 'note';

function getCategoryColor(category: CategoryKey, colors: ColorTokens): string {
  switch (category) {
    case 'birthday':
      return colors.apricot;
    case 'anniversary':
      return colors.plum;
    case 'custom':
      return colors.gold;
    case 'photo':
      return colors.terracotta;
    case 'note':
      return colors.sky;
  }
}

function getCategoryIcon(category: CategoryKey): keyof typeof Ionicons.glyphMap {
  switch (category) {
    case 'birthday':
      return 'gift-outline';
    case 'anniversary':
      return 'heart-outline';
    case 'custom':
      return 'sparkles-outline';
    case 'photo':
      return 'image-outline';
    case 'note':
      return 'document-text-outline';
  }
}

export default function CalendarScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const { isPremium } = usePremium();
  const { events, addEvent, updateEvent, deleteEvent } = useCalendar();
  const { contacts, wallPosts, getContactById, getDirectFriends, getUserById } = useSocialGraph();

  const todayKey = getLocalDateKey(new Date());
  const [monthCursor, setMonthCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState(todayKey);
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [completingEventKey, setCompletingEventKey] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  const memoryByDay = useMemo(() => groupMemoryActivityByDay(wallPosts), [wallPosts]);
  const eventsByDay = useMemo(() => groupEventsByMonth(events, monthCursor), [events, monthCursor]);
  const cells = useMemo(() => buildCalendarCells(monthCursor), [monthCursor]);
  const selectedMemories = memoryByDay[selectedDateKey] ?? [];
  const selectedEvents = eventsByDay[selectedDateKey] ?? [];
  const monthTitle = monthCursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const onTodayView = isSameMonth(monthCursor, new Date()) && selectedDateKey === todayKey;

  const subjectOptions = useMemo<SubjectDraft[]>(() => {
    const options: SubjectDraft[] = [{ kind: 'none', id: null, label: 'No person' }];
    const ownedContacts = contacts
      .filter((contact) => contact.ownerUserId === currentUser.id)
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
    for (const contact of ownedContacts) {
      options.push({ kind: 'contact', id: contact.id, label: contact.displayName });
    }
    const linkedUserIds = new Set(
      ownedContacts.map((contact) => contact.linkedUserId).filter((id): id is string => !!id),
    );
    for (const friend of getDirectFriends(currentUser.id).sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    )) {
      if (linkedUserIds.has(friend.id)) continue;
      options.push({ kind: 'user', id: friend.id, label: friend.displayName });
    }
    return options;
  }, [contacts, currentUser.id, getDirectFriends]);

  function jumpToToday() {
    setMonthCursor(startOfMonth(new Date()));
    setSelectedDateKey(todayKey);
  }

  function changeMonth(delta: number) {
    const next = new Date(monthCursor);
    next.setMonth(next.getMonth() + delta);
    setMonthCursor(startOfMonth(next));
  }

  // Horizontal swipe between months. Vertical drags fall through to the parent ScrollView.
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4,
      onPanResponderRelease: (_e, g) => {
        if (g.dx <= -40) changeMonth(1);
        else if (g.dx >= 40) changeMonth(-1);
      },
    }),
  ).current;

  const topBar = (
    <View style={styles.topBar}>
      <Pressable
        onPress={() => router.back()}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="chevron-back" size={18} color={colors.inkSoft} />
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>
      {!onTodayView ? (
        <Pressable
          onPress={jumpToToday}
          style={styles.todayChip}
          accessibilityRole="button"
          accessibilityLabel="Jump to today"
        >
          <Ionicons name="locate-outline" size={14} color={colors.accent} />
          <Text style={styles.todayChipLabel}>Today</Text>
        </Pressable>
      ) : null}
    </View>
  );

  function openAddEvent() {
    if (!isPremium) {
      showCalendarPaywall(() => router.push('/(app)/store'));
      return;
    }
    setEditingEvent(null);
    setDraft(createDraft(selectedDateKey, subjectOptions[0]));
  }

  function openEditEvent(event: CalendarEvent) {
    if (!isPremium) {
      showCalendarPaywall(() => router.push('/(app)/store'));
      return;
    }
    setEditingEvent(event);
    setDraft(createDraftFromEvent(event, subjectOptions));
  }

  async function saveDraft() {
    if (!draft || saving) return;
    if (!isPremium) {
      showCalendarPaywall(() => router.push('/(app)/store'));
      return;
    }

    const validation = validateDraft(draft);
    if (validation) {
      Alert.alert('Check the event', validation);
      return;
    }

    setSaving(true);
    try {
      const input = draftToInput(draft);
      if (editingEvent) await updateEvent(editingEvent.id, input);
      else await addEvent(input);
      setDraft(null);
      setEditingEvent(null);
    } catch (error) {
      Alert.alert(
        'Could not save event',
        error instanceof Error ? error.message : 'Try again in a moment.',
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDeleteEvent(event: CalendarEvent) {
    if (!isPremium) {
      showCalendarPaywall(() => router.push('/(app)/store'));
      return;
    }
    Alert.alert('Delete event?', `${event.title} will be removed from your calendar.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEvent(event.id);
          } catch (error) {
            Alert.alert(
              'Could not delete event',
              error instanceof Error ? error.message : 'Try again in a moment.',
            );
          }
        },
      },
    ]);
  }

  async function toggleEventComplete(event: CalendarEvent) {
    if (!isPremium) {
      showCalendarPaywall(() => router.push('/(app)/store'));
      return;
    }

    const pendingKey = `${event.id}:${selectedDateKey}`;
    if (completingEventKey) return;

    setCompletingEventKey(pendingKey);
    try {
      await updateEvent(event.id, {
        completedOccurrenceKeys: getToggledOccurrenceKeys(event, selectedDateKey),
      });
    } catch (error) {
      Alert.alert(
        'Could not update event',
        error instanceof Error ? error.message : 'Try again in a moment.',
      );
    } finally {
      setCompletingEventKey(null);
    }
  }

  return (
    <>
      <AppScreen header={topBar} floatingHeaderOnScroll contentContainerStyle={styles.screenContent}>
        <View style={styles.heroBlock}>
          <Text style={styles.title}>Calendar</Text>
          <Text style={styles.subtitle}>
            {isPremium
              ? 'Birthdays, plans, and the days you saved.'
              : 'Your memory days fill in automatically. Premium adds birthdays, plans, and reminders.'}
          </Text>
        </View>

        <View style={styles.calendarShell} {...swipe.panHandlers}>
          <View style={styles.monthHeader}>
            <Pressable
              onPress={() => changeMonth(-1)}
              style={styles.monthButton}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
            >
              <Ionicons name="chevron-back" size={19} color={colors.inkSoft} />
            </Pressable>
            <Text style={styles.monthTitle}>{monthTitle}</Text>
            <Pressable
              onPress={() => changeMonth(1)}
              style={styles.monthButton}
              accessibilityRole="button"
              accessibilityLabel="Next month"
            >
              <Ionicons name="chevron-forward" size={19} color={colors.inkSoft} />
            </Pressable>
          </View>

          <View style={styles.legendRow}>
            {([
              { key: 'birthday', label: 'Birthday' },
              { key: 'anniversary', label: 'Anniversary' },
              { key: 'custom', label: 'Event' },
              { key: 'photo', label: 'Photo' },
              { key: 'note', label: 'Note' },
            ] as { key: CategoryKey; label: string }[]).map((item) => (
              <View key={item.key} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: getCategoryColor(item.key, colors) }]} />
                <Text style={styles.legendText}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((day, index) => (
              <Text key={`${day}-${index}`} style={styles.weekday}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((date, index) => {
              if (!date) return <View key={`blank-${index}`} style={styles.dayCell} />;
              const dateKey = getLocalDateKey(date);
              const selected = dateKey === selectedDateKey;
              const isToday = dateKey === todayKey;
              const dayMemories = memoryByDay[dateKey] ?? [];
              const dayEvents = eventsByDay[dateKey] ?? [];
              const dayCategories = collectDayCategories(dayEvents, dayMemories);
              const visibleCategories = dayCategories.slice(0, 4);
              const hiddenCount = dayCategories.length - visibleCategories.length;

              return (
                <Pressable
                  key={dateKey}
                  onPress={() => setSelectedDateKey(dateKey)}
                  style={[
                    styles.dayCell,
                    selected && styles.dayCellSelected,
                    isToday && !selected && styles.dayCellToday,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={date.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                >
                  <Text style={[styles.dayNumber, selected && styles.dayNumberSelected]}>
                    {date.getDate()}
                  </Text>
                  <View style={styles.dotRow}>
                    {visibleCategories.map((category) => (
                      <View
                        key={category}
                        style={[styles.dot, { backgroundColor: getCategoryColor(category, colors) }]}
                      />
                    ))}
                    {hiddenCount > 0 ? (
                      <Text style={[styles.moreDots, selected && styles.moreDotsSelected]}>
                        +{hiddenCount}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {!isPremium ? (
          <Pressable
            onPress={() => showCalendarPaywall(() => router.push('/(app)/store'))}
            style={styles.premiumBanner}
            accessibilityRole="button"
          >
            <Ionicons name="lock-closed" size={17} color={colors.accent} />
            <View style={styles.bannerBody}>
              <Text style={styles.bannerTitle}>Premium calendar tools</Text>
              <Text style={styles.bannerText}>Add birthdays, events, and local reminders.</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.accent} />
          </Pressable>
        ) : null}

        <View style={styles.dayPanel}>
          <View style={styles.dayPanelHeader}>
            <View style={styles.dayPanelText}>
              <Text style={styles.dayPanelEyebrow}>{formatRelativeDay(selectedDateKey, todayKey)}</Text>
              <Text style={styles.dayPanelTitle}>{formatReadableDate(selectedDateKey)}</Text>
            </View>
            {isPremium ? (
              <Pressable
                onPress={openAddEvent}
                style={styles.smallAddButton}
                accessibilityRole="button"
                accessibilityLabel="Add event"
              >
                <Ionicons name="add" size={20} color={colors.white} />
              </Pressable>
            ) : null}
          </View>

          {selectedEvents.length === 0 && selectedMemories.length === 0 ? (
            <Text style={styles.emptyText}>Nothing saved for this day yet.</Text>
          ) : null}

          {selectedEvents.length > 0 ? (
            <View style={styles.detailGroup}>
              <Text style={styles.detailGroupTitle}>Events</Text>
              {selectedEvents.map((event) => {
                const category = event.type as CategoryKey;
                const accent = getCategoryColor(category, colors);
                const completed = isEventOccurrenceComplete(event, selectedDateKey);
                const subjectLabel = getEventSubjectLabel(event, getContactById, getUserById);
                const pendingKey = `${event.id}:${selectedDateKey}`;
                const completing = completingEventKey === pendingKey;

                return (
                  <View
                    key={event.id}
                    style={[
                      styles.detailRow,
                      {
                        borderLeftWidth: 3,
                        borderLeftColor: accent,
                        paddingLeft: spacing.sm,
                      },
                      completed && styles.detailRowCompleted,
                    ]}
                  >
                    <View style={[styles.detailIcon, { backgroundColor: accent }]}>
                      <Ionicons name={getCategoryIcon(category)} size={16} color={colors.white} />
                    </View>
                    <View style={styles.detailTextBlock}>
                      <View style={styles.typeLine}>
                        <Text style={styles.typeChipText}>{capitalize(event.type)}</Text>
                        {completed ? (
                          <View style={styles.donePill}>
                            <Ionicons name="checkmark" size={10} color={colors.success} />
                            <Text style={styles.donePillText}>Done</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.detailTitle, completed && styles.detailTitleCompleted]}>
                        {event.title}
                      </Text>
                      {subjectLabel ? (
                        <Text style={styles.detailSubject}>
                          {formatEventSubject(event, subjectLabel)}
                        </Text>
                      ) : null}
                      <Text style={styles.detailSub}>{formatEventMeta(event, selectedDateKey)}</Text>
                      {event.note ? <Text style={styles.detailNote}>{event.note}</Text> : null}
                    </View>
                    {isPremium ? (
                      <View style={styles.eventActions}>
                        <Pressable
                          onPress={() => toggleEventComplete(event)}
                          style={[styles.completeAction, completed && styles.completeActionDone]}
                          accessibilityRole="button"
                          accessibilityLabel={completed ? `Mark ${event.title} incomplete` : `Mark ${event.title} complete`}
                          disabled={Boolean(completingEventKey)}
                        >
                          <Ionicons
                            name={completed ? 'checkmark-circle' : 'ellipse-outline'}
                            size={18}
                            color={completed ? colors.success : colors.inkSoft}
                          />
                          <Text style={[styles.completeActionText, completed && styles.completeActionTextDone]}>
                            {completing ? '...' : completed ? 'Undo' : 'Done'}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => openEditEvent(event)}
                          style={styles.iconAction}
                          accessibilityRole="button"
                          accessibilityLabel={`Edit ${event.title}`}
                        >
                          <Ionicons name="create-outline" size={16} color={colors.inkSoft} />
                        </Pressable>
                        <Pressable
                          onPress={() => confirmDeleteEvent(event)}
                          style={styles.iconAction}
                          accessibilityRole="button"
                          accessibilityLabel={`Delete ${event.title}`}
                        >
                          <Ionicons name="trash-outline" size={16} color={colors.error} />
                        </Pressable>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          {selectedMemories.length > 0 ? (
            <View style={styles.detailGroup}>
              <Text style={styles.detailGroupTitle}>Memories</Text>
              {selectedMemories.map((activity) => {
                const category: CategoryKey = activity.kind === 'photo' ? 'photo' : 'note';
                const accent = getCategoryColor(category, colors);
                return (
                  <View
                    key={activity.post.id}
                    style={[
                      styles.detailRow,
                      { borderLeftWidth: 3, borderLeftColor: accent, paddingLeft: spacing.sm },
                    ]}
                  >
                    <View style={[styles.detailIcon, { backgroundColor: accent }]}>
                      <Ionicons name={getCategoryIcon(category)} size={16} color={colors.white} />
                    </View>
                    <View style={styles.detailTextBlock}>
                      <Text style={styles.typeChipText}>
                        {activity.kind === 'photo' ? 'Photo' : 'Note'}
                      </Text>
                      <Text style={styles.detailTitle}>
                        {getMemoryTitle(activity, getContactById, getUserById)}
                      </Text>
                      {activity.post.body ? (
                        <Text style={styles.detailNote} numberOfLines={2}>
                          {activity.post.body}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      </AppScreen>

      <EventEditorModal
        draft={draft}
        editingEvent={editingEvent}
        subjectOptions={subjectOptions}
        saving={saving}
        colors={colors}
        fonts={fonts}
        onChangeDraft={setDraft}
        onClose={() => {
          if (!saving) {
            setDraft(null);
            setEditingEvent(null);
          }
        }}
        onSave={saveDraft}
        onOpenDatePicker={() => setDatePickerOpen(true)}
      />

      <DatePickerModal
        visible={datePickerOpen && !!draft}
        initialDateKey={draft?.eventDate ?? selectedDateKey}
        colors={colors}
        fonts={fonts}
        onClose={() => setDatePickerOpen(false)}
        onPick={(dateKey) => {
          if (draft) setDraft({ ...draft, eventDate: dateKey });
          setDatePickerOpen(false);
        }}
      />
    </>
  );
}

interface EventEditorModalProps {
  draft: EventDraft | null;
  editingEvent: CalendarEvent | null;
  subjectOptions: SubjectDraft[];
  saving: boolean;
  colors: ColorTokens;
  fonts: FontSet;
  onChangeDraft: (draft: EventDraft | null) => void;
  onClose: () => void;
  onSave: () => void;
  onOpenDatePicker: () => void;
}

function EventEditorModal({
  draft,
  editingEvent,
  subjectOptions,
  saving,
  colors,
  fonts,
  onChangeDraft,
  onClose,
  onSave,
  onOpenDatePicker,
}: EventEditorModalProps) {
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  if (!draft) return null;

  const setDraft = (updates: Partial<EventDraft>) => onChangeDraft({ ...draft, ...updates });

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalDateHeader}>
            <View style={styles.modalDateTextBlock}>
              <Text style={styles.modalDateMonth}>
                {formatDateMonth(draft.eventDate).toUpperCase()}
              </Text>
              <Text style={styles.modalDateDay}>{formatDateDay(draft.eventDate)}</Text>
              <Text style={styles.modalDateWeekday}>{formatDateWeekday(draft.eventDate)}</Text>
            </View>
            <Pressable
              onPress={onClose}
              style={styles.modalClose}
              accessibilityRole="button"
              accessibilityLabel="Close editor"
            >
              <Ionicons name="close" size={20} color={colors.inkSoft} />
            </Pressable>
          </View>

          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalEyebrow}>{editingEvent ? 'Edit' : 'New'}</Text>
              <Text style={styles.modalTitle}>
                {editingEvent ? 'Calendar event' : 'Add to calendar'}
              </Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.editorScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.segmentRow}>
              {EVENT_TYPES.map((option) => {
                const active = draft.type === option.value;
                const tint = getCategoryColor(option.value as CategoryKey, colors);
                return (
                  <Pressable
                    key={option.value}
                    onPress={() =>
                      setDraft({
                        type: option.value,
                        recurrence: option.value === 'custom' ? draft.recurrence : 'yearly',
                      })
                    }
                    style={[
                      styles.segmentChip,
                      active && { backgroundColor: tint, borderColor: tint },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Ionicons
                      name={option.icon}
                      size={15}
                      color={active ? colors.white : tint}
                    />
                    <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Person</Text>
              <View style={styles.chipWrap}>
                {subjectOptions.map((option) => {
                  const active =
                    draft.subject.kind === option.kind && draft.subject.id === option.id;
                  return (
                    <Pressable
                      key={`${option.kind}-${option.id ?? 'none'}`}
                      onPress={() =>
                        setDraft({
                          subject: option,
                          title: draft.title || defaultTitleFor(option, draft.type),
                        })
                      }
                      style={[styles.choiceChip, active && styles.choiceChipActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.choiceLabel, active && styles.choiceLabelActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <LabeledInput
              label="Title"
              value={draft.title}
              placeholder="Dinner with Sam"
              onChangeText={(title) => setDraft({ title })}
              styles={styles}
              colors={colors}
            />

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Date</Text>
              <Pressable
                onPress={onOpenDatePicker}
                style={styles.pickerPill}
                accessibilityRole="button"
                accessibilityLabel="Choose date"
              >
                <Ionicons name="calendar-outline" size={17} color={colors.inkSoft} />
                <Text style={styles.pickerPillText}>{formatReadableDate(draft.eventDate)}</Text>
                <Ionicons name="chevron-down" size={16} color={colors.inkMuted} />
              </Pressable>
            </View>

            <View style={styles.inlineToggleRow}>
              <Pressable
                onPress={() => setDraft({ allDay: !draft.allDay })}
                style={[styles.checkbox, draft.allDay && styles.checkboxActive]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: draft.allDay }}
              >
                {draft.allDay ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
              </Pressable>
              <Text style={styles.inlineToggleLabel}>All day</Text>
            </View>

            {!draft.allDay ? (
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>Time</Text>
                <View style={styles.timeRow}>
                  <Pressable
                    onPress={() => setDraft({ eventTime: stepTime(draft.eventTime, -30) })}
                    style={styles.stepperButton}
                    accessibilityRole="button"
                    accessibilityLabel="Earlier by 30 minutes"
                  >
                    <Ionicons name="remove" size={18} color={colors.inkSoft} />
                  </Pressable>
                  <View style={styles.timeDisplay}>
                    <Text style={styles.timeDisplayText}>
                      {formatTimeDisplay(draft.eventTime)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setDraft({ eventTime: stepTime(draft.eventTime, 30) })}
                    style={styles.stepperButton}
                    accessibilityRole="button"
                    accessibilityLabel="Later by 30 minutes"
                  >
                    <Ionicons name="add" size={18} color={colors.inkSoft} />
                  </Pressable>
                </View>
                <View style={styles.chipWrap}>
                  {TIME_PRESETS.map((preset) => {
                    const active = draft.eventTime === preset.value;
                    return (
                      <Pressable
                        key={preset.value}
                        onPress={() => setDraft({ eventTime: preset.value })}
                        style={[styles.choiceChip, active && styles.choiceChipActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.choiceLabel, active && styles.choiceLabelActive]}>
                          {preset.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Repeat</Text>
              <View style={styles.chipWrap}>
                {RECURRENCE_OPTIONS.map((option) => {
                  const active = draft.recurrence === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setDraft({ recurrence: option.value })}
                      style={[styles.choiceChip, active && styles.choiceChipActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.choiceLabel, active && styles.choiceLabelActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Reminders</Text>
              <View style={styles.chipWrap}>
                {REMINDER_OPTIONS.map((option) => {
                  const active = draft.reminderOffsets.includes(option.value);
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() =>
                        setDraft({
                          reminderOffsets: toggleReminder(draft.reminderOffsets, option.value),
                        })
                      }
                      style={[styles.choiceChip, active && styles.choiceChipActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.choiceLabel, active && styles.choiceLabelActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Note</Text>
              <TextInput
                value={draft.note}
                onChangeText={(note) => setDraft({ note })}
                placeholder="Optional"
                placeholderTextColor={colors.inkMuted}
                multiline
                style={[styles.input, styles.noteInput]}
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <ActionButton
              label={saving ? 'Saving...' : editingEvent ? 'Save changes' : 'Add event'}
              onPress={onSave}
              disabled={saving}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

interface DatePickerModalProps {
  visible: boolean;
  initialDateKey: string;
  colors: ColorTokens;
  fonts: FontSet;
  onClose: () => void;
  onPick: (dateKey: string) => void;
}

function DatePickerModal({ visible, initialDateKey, colors, fonts, onClose, onPick }: DatePickerModalProps) {
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const initial = parseDateParts(initialDateKey);
  const [cursor, setCursor] = useState<Date>(() =>
    initial ? new Date(initial.year, initial.month - 1, 1) : startOfMonth(new Date()),
  );
  const cells = useMemo(() => buildCalendarCells(cursor), [cursor]);
  const todayKey = getLocalDateKey(new Date());

  function changeMonth(delta: number) {
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + delta);
    setCursor(startOfMonth(next));
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.pickerBackdrop} onPress={onClose}>
        <Pressable style={styles.pickerSheet} onPress={() => undefined}>
          <View style={styles.monthHeader}>
            <Pressable
              onPress={() => changeMonth(-1)}
              style={styles.monthButton}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
            >
              <Ionicons name="chevron-back" size={19} color={colors.inkSoft} />
            </Pressable>
            <Text style={styles.monthTitle}>
              {cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <Pressable
              onPress={() => changeMonth(1)}
              style={styles.monthButton}
              accessibilityRole="button"
              accessibilityLabel="Next month"
            >
              <Ionicons name="chevron-forward" size={19} color={colors.inkSoft} />
            </Pressable>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((day, index) => (
              <Text key={`${day}-${index}`} style={styles.weekday}>
                {day}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((date, index) => {
              if (!date) return <View key={`pblank-${index}`} style={styles.dayCell} />;
              const dateKey = getLocalDateKey(date);
              const selected = dateKey === initialDateKey;
              const isToday = dateKey === todayKey;
              return (
                <Pressable
                  key={dateKey}
                  onPress={() => onPick(dateKey)}
                  style={[
                    styles.dayCell,
                    selected && styles.dayCellSelected,
                    isToday && !selected && styles.dayCellToday,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={date.toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                >
                  <Text style={[styles.dayNumber, selected && styles.dayNumberSelected]}>
                    {date.getDate()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function LabeledInput({
  label,
  value,
  placeholder,
  onChangeText,
  styles,
  colors,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  styles: ReturnType<typeof makeStyles>;
  colors: ColorTokens;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkMuted}
        style={styles.input}
      />
    </View>
  );
}

function createDraft(dateKey: string, subject?: SubjectDraft): EventDraft {
  const resolvedSubject = subject ?? { kind: 'none', id: null, label: 'No person' };
  return {
    type: 'birthday',
    title: defaultTitleFor(resolvedSubject, 'birthday'),
    eventDate: dateKey,
    eventTime: '19:00',
    allDay: true,
    recurrence: 'yearly',
    reminderOffsets: [1],
    note: '',
    subject: resolvedSubject,
  };
}

function createDraftFromEvent(event: CalendarEvent, subjectOptions: SubjectDraft[]): EventDraft {
  const subject =
    subjectOptions.find((option) =>
      event.subjectUserId
        ? option.kind === 'user' && option.id === event.subjectUserId
        : event.subjectContactId
          ? option.kind === 'contact' && option.id === event.subjectContactId
          : option.kind === 'none',
    ) ?? subjectOptions[0] ?? { kind: 'none', id: null, label: 'No person' };

  return {
    type: event.type,
    title: event.title,
    eventDate: event.eventDate,
    eventTime: event.eventTime ?? '19:00',
    allDay: event.allDay,
    recurrence: event.recurrence,
    reminderOffsets: event.reminderOffsets ?? [],
    note: event.note ?? '',
    subject,
  };
}

function draftToInput(draft: EventDraft): CalendarEventInput {
  return {
    subjectUserId: draft.subject.kind === 'user' ? draft.subject.id : null,
    subjectContactId: draft.subject.kind === 'contact' ? draft.subject.id : null,
    type: draft.type,
    title: draft.title.trim(),
    eventDate: draft.eventDate,
    eventTime: draft.allDay ? null : draft.eventTime,
    allDay: draft.allDay,
    recurrence: draft.recurrence,
    reminderOffsets: draft.reminderOffsets,
    note: draft.note.trim() || null,
  };
}

function validateDraft(draft: EventDraft) {
  if (!draft.title.trim()) return 'Add a title.';
  if (!isValidDateKey(draft.eventDate)) return 'Pick a valid date.';
  if (!draft.allDay && !isValidTime(draft.eventTime)) return 'Pick a valid time.';
  return null;
}

function toggleReminder(
  offsets: CalendarReminderOffset[],
  value: CalendarReminderOffset,
): CalendarReminderOffset[] {
  return offsets.includes(value)
    ? offsets.filter((offset) => offset !== value)
    : [...offsets, value].sort((a, b) => b - a);
}

function defaultTitleFor(subject: SubjectDraft, type: CalendarEventType) {
  if (subject.kind === 'none') {
    if (type === 'birthday') return 'Birthday';
    if (type === 'anniversary') return 'Anniversary';
    return '';
  }
  if (type === 'birthday') return `${subject.label}'s birthday`;
  if (type === 'anniversary') return `${subject.label} anniversary`;
  return `${subject.label} plan`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function collectDayCategories(
  events: readonly CalendarEvent[],
  memories: readonly CalendarMemoryActivity[],
): CategoryKey[] {
  const set = new Set<CategoryKey>();
  for (const event of events) {
    if (event.type === 'birthday' || event.type === 'anniversary' || event.type === 'custom') {
      set.add(event.type);
    }
  }
  for (const activity of memories) {
    set.add(activity.kind === 'photo' ? 'photo' : 'note');
  }
  // Stable display order.
  const order: CategoryKey[] = ['birthday', 'anniversary', 'custom', 'photo', 'note'];
  return order.filter((category) => set.has(category));
}

function capitalize(value: string) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getEventSubjectLabel(
  event: CalendarEvent,
  getContactById: (id: string) => { displayName: string } | undefined,
  getUserById: (id: string) => { displayName: string } | undefined,
) {
  if (event.subjectContactId) return getContactById(event.subjectContactId)?.displayName ?? 'Saved contact';
  if (event.subjectUserId) return getUserById(event.subjectUserId)?.displayName ?? 'Friend';
  return null;
}

function formatEventSubject(event: CalendarEvent, subjectLabel: string) {
  return `${event.type === 'custom' ? 'With' : 'For'} ${subjectLabel}`;
}

function isEventOccurrenceComplete(event: CalendarEvent, occurrenceKey: string) {
  return (event.completedOccurrenceKeys ?? []).includes(occurrenceKey);
}

function getToggledOccurrenceKeys(event: CalendarEvent, occurrenceKey: string) {
  if (isEventOccurrenceComplete(event, occurrenceKey)) {
    return (event.completedOccurrenceKeys ?? []).filter((key) => key !== occurrenceKey);
  }
  return [...(event.completedOccurrenceKeys ?? []), occurrenceKey].sort();
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function buildCalendarCells(month: Date): Array<Date | null> {
  const first = startOfMonth(month);
  const firstWeekday = first.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let index = 0; index < firstWeekday; index += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1)
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function groupEventsByMonth(
  events: readonly CalendarEvent[],
  month: Date,
): Record<string, CalendarEvent[]> {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const grouped: Record<string, CalendarEvent[]> = {};
  for (const event of events) {
    const key = getEventOccurrenceKey(event, year, monthIndex);
    if (!key) continue;
    grouped[key] = [...(grouped[key] ?? []), event];
  }
  for (const key of Object.keys(grouped)) {
    grouped[key].sort(
      (a, b) =>
        (a.eventTime ?? '').localeCompare(b.eventTime ?? '') || a.title.localeCompare(b.title),
    );
  }
  return grouped;
}

function getEventOccurrenceKey(event: CalendarEvent, year: number, monthIndex: number) {
  const parts = parseDateParts(event.eventDate);
  if (!parts) return '';
  const { year: eventYear, month, day } = parts;
  if (event.recurrence === 'none') {
    return eventYear === year && month === monthIndex + 1 ? event.eventDate : '';
  }
  if (event.recurrence === 'yearly' && month !== monthIndex + 1) return '';
  const maxDay = new Date(year, monthIndex + 1, 0).getDate();
  const occurrenceDay = Math.min(day, maxDay);
  if (event.recurrence === 'monthly' || event.recurrence === 'yearly') {
    return formatDateKey(year, monthIndex + 1, occurrenceDay);
  }
  return '';
}

function parseDateParts(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function isValidDateKey(dateKey: string) {
  const parts = parseDateParts(dateKey);
  if (!parts) return false;
  const date = new Date(parts.year, parts.month - 1, parts.day);
  return getLocalDateKey(date) === dateKey;
}

function isValidTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatReadableDate(dateKey: string) {
  const parts = parseDateParts(dateKey);
  if (!parts) return dateKey;
  return new Date(parts.year, parts.month - 1, parts.day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateMonth(dateKey: string) {
  const parts = parseDateParts(dateKey);
  if (!parts) return '';
  return new Date(parts.year, parts.month - 1, parts.day).toLocaleDateString('en-US', {
    month: 'short',
  });
}

function formatDateDay(dateKey: string) {
  const parts = parseDateParts(dateKey);
  if (!parts) return '';
  return String(parts.day);
}

function formatDateWeekday(dateKey: string) {
  const parts = parseDateParts(dateKey);
  if (!parts) return '';
  return new Date(parts.year, parts.month - 1, parts.day).toLocaleDateString('en-US', {
    weekday: 'long',
  });
}

function formatRelativeDay(dateKey: string, todayKey: string) {
  if (dateKey === todayKey) return 'Today';
  const a = parseDateParts(dateKey);
  const b = parseDateParts(todayKey);
  if (!a || !b) return 'Selected day';
  const target = new Date(a.year, a.month - 1, a.day).getTime();
  const today = new Date(b.year, b.month - 1, b.day).getTime();
  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff <= 7) return `In ${diff} days`;
  if (diff < -1 && diff >= -7) return `${Math.abs(diff)} days ago`;
  return 'Selected day';
}

function stepTime(value: string, deltaMinutes: number) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const hour = match ? Number(match[1]) : 9;
  const minute = match ? Number(match[2]) : 0;
  let total = hour * 60 + minute + deltaMinutes;
  total = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const nextHour = Math.floor(total / 60);
  const nextMinute = total % 60;
  return `${String(nextHour).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`;
}

function formatTimeDisplay(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const display = ((hour + 11) % 12) + 1;
  return `${display}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function formatEventMeta(event: CalendarEvent, selectedDateKey: string) {
  const bits: string[] = [];
  const reminderOffsets = event.reminderOffsets ?? [];
  bits.push(event.allDay ? 'All day' : event.eventTime ? formatTimeDisplay(event.eventTime) : 'Timed');
  if (event.recurrence === 'yearly') bits.push('Yearly');
  if (event.recurrence === 'monthly') bits.push('Monthly');
  if (reminderOffsets.length > 0)
    bits.push(`${reminderOffsets.length} reminder${reminderOffsets.length === 1 ? '' : 's'}`);
  if (event.eventDate !== selectedDateKey && event.recurrence !== 'none')
    bits.push(`Started ${event.eventDate}`);
  return bits.join(' · ');
}

function getMemoryTitle(
  activity: CalendarMemoryActivity,
  getContactById: (id: string) => { displayName: string } | undefined,
  getUserById: (id: string) => { displayName: string } | undefined,
) {
  const { post } = activity;
  if (post.subjectContactId) return getContactById(post.subjectContactId)?.displayName ?? 'Saved contact';
  if (post.subjectUserId) return getUserById(post.subjectUserId)?.displayName ?? 'Friend';
  return 'Memory';
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    screenContent: { paddingBottom: spacing.xxl * 2, gap: spacing.lg },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    backButton: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: spacing.xs },
    backLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.inkSoft },
    todayChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs + 2,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.accent + '4D',
      backgroundColor: colors.accent + '14',
    },
    todayChipLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      letterSpacing: 0.4,
      color: colors.accent,
    },

    heroBlock: { gap: 4 },
    title: { fontFamily: fonts.heading, fontSize: 30, lineHeight: 36, color: colors.ink },
    subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft },

    calendarShell: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      padding: spacing.md,
      gap: spacing.sm,
      ...shadow.card,
    },
    monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    monthButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paperMuted,
    },
    monthTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },

    legendRow: {
      flexDirection: 'row',
      gap: spacing.md,
      paddingHorizontal: spacing.xs,
      paddingTop: 2,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendText: { fontFamily: fonts.body, fontSize: 11, color: colors.inkMuted },

    weekdayRow: { flexDirection: 'row' },
    weekday: {
      width: `${100 / 7}%`,
      textAlign: 'center',
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: colors.inkMuted,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    dayCell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      borderRadius: 16,
    },
    dayCellSelected: { backgroundColor: colors.accent },
    dayCellToday: { borderWidth: 1, borderColor: colors.accent + '80' },
    dayNumber: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
    dayNumberSelected: { color: colors.white },
    dotRow: { flexDirection: 'row', minHeight: 5, gap: 3, alignItems: 'center' },
    dot: { width: 5, height: 5, borderRadius: 3 },
    moreDots: {
      fontFamily: fonts.bodyBold,
      fontSize: 9,
      color: colors.inkMuted,
      marginLeft: 1,
    },
    moreDotsSelected: { color: colors.white },
    memoryDot: { backgroundColor: colors.terracotta },
    eventDot: { backgroundColor: colors.gold },
    photoDot: { backgroundColor: colors.terracotta },
    noteDot: { backgroundColor: colors.sky },

    premiumBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: colors.accent + '4D',
      backgroundColor: colors.accent + '14',
      borderRadius: radius.md,
      padding: spacing.md,
    },
    bannerBody: { flex: 1, gap: 2 },
    bannerTitle: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.ink },
    bannerText: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },

    dayPanel: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      padding: spacing.lg,
      gap: spacing.md,
      ...shadow.card,
    },
    dayPanelHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
    dayPanelText: { flex: 1, gap: 4 },
    dayPanelEyebrow: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: colors.accent,
    },
    dayPanelTitle: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },
    smallAddButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    emptyText: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft },

    detailGroup: { gap: spacing.sm },
    detailGroupTitle: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: colors.inkSoft,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
    },
    detailRowCompleted: { backgroundColor: colors.paperMuted + '66' },
    detailIcon: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    eventIcon: { backgroundColor: colors.gold },
    photoIcon: { backgroundColor: colors.terracotta },
    noteIcon: { backgroundColor: colors.sky },
    detailTextBlock: { flex: 1, gap: 2 },
    typeLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
    typeChipText: {
      fontFamily: fonts.bodyBold,
      fontSize: 10,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.inkMuted,
    },
    donePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      borderRadius: radius.pill,
      backgroundColor: colors.success + '18',
      paddingHorizontal: spacing.xs,
      paddingVertical: 2,
    },
    donePillText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.success },
    detailTitle: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    detailTitleCompleted: { color: colors.inkMuted, textDecorationLine: 'line-through' },
    detailSubject: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft },
    detailSub: { fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted },
    detailNote: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
    eventActions: { flexDirection: 'row', gap: spacing.xs },
    completeAction: {
      minWidth: 68,
      height: 34,
      borderRadius: 17,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      backgroundColor: colors.paperMuted,
      paddingHorizontal: spacing.sm,
    },
    completeActionDone: { backgroundColor: colors.success + '14' },
    completeActionText: { fontFamily: fonts.bodyBold, fontSize: 11, color: colors.inkSoft },
    completeActionTextDone: { color: colors.success },
    iconAction: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paperMuted,
    },

    modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)' },
    modalSheet: {
      maxHeight: '90%',
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      backgroundColor: colors.canvas,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
      gap: spacing.md,
    },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    modalDateHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.accent + '14',
      borderWidth: 1,
      borderColor: colors.accent + '33',
    },
    modalDateTextBlock: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, flex: 1 },
    modalDateMonth: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      letterSpacing: 1.2,
      color: colors.accent,
    },
    modalDateDay: {
      fontFamily: fonts.heading,
      fontSize: 32,
      lineHeight: 36,
      color: colors.ink,
    },
    modalDateWeekday: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.inkSoft,
      flexShrink: 1,
    },
    modalEyebrow: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: colors.accent,
    },
    modalTitle: { fontFamily: fonts.heading, fontSize: 25, color: colors.ink },
    modalClose: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paperMuted,
    },
    editorScroll: { gap: spacing.md, paddingBottom: spacing.md },
    segmentRow: { flexDirection: 'row', gap: spacing.xs },
    segmentChip: {
      flex: 1,
      minHeight: 42,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 5,
      paddingHorizontal: spacing.xs,
    },
    segmentChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    segmentLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkSoft },
    segmentLabelActive: { color: colors.white },

    fieldBlock: { gap: spacing.xs },
    fieldLabel: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.inkSoft },
    input: {
      fontFamily: fonts.body,
      fontSize: 16,
      color: colors.ink,
      backgroundColor: colors.paperMuted,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 3,
    },
    noteInput: { minHeight: 78, textAlignVertical: 'top' },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    choiceChip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
    },
    choiceChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    choiceLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: colors.inkSoft },
    choiceLabelActive: { color: colors.white },

    pickerPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.paperMuted,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 3,
    },
    pickerPillText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.ink },

    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    stepperButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paperMuted,
      borderWidth: 1,
      borderColor: colors.line,
    },
    timeDisplay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.sm + 2,
      borderRadius: radius.md,
      backgroundColor: colors.paperMuted,
      borderWidth: 1,
      borderColor: colors.line,
    },
    timeDisplayText: { fontFamily: fonts.heading, fontSize: 22, color: colors.ink },

    inlineToggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.paper,
    },
    checkboxActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    inlineToggleLabel: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.ink },
    modalFooter: { paddingTop: spacing.sm },

    pickerBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    pickerSheet: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: colors.paper,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.line,
      padding: spacing.md,
      gap: spacing.sm,
      ...shadow.card,
    },
  });
