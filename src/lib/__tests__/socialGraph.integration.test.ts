import {
  rowToUser,
  rowToContact,
  rowToFriendship,
  rowToWallPost,
} from '../../features/social/mappers';
import type { AppUser, Contact, Friendship, PeopleListItem, WallPost } from '../../types/domain';

// Replicate the getPeopleListForUser logic from SocialGraphContext so we can
// test the list composition, deduplication, and sort order independently.
function getPeopleListForUser(
  userId: string,
  contacts: Contact[],
  friendships: Friendship[],
  users: AppUser[],
) {
  function getUserById(id: string) { return users.find((u) => u.id === id); }
  function getDirectFriends(uid: string) {
    return friendships
      .filter((f) => f.userLowId === uid || f.userHighId === uid)
      .map((f) => getUserById(f.userLowId === uid ? f.userHighId : f.userLowId))
      .filter((u): u is AppUser => Boolean(u));
  }

  const friendItems: PeopleListItem[] = getDirectFriends(userId).map((friend) => ({
    id: friend.id,
    entityType: 'user',
    createdAt: friendships.find(
      (f) =>
        (f.userLowId === userId && f.userHighId === friend.id) ||
        (f.userHighId === userId && f.userLowId === friend.id),
    )?.createdAt ?? friend.createdAt,
    title: friend.displayName,
    subtitle: `Friend code ${friend.friendCode}`,
    caption: 'Connected friend',
    avatarColor: friend.avatarColor,
    imageUri: friend.avatarPath ?? null,
    tags: [],
  }));

  const contactItems: PeopleListItem[] = contacts
    .filter((c) => c.ownerUserId === userId)
    .map((c) => ({
      id: c.id,
      entityType: 'contact',
      createdAt: c.createdAt,
      title: c.displayName,
      subtitle: c.linkedUserId ? 'Connected friend' : 'Contact',
      caption: c.linkedUserId ? 'Connected friend' : 'Contact',
      avatarColor: '#888',
      imageUri: c.avatarPath ?? null,
      tags: c.tags ?? [],
      note: c.note ?? null,
      cardColor: c.cardColor ?? null,
      linkedUserId: c.linkedUserId,
      pinned: c.pinned,
    }));

  const linkedUserIds = new Set(
    contacts.filter((c) => c.ownerUserId === userId && c.linkedUserId).map((c) => c.linkedUserId!),
  );

  return [...friendItems.filter((f) => !linkedUserIds.has(f.id)), ...contactItems].sort(
    (a, b) => {
      const pinA = a.pinned ? 1 : 0;
      const pinB = b.pinned ? 1 : 0;
      if (pinA !== pinB) return pinB - pinA;
      return b.createdAt.localeCompare(a.createdAt);
    },
  );
}

const me: AppUser = rowToUser({
  id: 'me', email: 'me@test.com', display_name: 'Me', friend_code: 'TESTME01',
  avatar_color: '#F00', avatar_path: null, profile_facts: [], created_at: '2024-01-01T00:00:00Z',
});
const alice: AppUser = rowToUser({
  id: 'alice', email: 'alice@test.com', display_name: 'Alice', friend_code: 'ALICE001',
  avatar_color: '#0F0', avatar_path: null, profile_facts: ['Friendly'], created_at: '2024-01-02T00:00:00Z',
});
const bob: AppUser = rowToUser({
  id: 'bob', email: 'bob@test.com', display_name: 'Bob', friend_code: 'BOB00001',
  avatar_color: '#00F', avatar_path: null, profile_facts: [], created_at: '2024-01-03T00:00:00Z',
});

describe('getPeopleListForUser', () => {
  it('returns empty for user with no contacts or friends', () => {
    const list = getPeopleListForUser('me', [], [], [me]);
    expect(list).toEqual([]);
  });

  it('includes unlinked contacts', () => {
    const c = rowToContact({
      id: 'c1', owner_user_id: 'me', display_name: 'Charlie', created_at: '2024-02-01T00:00:00Z',
    });
    const list = getPeopleListForUser('me', [c], [], [me]);
    expect(list).toHaveLength(1);
    expect(list[0].entityType).toBe('contact');
    expect(list[0].title).toBe('Charlie');
  });

  it('includes friends as user items', () => {
    const f = rowToFriendship({
      id: 'f1', user_low_id: 'alice', user_high_id: 'me', created_by_user_id: 'me', created_at: '2024-03-01T00:00:00Z',
    });
    const list = getPeopleListForUser('me', [], [f], [me, alice]);
    expect(list).toHaveLength(1);
    expect(list[0].entityType).toBe('user');
    expect(list[0].title).toBe('Alice');
  });

  it('deduplicates friends that have linked contacts', () => {
    const f = rowToFriendship({
      id: 'f1', user_low_id: 'alice', user_high_id: 'me', created_by_user_id: 'me', created_at: '2024-03-01T00:00:00Z',
    });
    const c = rowToContact({
      id: 'c1', owner_user_id: 'me', linked_user_id: 'alice', display_name: 'Alice', created_at: '2024-03-01T00:00:00Z',
    });
    const list = getPeopleListForUser('me', [c], [f], [me, alice]);
    // Should have 1 contact item, not 1 contact + 1 user
    expect(list).toHaveLength(1);
    expect(list[0].entityType).toBe('contact');
  });

  it('sorts pinned contacts first', () => {
    const c1 = rowToContact({
      id: 'c1', owner_user_id: 'me', display_name: 'Recent', created_at: '2024-06-01T00:00:00Z',
    });
    const c2 = rowToContact({
      id: 'c2', owner_user_id: 'me', display_name: 'Pinned', pinned: true, created_at: '2024-01-01T00:00:00Z',
    });
    const list = getPeopleListForUser('me', [c1, c2], [], [me]);
    expect(list[0].title).toBe('Pinned');
    expect(list[1].title).toBe('Recent');
  });

  it('sorts newest first within unpinned items', () => {
    const c1 = rowToContact({
      id: 'c1', owner_user_id: 'me', display_name: 'Older', created_at: '2024-01-01T00:00:00Z',
    });
    const c2 = rowToContact({
      id: 'c2', owner_user_id: 'me', display_name: 'Newer', created_at: '2024-06-01T00:00:00Z',
    });
    const list = getPeopleListForUser('me', [c1, c2], [], [me]);
    expect(list[0].title).toBe('Newer');
    expect(list[1].title).toBe('Older');
  });

  it('does not include contacts owned by other users', () => {
    const c = rowToContact({
      id: 'c1', owner_user_id: 'alice', display_name: 'Secret', created_at: '2024-02-01T00:00:00Z',
    });
    const list = getPeopleListForUser('me', [c], [], [me, alice]);
    expect(list).toHaveLength(0);
  });
});

describe('wall post filtering', () => {
  const posts: WallPost[] = [
    rowToWallPost({ id: 'p1', author_user_id: 'alice', subject_user_id: 'me', visibility: 'visible_to_subject', body: 'Hi', created_at: '2024-06-01' }),
    rowToWallPost({ id: 'p2', author_user_id: 'alice', subject_contact_id: 'c1', visibility: 'private', body: 'Private', created_at: '2024-05-01' }),
    rowToWallPost({ id: 'p3', author_user_id: 'bob', subject_user_id: 'me', visibility: 'visible_to_subject', body: 'From Bob', created_at: '2024-04-01' }),
  ];

  it('filters posts by subject user id', () => {
    const filtered = posts.filter((p) => p.subjectUserId === 'me');
    expect(filtered).toHaveLength(2);
  });

  it('filters posts by subject contact id', () => {
    const filtered = posts.filter((p) => p.subjectContactId === 'c1');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].body).toBe('Private');
  });

  it('filters visible posts by author', () => {
    const filtered = posts
      .filter((p) => p.authorUserId === 'alice' && p.visibility === 'visible_to_subject')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    expect(filtered).toHaveLength(1);
    expect(filtered[0].body).toBe('Hi');
  });
});

describe('isConnected logic', () => {
  const friendships: Friendship[] = [
    rowToFriendship({ id: 'f1', user_low_id: 'alice', user_high_id: 'me', created_by_user_id: 'me', created_at: '2024-01-01' }),
  ];

  function isConnected(a: string, b: string) {
    const low = a < b ? a : b;
    const high = a < b ? b : a;
    return friendships.some((f) => f.userLowId === low && f.userHighId === high);
  }

  it('returns true for existing friendship (either order)', () => {
    expect(isConnected('alice', 'me')).toBe(true);
    expect(isConnected('me', 'alice')).toBe(true);
  });

  it('returns false for non-existent friendship', () => {
    expect(isConnected('me', 'bob')).toBe(false);
  });
});

describe('notification filtering', () => {
  const notifications = [
    { id: 'n1', actorUserId: 'alice', read: false, type: 'wall_post', message: 'Alice posted' },
    { id: 'n2', actorUserId: 'alice', read: true, type: 'wall_post', message: 'Alice posted earlier' },
    { id: 'n3', actorUserId: 'bob', read: false, type: 'friend_request', message: 'Bob added you' },
  ];

  it('counts unread notifications', () => {
    expect(notifications.filter((n) => !n.read).length).toBe(2);
  });

  it('filters unread by actor', () => {
    const fromAlice = notifications.filter((n) => !n.read && n.actorUserId === 'alice');
    expect(fromAlice).toHaveLength(1);
  });
});
