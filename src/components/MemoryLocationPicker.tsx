import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '../features/theme/ThemeContext';
import type { ColorTokens } from '../features/theme/themes';
import {
  getNearbyLocationSuggestions,
  searchLocationSuggestions,
  type LocationSearchContext,
  type MemoryLocationSuggestion,
  type MemoryLocationSuggestionKind,
} from '../lib/memoryLocationSearch';
import type { FontSet } from '../theme/typography';
import { radius, spacing } from '../theme/tokens';

interface MemoryLocationPickerProps {
  value: string;
  onChange: (value: string) => void;
}

const KIND_LABELS: Record<MemoryLocationSuggestionKind, string> = {
  state: 'State',
  city: 'City',
  place: 'Place',
};

const KIND_ICONS: Record<MemoryLocationSuggestionKind, keyof typeof Ionicons.glyphMap> = {
  state: 'map-outline',
  city: 'business-outline',
  place: 'location-sharp',
};

export function MemoryLocationPicker({ value, onChange }: MemoryLocationPickerProps) {
  const { colors, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [searchText, setSearchText] = useState('');
  const [nearbyLoading, setNearbyLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [nearbySuggestions, setNearbySuggestions] = useState<MemoryLocationSuggestion[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<MemoryLocationSuggestion[]>([]);
  const [nearbyDenied, setNearbyDenied] = useState(false);
  const searchContextRef = useRef<LocationSearchContext | null>(null);
  const nearbyRequestIdRef = useRef(0);
  const searchRequestIdRef = useRef(0);

  const query = searchText.trim();
  const isSearching = query.length >= 2;

  const statusMessage = useMemo(() => {
    if (value.trim()) return 'This will appear on the back of the card. Flip the preview to see it.';
    if (isSearching) {
      if (searchLoading) return 'Searching places…';
      if (searchSuggestions.length > 0) return 'Tap a result — it goes on the back of the card.';
      return 'No matches yet. Keep typing or pick a nearby suggestion.';
    }
    if (nearbyLoading) return 'Loading nearby states, cities, and places…';
    if (nearbyDenied) return 'Turn on location to see nearby suggestions.';
    if (nearbySuggestions.length > 0) return 'Tap a place — it will show on the back of the card.';
    return 'Optional. Tagged places appear on the back when you flip the card.';
  }, [isSearching, nearbyDenied, nearbyLoading, nearbySuggestions.length, searchLoading, searchSuggestions.length, value]);

  const loadNearbySuggestions = useCallback(async () => {
    const requestId = ++nearbyRequestIdRef.current;
    setNearbyLoading(true);
    try {
      const result = await getNearbyLocationSuggestions();
      if (requestId !== nearbyRequestIdRef.current) return;
      setNearbySuggestions(result.suggestions);
      setNearbyDenied(result.status === 'denied');
      searchContextRef.current = result.context;
    } catch {
      if (requestId !== nearbyRequestIdRef.current) return;
      setNearbySuggestions([]);
      setNearbyDenied(false);
      searchContextRef.current = null;
    } finally {
      if (requestId === nearbyRequestIdRef.current) {
        setNearbyLoading(false);
      }
    }
  }, []);

  const loadSearchSuggestions = useCallback(async (searchQuery: string) => {
    const requestId = ++searchRequestIdRef.current;
    setSearchLoading(true);
    try {
      const next = await searchLocationSuggestions(searchQuery, searchContextRef.current);
      if (requestId !== searchRequestIdRef.current) return;
      setSearchSuggestions(next);
    } catch {
      if (requestId !== searchRequestIdRef.current) return;
      setSearchSuggestions([]);
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setSearchLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadNearbySuggestions();
  }, [loadNearbySuggestions]);

  useEffect(() => {
    if (!isSearching) {
      setSearchSuggestions([]);
      setSearchLoading(false);
      return;
    }
    const timeout = setTimeout(() => {
      void loadSearchSuggestions(query);
    }, 280);
    return () => clearTimeout(timeout);
  }, [isSearching, loadSearchSuggestions, query]);

  function handleSelect(suggestion: MemoryLocationSuggestion) {
    onChange(suggestion.label);
    setSearchText('');
    setSearchSuggestions([]);
    Keyboard.dismiss();
  }

  function handleClearSelection() {
    onChange('');
    setSearchText('');
    setSearchSuggestions([]);
  }

  function handleUseCustom() {
    const custom = searchText.trim();
    if (!custom) return;
    onChange(custom);
    setSearchText('');
    setSearchSuggestions([]);
    Keyboard.dismiss();
  }

  const showNearbyPanel = !isSearching;
  const showSearchPanel = isSearching && (searchLoading || searchSuggestions.length > 0);
  // Offer a custom entry whenever the typed text isn't already an exact suggestion,
  // so a place that never shows up can still be tagged.
  const trimmedQuery = searchText.trim();
  const hasExactMatch = searchSuggestions.some(
    (suggestion) => suggestion.label.trim().toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const showCustomEntry = trimmedQuery.length >= 1
    && trimmedQuery.toLowerCase() !== value.trim().toLowerCase()
    && !hasExactMatch;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text style={styles.label}>Location</Text>
          <Text style={styles.hint}>{statusMessage}</Text>
        </View>
        {(nearbyLoading || searchLoading) && !value.trim() ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : null}
      </View>

      {value.trim() ? (
        <View style={styles.selectedChip}>
          <Ionicons name="location-sharp" size={14} color={colors.accent} />
          <Text style={styles.selectedChipText} numberOfLines={2}>{value}</Text>
          <Pressable onPress={handleClearSelection} accessibilityRole="button" accessibilityLabel="Clear location">
            <Ionicons name="close-circle" size={18} color={colors.ink} />
          </Pressable>
        </View>
      ) : null}

      {showSearchPanel ? (
        <SuggestionRow
          title="Search results"
          loading={searchLoading}
          loadingLabel="Searching…"
          suggestions={searchSuggestions}
          selectedLabel={value}
          onSelect={handleSelect}
          styles={styles}
          kindLabels={KIND_LABELS}
          kindIcons={KIND_ICONS}
          accentColor={colors.accent}
          inactiveIconColor={colors.ink}
        />
      ) : null}

      {showNearbyPanel ? (
        <SuggestionRow
          title="Near you"
          loading={nearbyLoading}
          loadingLabel="Finding nearby…"
          suggestions={nearbySuggestions}
          selectedLabel={value}
          onSelect={handleSelect}
          styles={styles}
          kindLabels={KIND_LABELS}
          kindIcons={KIND_ICONS}
          accentColor={colors.accent}
          inactiveIconColor={colors.ink}
        />
      ) : null}

      {showCustomEntry ? (
        <Pressable
          onPress={handleUseCustom}
          style={styles.customRow}
          accessibilityRole="button"
          accessibilityLabel={`Use ${trimmedQuery} as the location`}
        >
          <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
          <Text style={styles.customRowText} numberOfLines={2}>Use “{trimmedQuery}”</Text>
        </Pressable>
      ) : null}

      <TextInput
        value={searchText}
        onChangeText={setSearchText}
        placeholder="Search or type your own place"
        placeholderTextColor={colors.inkMuted}
        autoCapitalize="words"
        autoCorrect={false}
        maxLength={80}
        returnKeyType="done"
        onSubmitEditing={handleUseCustom}
        style={styles.input}
      />
    </View>
  );
}

function SuggestionRow({
  title,
  loading,
  loadingLabel,
  suggestions,
  selectedLabel,
  onSelect,
  styles,
  kindLabels,
  kindIcons,
  accentColor,
  inactiveIconColor,
}: {
  title: string;
  loading: boolean;
  loadingLabel: string;
  suggestions: MemoryLocationSuggestion[];
  selectedLabel: string;
  onSelect: (suggestion: MemoryLocationSuggestion) => void;
  styles: ReturnType<typeof makeStyles>;
  kindLabels: Record<MemoryLocationSuggestionKind, string>;
  kindIcons: Record<MemoryLocationSuggestionKind, keyof typeof Ionicons.glyphMap>;
  accentColor: string;
  inactiveIconColor: string;
}) {
  return (
    <View style={styles.suggestionSection}>
      <Text style={styles.suggestionSectionTitle}>{title}</Text>
      {loading ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={accentColor} />
          <Text style={styles.loadingText}>{loadingLabel}</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionScroll}>
          {suggestions.map((suggestion) => {
            const selected = selectedLabel.trim().toLowerCase() === suggestion.label.trim().toLowerCase();
            return (
              <Pressable
                key={suggestion.id}
                onPress={() => onSelect(suggestion)}
                style={[styles.suggestionChip, selected && styles.suggestionChipActive]}
                accessibilityRole="button"
                accessibilityLabel={`Tag memory at ${suggestion.label}, ${kindLabels[suggestion.kind]}`}
                accessibilityState={{ selected }}
              >
                <View style={[styles.suggestionIcon, selected && styles.suggestionIconActive]}>
                  <Ionicons name={kindIcons[suggestion.kind]} size={15} color={selected ? accentColor : inactiveIconColor} />
                </View>
                <Text style={[styles.suggestionLabel, selected && styles.suggestionLabelActive]}>
                  {suggestion.label}
                </Text>
                {selected ? <Ionicons name="checkmark-circle" size={16} color={accentColor} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    section: {
      gap: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paper,
      padding: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    copy: { flex: 1, gap: 3 },
    label: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: colors.ink,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    hint: {
      fontFamily: fonts.body,
      fontSize: 12,
      lineHeight: 17,
      color: colors.ink,
    },
    selectedChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.paper,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    selectedChipText: {
      flex: 1,
      fontFamily: fonts.bodyMedium,
      fontSize: 14,
      lineHeight: 19,
      color: colors.ink,
    },
    input: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.canvas,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.ink,
    },
    customRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.accent,
      backgroundColor: colors.paper,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    customRowText: {
      flex: 1,
      fontFamily: fonts.bodyBold,
      fontSize: 14,
      color: colors.accent,
    },
    suggestionSection: {
      gap: spacing.xs,
    },
    suggestionSectionTitle: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: colors.ink,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    suggestionScroll: {
      gap: spacing.sm,
      paddingVertical: 2,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.xs,
    },
    loadingText: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: colors.ink,
    },
    suggestionChip: {
      minWidth: 112,
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
    suggestionChipActive: {
      borderColor: colors.accent,
      backgroundColor: colors.paper,
    },
    suggestionIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.line,
    },
    suggestionIconActive: {
      backgroundColor: colors.paper,
    },
    suggestionLabel: {
      fontFamily: fonts.bodyMedium,
      fontSize: 12,
      color: colors.ink,
    },
    suggestionLabelActive: {
      fontFamily: fonts.bodyBold,
      color: colors.ink,
    },
  });
