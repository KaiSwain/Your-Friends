import { describe, expect, it } from '@jest/globals';

import { buildPeopleListForUser } from '../selectors';
import type { AppUser, Contact, Friendship } from '../../../types/domain';

const owner: AppUser = {
  id: 'u1',
  email: 'owner@test.com',
  displayName: 'Owner',
  friendCode: 'OWNER1',
  avatarColor: '#111111',
  birthday: null,
  profileBgImagePublic: false,
  profileFacts: [],
  createdAt: '2024-01-01T00:00:00Z',
};

const friend: AppUser = {
  id: 'u2',
  email: 'avery@test.com',
  displayName: 'Avery Hart',
  friendCode: 'AVERY1',
  avatarColor: '#222222',
  birthday: null,
  profileBgImagePublic: false,
  profileFacts: [],
  createdAt: '2024-01-02T00:00:00Z',
};

const friendship: Friendship = {
  id: 'f1',
  userLowId: 'u1',
  userHighId: 'u2',
  createdByUserId: 'u1',
  createdAt: '2024-01-03T00:00:00Z',
};

const baseContact: Contact = {
  id: 'c1',
  ownerUserId: 'u1',
  linkedUserId: null,
  displayName: 'Avery Hart',
  nickname: null,
  facts: [],
  avatarPath: null,
  avatarVideoPath: null,
  avatarVideoMuted: false,
  tags: [],
  note: null,
  cardColor: null,
  backText: null,
  profileBg: null,
  profileBgImagePath: null,
  pinned: false,
  pinnedAt: null,
  createdAt: '2024-01-04T00:00:00Z',
};

describe('buildPeopleListForUser', () => {
  it('uses the manual profile slot when an unlinked contact exactly matches an existing friend', () => {
    const people = buildPeopleListForUser({
      contacts: [baseContact],
      friendships: [friendship],
      userId: owner.id,
      users: [owner, friend],
    });

    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({
      id: 'c1',
      entityType: 'contact',
      suggestedLinkedUserId: 'u2',
      caption: 'Needs link',
    });
  });

  it('hides the direct friend account once a contact is linked to that friend', () => {
    const people = buildPeopleListForUser({
      contacts: [{ ...baseContact, linkedUserId: friend.id }],
      friendships: [friendship],
      userId: owner.id,
      users: [owner, friend],
    });

    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({
      id: 'c1',
      entityType: 'contact',
      linkedUserId: 'u2',
    });
  });
});
