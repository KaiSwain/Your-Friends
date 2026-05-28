import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ColorTokens } from '../../features/theme/themes';
import { protectTextFromFontClipping } from '../../theme/fontProtection';
import type { FontSet } from '../../theme/typography';
import { radius, shadow, spacing } from '../../theme/tokens';
import type { Contact } from '../../types/domain';
import { SectionCard } from '../SectionCard';

interface SavedProfileLinkChooserProps {
  allContacts: Contact[];
  busyContactId: string | null;
  colors: ColorTokens;
  disabled?: boolean;
  emptySearchText?: string;
  fonts: FontSet;
  onSelect: (contact: Contact) => void;
  suggestedContacts?: Contact[];
  suggestedNote?: string;
}

export function SavedProfileLinkChooser({
  allContacts,
  busyContactId,
  colors,
  disabled = false,
  emptySearchText = 'No saved profiles match that search.',
  fonts,
  onSelect,
  suggestedContacts = [],
  suggestedNote = 'We found these by name, but we will not connect anyone until you confirm.',
}: SavedProfileLinkChooserProps) {
  const styles = useMemo(() => makeStyles(colors, fonts), [colors, fonts]);
  const [query, setQuery] = useState('');
  const suggestedIds = useMemo(() => new Set(suggestedContacts.map((contact) => contact.id)), [suggestedContacts]);
  const normalizedQuery = query.trim().toLowerCase();
  const searchedContacts = normalizedQuery
    ? allContacts.filter((contact) => savedProfileMatchesQuery(contact, normalizedQuery))
    : allContacts;
  const otherMatches = searchedContacts.filter((contact) => !suggestedIds.has(contact.id));

  return (
    <View style={styles.container}>
      {suggestedContacts.length > 0 ? (
        <SectionCard eyebrow="Suggested matches" title="Likely saved profiles">
          <Text style={styles.note}>{suggestedNote}</Text>
          <View style={styles.list}>
            {suggestedContacts.map((contact) => (
              <SavedProfileCandidateRow
                key={contact.id}
                busy={busyContactId === contact.id}
                colors={colors}
                contact={contact}
                disabled={disabled || busyContactId !== null}
                fonts={fonts}
                onPress={() => onSelect(contact)}
              />
            ))}
          </View>
        </SectionCard>
      ) : null}

      {allContacts.length > 0 ? (
        <SectionCard eyebrow="All saved profiles" title="Search your profiles">
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name, nickname, tag, or fact"
            placeholderTextColor={colors.ink}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.list}>
            {otherMatches.length > 0 ? (
              otherMatches.map((contact) => (
                <SavedProfileCandidateRow
                  key={contact.id}
                  busy={busyContactId === contact.id}
                  colors={colors}
                  contact={contact}
                  disabled={disabled || busyContactId !== null}
                  fonts={fonts}
                  onPress={() => onSelect(contact)}
                />
              ))
            ) : (
              <Text style={styles.note}>{query.trim() ? emptySearchText : 'Suggested profiles are shown above.'}</Text>
            )}
          </View>
        </SectionCard>
      ) : null}
    </View>
  );
}

interface SavedProfileCandidateRowProps {
  busy: boolean;
  colors: ColorTokens;
  contact: Contact;
  disabled: boolean;
  fonts: FontSet;
  onPress: () => void;
}

function SavedProfileCandidateRow({ busy, colors, contact, disabled, fonts, onPress }: SavedProfileCandidateRowProps) {
  const styles = useMemo(() => makeRowStyles(colors, fonts), [colors, fonts]);
  const clueParts: string[] = [];
  if (contact.nickname) clueParts.push(`"${contact.nickname}"`);
  if (contact.tags.length > 0) clueParts.push(contact.tags.slice(0, 2).join(' · '));
  if (contact.facts.length > 0) clueParts.push(contact.facts[0]);
  const clue = clueParts.join(' · ');

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && !busy && styles.dim]}
      accessibilityRole="button"
      accessibilityLabel={`Choose ${contact.displayName}`}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarLabel}>{getInitials(contact.displayName)}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{contact.displayName}</Text>
        {clue ? <Text style={styles.subtitle}>{clue}</Text> : null}
        <Text style={styles.caption}>Saved {formatRelativeDate(contact.createdAt)}</Text>
      </View>
      <Ionicons name={busy ? 'hourglass-outline' : 'chevron-forward'} size={18} color={colors.ink} />
    </Pressable>
  );
}

function savedProfileMatchesQuery(contact: Contact, normalizedQuery: string) {
  const haystack = [
    contact.displayName,
    contact.nickname ?? '',
    ...(contact.tags ?? []),
    ...(contact.facts ?? []),
  ].join(' ').toLowerCase();
  return haystack.includes(normalizedQuery);
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

function formatRelativeDate(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffDays = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

const makeStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    container: { gap: spacing.lg },
    note: { fontFamily: fonts.body, fontSize: 14, color: colors.inkSoft, lineHeight: 20 },
    list: { gap: spacing.sm, marginTop: spacing.sm },
    searchInput: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperMuted,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontFamily: fonts.body,
      fontSize: 14,
      color: colors.ink,
      marginTop: spacing.sm,
      ...protectTextFromFontClipping(fonts.body, 14),
    },
  });

const makeRowStyles = (colors: ColorTokens, fonts: FontSet) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.paperMuted,
      borderWidth: 1,
      borderColor: colors.line,
      padding: spacing.md,
      ...shadow.card,
    },
    pressed: { transform: [{ scale: 0.99 }] },
    dim: { opacity: 0.5 },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
    },
    avatarLabel: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.white },
    body: { flex: 1, gap: 2 },
    title: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
    subtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.ink },
    caption: { fontFamily: fonts.body, fontSize: 11, color: colors.ink, opacity: 0.7 },
  });
