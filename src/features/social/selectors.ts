import { accentPalette } from '../../theme/tokens';
import type { AppUser, Contact, Friendship, PeopleListItem } from '../../types/domain';

export function buildPeopleListForUser({
  contacts,
  friendships,
  userId,
  users,
}: {
  contacts: Contact[];
  friendships: Friendship[];
  userId: string;
  users: AppUser[];
}): PeopleListItem[] {
  const friends = getDirectFriendsFromSnapshot(userId, friendships, users);
  const myContacts = contacts.filter((contact) => contact.ownerUserId === userId);
  const suggestedFriendIds = new Set<string>();

  for (const contact of myContacts) {
    if (contact.linkedUserId) continue;
    const exactNameMatch = friends.find((friend) => normalizeName(friend.displayName) === normalizeName(contact.displayName));
    if (exactNameMatch) suggestedFriendIds.add(exactNameMatch.id);
  }

  const friendItems: PeopleListItem[] = friends.map((friend) => ({
    id: friend.id,
    entityType: 'user',
    createdAt:
      friendships.find(
        (friendship) =>
          (friendship.userLowId === userId && friendship.userHighId === friend.id) ||
          (friendship.userHighId === userId && friendship.userLowId === friend.id),
      )?.createdAt ?? friend.createdAt,
    title: friend.displayName,
    subtitle: `Friend code ${friend.friendCode}`,
    caption: '',
    avatarColor: friend.avatarColor,
    imageUri: friend.avatarPath ?? null,
    tags: [],
  }));

  const contactItems: PeopleListItem[] = myContacts
    .map((contact) => {
      const linkedFriend = contact.linkedUserId ? users.find((user) => user.id === contact.linkedUserId) : undefined;
      const suggestedFriend = !contact.linkedUserId
        ? friends.find((friend) => normalizeName(friend.displayName) === normalizeName(contact.displayName))
        : undefined;
      return {
        id: contact.id,
        entityType: 'contact' as const,
        createdAt: contact.createdAt,
        title: contact.displayName,
        subtitle: contact.nickname ? `Saved as ${contact.nickname}` : suggestedFriend ? `Possible match: ${suggestedFriend.email}` : '',
        caption: suggestedFriend ? 'Needs link' : '',
        avatarColor: getContactAccent(contact.id),
        imageUri: contact.avatarPath ?? linkedFriend?.avatarPath ?? null,
        avatarVideoPath: contact.avatarVideoPath ?? null,
        avatarVideoMuted: contact.avatarVideoMuted ?? false,
        tags: contact.tags ?? [],
        note: contact.note ?? null,
        cardColor: contact.cardColor ?? null,
        linkedUserId: contact.linkedUserId,
        suggestedLinkedUserId: suggestedFriend?.id ?? null,
        pinned: contact.pinned,
        pinnedAt: contact.pinnedAt,
      };
    });

  const linkedUserIds = new Set(
    contacts.filter((contact) => contact.ownerUserId === userId && contact.linkedUserId).map((contact) => contact.linkedUserId!),
  );

  return [
    ...friendItems.filter((friend) => !linkedUserIds.has(friend.id) && !suggestedFriendIds.has(friend.id)),
    ...contactItems,
  ].sort(sortPeopleListItems);
}

export function buildContactProfileViewModel({
  accentColor,
  contact,
  friendHasPremium,
  linkedUser,
}: {
  accentColor: string;
  contact: Contact;
  friendHasPremium: boolean;
  linkedUser?: AppUser | null;
}) {
  return {
    accentColor,
    avatarUri: contact.avatarPath ?? linkedUser?.avatarPath ?? null,
    cardColor: contact.cardColor ?? null,
    displayName: contact.displayName,
    friendHasPremium,
    isLinked: Boolean(contact.linkedUserId),
    note: contact.note ?? null,
    profileBgImagePath: contact.profileBgImagePath ?? null,
    tags: contact.tags ?? [],
    videoMuted: contact.avatarVideoMuted ?? false,
    videoUri: contact.avatarVideoPath ?? null,
  };
}

export function buildViewedWallProfileViewModel({
  accentColor,
  currentUser,
  friendHasPremium,
  glow,
  theirContact,
}: {
  accentColor: string;
  currentUser: AppUser;
  friendHasPremium: boolean;
  glow: boolean;
  theirContact?: Contact | null;
}) {
  return {
    accentColor,
    avatarUri: theirContact?.avatarPath ?? currentUser.avatarPath ?? null,
    backText: theirContact?.backText ?? null,
    cardColor: theirContact?.cardColor ?? null,
    displayName: theirContact?.displayName ?? currentUser.displayName,
    facts: theirContact?.facts ?? [],
    friendHasPremium,
    glow,
    note: theirContact?.note ?? null,
    profileBgImagePath: theirContact?.profileBgImagePath ?? null,
    tags: theirContact?.tags ?? [],
    videoMuted: theirContact?.avatarVideoMuted ?? false,
    videoUri: theirContact?.avatarVideoPath ?? null,
  };
}

function getDirectFriendsFromSnapshot(userId: string, friendships: Friendship[], users: AppUser[]) {
  return friendships
    .filter((friendship) => friendship.userLowId === userId || friendship.userHighId === userId)
    .map((friendship) => {
      const friendId = friendship.userLowId === userId ? friendship.userHighId : friendship.userLowId;
      return users.find((user) => user.id === friendId);
    })
    .filter((user): user is AppUser => Boolean(user));
}

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function sortPeopleListItems(left: PeopleListItem, right: PeopleListItem) {
  const pinA = left.pinned ? 1 : 0;
  const pinB = right.pinned ? 1 : 0;
  if (pinA !== pinB) return pinB - pinA;
  if (pinA && pinB) {
    const pinnedAtA = left.pinnedAt ?? left.createdAt;
    const pinnedAtB = right.pinnedAt ?? right.createdAt;
    const pinOrder = pinnedAtA.localeCompare(pinnedAtB);
    if (pinOrder !== 0) return pinOrder;
  }
  return right.createdAt.localeCompare(left.createdAt);
}

export function getContactAccent(contactId: string) {
  const total = Array.from(contactId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return accentPalette[total % accentPalette.length];
}
