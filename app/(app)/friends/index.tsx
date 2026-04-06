import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../../../src/components/ActionButton';
import { AppScreen } from '../../../src/components/AppScreen';
import { DrawerMenu } from '../../../src/components/DrawerMenu';
import { PolaroidCarousel } from '../../../src/components/PolaroidCarousel';
import { SectionCard } from '../../../src/components/SectionCard';
import { useAuth } from '../../../src/features/auth/AuthContext';
import { useSocialGraph } from '../../../src/features/social/SocialGraphContext';
import { useTheme } from '../../../src/features/theme/ThemeContext';
import type { ColorTokens } from '../../../src/features/theme/themes';
import { fonts } from '../../../src/theme/typography';
import { radius, spacing } from '../../../src/theme/tokens';

export default function FriendsListScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const { contacts, getDirectFriends, getPeopleListForUser } = useSocialGraph();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!currentUser) return <Redirect href="/(auth)/sign-in" />;

  const people = getPeopleListForUser(currentUser.id);
  const directFriends = getDirectFriends(currentUser.id);
  const manualContacts = contacts.filter((c) => c.ownerUserId === currentUser.id);
  const activePerson = people[activeIndex] ?? people[0];

  return (
    <>
    <AppScreen
      contentContainerStyle={styles.screenContent}
      footer={<ActionButton label="+ Add Friend" onPress={() => router.push('/(app)/friends/add')} />}
    >
      <View style={styles.headerRow}>
        <Pressable onPress={() => setDrawerOpen(true)}>
          <Text style={styles.headerLink}>☰</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/(app)/notifications')}>
          <Text style={styles.headerLink}>🔔</Text>
        </Pressable>
      </View>

      <View style={styles.heroCopy}>
        <Text style={styles.title}>Your Friends</Text>
        <Text style={styles.subtitle}>Swipe through the people you keep close.</Text>
      </View>

      <Pressable onPress={() => router.push('/(app)/friends/add')} style={styles.searchBar}>
        <Text style={styles.searchBarIcon}>🔍</Text>
        <Text style={styles.searchBarPlaceholder}>Search for friends...</Text>
      </Pressable>

      {people.length > 0 ? (
        <View style={styles.carouselBlock}>
          <PolaroidCarousel
            activeIndex={activeIndex}
            items={people}
            onIndexChange={setActiveIndex}
            onPressItem={(item) =>
              router.push(
                item.entityType === 'user'
                  ? `/(app)/profiles/user/${item.id}`
                  : `/(app)/profiles/contact/${item.id}`,
              )
            }
          />

          <View style={styles.activeMeta}>
            <Text style={styles.activeName}>{activePerson?.title}</Text>
            <Text style={styles.activeDescription}>{activePerson?.subtitle}</Text>
          </View>

          <View style={styles.miniStatsRow}>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatNumber}>{directFriends.length}</Text>
              <Text style={styles.miniStatLabel}>friends</Text>
            </View>
            <View style={styles.miniStat}>
              <Text style={styles.miniStatNumber}>{manualContacts.length}</Text>
              <Text style={styles.miniStatLabel}>contacts</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>👋</Text>
          <Text style={styles.emptyTitle}>No friends yet</Text>
          <Text style={styles.emptySubtitle}>Add your first friend by their code, or save someone as a private contact.</Text>
        </View>
      )}

      <View style={styles.listSectionGroup}>
        <SectionCard eyebrow="Friends" title={`${directFriends.length} connected`}>
          {directFriends.length > 0 ? (
            directFriends.map((friend) => (
              <Pressable key={friend.id} onPress={() => router.push(`/(app)/profiles/user/${friend.id}`)} style={styles.personRow}>
                <View style={[styles.personDot, { backgroundColor: friend.avatarColor }]} />
                <View style={styles.personCopy}>
                  <Text style={styles.personName}>{friend.displayName}</Text>
                  <Text style={styles.personMeta}>Friend code {friend.friendCode}</Text>
                </View>
                <Text style={styles.personAction}>View</Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.sectionHint}>No connected friends yet. Add someone by their friend code.</Text>
          )}
        </SectionCard>

        <SectionCard eyebrow="Contacts" title={`${manualContacts.length} saved`}>
          {manualContacts.length > 0 ? (
            manualContacts.map((contact) => (
              <Pressable key={contact.id} onPress={() => router.push(`/(app)/profiles/contact/${contact.id}`)} style={styles.personRow}>
                <View style={styles.personDotMuted} />
                <View style={styles.personCopy}>
                  <Text style={styles.personName}>{contact.displayName}</Text>
                  <Text style={styles.personMeta}>{contact.nickname ? `Saved as ${contact.nickname}` : 'Private contact'}</Text>
                </View>
                <Text style={styles.personAction}>View</Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.sectionHint}>No private contacts yet. Save someone manually to start your list.</Text>
          )}
        </SectionCard>
      </View>
    </AppScreen>
    <DrawerMenu visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

const makeStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    screenContent: { paddingTop: spacing.sm, paddingBottom: spacing.xxl, gap: spacing.lg },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerLink: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.inkSoft },
    heroCopy: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md },
    title: { fontFamily: fonts.heading, fontSize: 34, color: colors.ink, textAlign: 'center' },
    subtitle: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft, textAlign: 'center' },
    carouselBlock: { alignItems: 'center', gap: spacing.md },
    emptyState: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
    emptyEmoji: { fontSize: 48 },
    emptyTitle: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink, textAlign: 'center' },
    emptySubtitle: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.inkSoft, textAlign: 'center' },
    listSectionGroup: { gap: spacing.md },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.paperMuted,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.pill,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      marginHorizontal: spacing.md,
    },
    searchBarIcon: { fontSize: 16 },
    searchBarPlaceholder: { fontFamily: fonts.body, fontSize: 15, color: colors.inkMuted, flex: 1 },
    activeMeta: { alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xl },
    activeName: { fontFamily: fonts.heading, fontSize: 28, color: colors.ink, textAlign: 'center' },
    activeDescription: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.inkSoft, textAlign: 'center' },
    miniStatsRow: { flexDirection: 'row', gap: spacing.md },
    miniStat: { minWidth: 92, alignItems: 'center', borderRadius: radius.pill, backgroundColor: 'rgba(255, 255, 255, 0.06)', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
    miniStatNumber: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink },
    miniStatLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.inkSoft, textTransform: 'uppercase', letterSpacing: 0.8 },
    personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
    personDot: { width: 12, height: 12, borderRadius: radius.pill },
    personDotMuted: { width: 12, height: 12, borderRadius: radius.pill, backgroundColor: colors.inkMuted },
    personCopy: { flex: 1, gap: 2 },
    personName: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink },
    personMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.inkSoft },
    personAction: { fontFamily: fonts.bodyBold, fontSize: 13, color: colors.accent },
    sectionHint: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.inkSoft },
  });
