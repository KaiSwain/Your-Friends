import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../src/components/ActionButton';
import { OnboardingFrame } from '../../src/features/onboarding/OnboardingFrame';
import { useOnboarding, type ExcitedFeature } from '../../src/features/onboarding/OnboardingContext';
import { useTheme } from '../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../src/features/theme/themes';
import { pushOnce } from '../../src/lib/navigationGuard';
import type { FontSet } from '../../src/theme/typography';
import { radius, spacing } from '../../src/theme/tokens';

interface FeatureOption {
  value: ExcitedFeature;
  label: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
}

type CoreExcitedFeature = Exclude<ExcitedFeature, 'all_of_the_above' | 'not_sure'>;

const OPTIONS: FeatureOption[] = [
  {
    value: 'polaroids',
    label: 'Memory cards',
    body: 'Take photos that develop over time, then shake gently to speed them up.',
    icon: 'camera-outline',
  },
  {
    value: 'live_polaroids',
    label: 'Live video memory cards',
    body: 'Hold the camera to capture a short video moment with a still memory-card cover.',
    icon: 'videocam-outline',
  },
  {
    value: 'memory_walls',
    label: 'Shared memory walls',
    body: 'Build a private timeline of moments with the people you care about.',
    icon: 'images-outline',
  },
  {
    value: 'friend_profiles',
    label: 'Friend profiles',
    body: 'Keep facts, tags, notes, photos, and little details about each friend.',
    icon: 'person-circle-outline',
  },
  {
    value: 'add_friends',
    label: 'Just want to add my friends',
    body: 'Start with your people first, then fill in memories and details over time.',
    icon: 'people-outline',
  },
  {
    value: 'private_notes',
    label: 'Private note keeping',
    body: 'Save private notes, links, and gift ideas on someone’s profile.',
    icon: 'document-text-outline',
  },
  {
    value: 'calendar',
    label: 'Calendar reminders',
    body: 'Remember birthdays, plans, anniversaries, and friend-specific events.',
    icon: 'calendar-outline',
  },
  {
    value: 'music_memories',
    label: 'Music memories',
    body: 'Attach songs so the moment has a soundtrack.',
    icon: 'musical-notes-outline',
  },
  {
    value: 'ai_captions',
    label: 'AI captions',
    body: 'Get caption ideas when you know the feeling but not the words.',
    icon: 'sparkles-outline',
  },
  {
    value: 'all_of_the_above',
    label: 'All of the above',
    body: 'I want the full friendship scrapbook: friends, Live Memory Cards, notes, music, walls, and reminders.',
    icon: 'star-outline',
  },
  {
    value: 'not_sure',
    label: 'Not sure yet',
    body: 'I want to explore and see what sticks.',
    icon: 'sparkles-outline',
  },
];

const CORE_FEATURES: CoreExcitedFeature[] = [
  'polaroids',
  'live_polaroids',
  'memory_walls',
  'friend_profiles',
  'add_friends',
  'private_notes',
  'calendar',
  'music_memories',
  'ai_captions',
];

const ALL_FEATURES: ExcitedFeature[] = [...CORE_FEATURES, 'all_of_the_above'];

export default function OnboardingFeaturesScreen() {
  const router = useRouter();
  const { excitedFeatures, setExcitedFeatures } = useOnboarding();
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);

  const [selected, setSelected] = useState<ExcitedFeature[]>(excitedFeatures);
  const [busy, setBusy] = useState(false);

  function toggleFeature(value: ExcitedFeature) {
    if (value === 'not_sure') {
      setSelected((current) => (current.includes('not_sure') ? [] : ['not_sure']));
      return;
    }
    if (value === 'all_of_the_above') {
      setSelected((current) => (current.includes('all_of_the_above') ? [] : ALL_FEATURES));
      return;
    }
    setSelected((current) => {
      const coreValue = value as CoreExcitedFeature;
      const withoutSpecialOptions = current.filter((feature) => feature !== 'not_sure' && feature !== 'all_of_the_above');
      const next = withoutSpecialOptions.includes(coreValue)
        ? withoutSpecialOptions.filter((feature) => feature !== coreValue)
        : [...withoutSpecialOptions, coreValue];
      return CORE_FEATURES.every((feature) => next.includes(feature))
        ? [...next, 'all_of_the_above']
        : next;
    });
  }

  async function handleNext() {
    if (selected.length === 0 || busy) return;
    setBusy(true);
    await setExcitedFeatures(selected);
    pushOnce(router, '/(onboarding)/paywall');
    setBusy(false);
  }

  return (
    <OnboardingFrame
      step={10}
      totalSteps={12}
      eyebrow="Make it yours"
      title="What are you most excited to use?"
      subtitle="Choose all that sound fun. We'll use this to understand what people love most about YourFriends."
      footer={
        <ActionButton
          label={busy ? 'Saving…' : 'Continue'}
          onPress={handleNext}
          disabled={busy || selected.length === 0}
        />
      }
    >
      <ScrollView
        style={styles.optionScroller}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.optionList}
      >
        {OPTIONS.map((option) => {
          const isActive = selected.includes(option.value);
          return (
            <Pressable
              key={option.value}
              onPress={() => toggleFeature(option.value)}
              style={({ pressed }) => [
                styles.option,
                isActive && styles.optionActive,
                pressed && styles.optionPressed,
              ]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isActive }}
              accessibilityLabel={option.label}
            >
              <View style={[styles.iconBubble, isActive && styles.iconBubbleActive]}>
                <Ionicons name={option.icon} size={20} color={isActive ? colors.accent : colors.inkSoft} />
              </View>
              <View style={styles.optionBody}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                <Text style={styles.optionText}>{option.body}</Text>
              </View>
              {isActive ? (
                <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
              ) : (
                <View style={styles.checkPlaceholder} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </OnboardingFrame>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    optionScroller: { flex: 1 },
    optionList: { gap: spacing.sm, paddingBottom: spacing.xl },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    optionActive: {
      borderColor: colors.accent,
      backgroundColor: colors.accent + '14',
    },
    optionPressed: { transform: [{ scale: 0.99 }] },
    iconBubble: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.paper,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconBubbleActive: {
      backgroundColor: colors.accent + '18',
    },
    optionBody: { flex: 1, gap: 2 },
    optionLabel: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    optionText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.inkSoft },
    checkPlaceholder: { width: 22, height: 22 },
  });
