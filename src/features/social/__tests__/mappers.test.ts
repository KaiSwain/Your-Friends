import {
  rowToUser,
  rowToContact,
  rowToFriendship,
  rowToWallPost,
  rowToFriendFact,
  rowToNotification,
} from '../mappers';

describe('rowToUser', () => {
  it('maps snake_case DB row to camelCase AppUser', () => {
    const row = {
      id: 'u1',
      email: 'a@b.com',
      display_name: 'Alice',
      friend_code: 'ABCD1234',
      avatar_color: '#FF0000',
      avatar_path: 'https://img.test/a.jpg',
      profile_facts: ['Loves cats'],
      created_at: '2024-01-01T00:00:00Z',
    };
    const user = rowToUser(row);
    expect(user).toEqual({
      id: 'u1',
      email: 'a@b.com',
      displayName: 'Alice',
      friendCode: 'ABCD1234',
      avatarColor: '#FF0000',
      avatarPath: 'https://img.test/a.jpg',
      profileFacts: ['Loves cats'],
      createdAt: '2024-01-01T00:00:00Z',
    });
  });

  it('defaults nullable fields', () => {
    const user = rowToUser({ id: 'u2', email: '', display_name: '', friend_code: '', avatar_color: '', created_at: '' });
    expect(user.avatarPath).toBeNull();
    expect(user.profileFacts).toEqual([]);
  });
});

describe('rowToContact', () => {
  it('maps all fields correctly', () => {
    const row = {
      id: 'c1',
      owner_user_id: 'u1',
      linked_user_id: 'u2',
      display_name: 'Bob',
      nickname: 'Bobby',
      facts: ['Fact 1'],
      avatar_path: null,
      tags: ['family'],
      note: 'Note here',
      card_color: '#00FF00',
      profile_bg: 'ocean',
      pinned: true,
      created_at: '2024-02-01T00:00:00Z',
    };
    const contact = rowToContact(row);
    expect(contact.ownerUserId).toBe('u1');
    expect(contact.linkedUserId).toBe('u2');
    expect(contact.nickname).toBe('Bobby');
    expect(contact.tags).toEqual(['family']);
    expect(contact.pinned).toBe(true);
    expect(contact.profileBg).toBe('ocean');
  });

  it('defaults missing nullable fields', () => {
    const contact = rowToContact({ id: 'c2', owner_user_id: 'u1', display_name: 'Test', created_at: '' });
    expect(contact.linkedUserId).toBeNull();
    expect(contact.nickname).toBeNull();
    expect(contact.facts).toEqual([]);
    expect(contact.tags).toEqual([]);
    expect(contact.note).toBeNull();
    expect(contact.cardColor).toBeNull();
    expect(contact.profileBg).toBeNull();
    expect(contact.pinned).toBe(false);
  });
});

describe('rowToFriendship', () => {
  it('maps canonical pair fields', () => {
    const fs = rowToFriendship({
      id: 'f1',
      user_low_id: 'aaa',
      user_high_id: 'zzz',
      created_by_user_id: 'aaa',
      created_at: '2024-03-01',
    });
    expect(fs.userLowId).toBe('aaa');
    expect(fs.userHighId).toBe('zzz');
    expect(fs.createdByUserId).toBe('aaa');
  });
});

describe('rowToWallPost', () => {
  it('maps image_path to imageUri', () => {
    const post = rowToWallPost({
      id: 'p1',
      author_user_id: 'u1',
      subject_user_id: 'u2',
      visibility: 'private',
      body: 'Hello',
      image_path: 'https://img.test/x.jpg',
      card_color: '#FFF',
      back_text: 'Back',
      created_at: '2024-04-01',
    });
    expect(post.imageUri).toBe('https://img.test/x.jpg');
    expect(post.backText).toBe('Back');
    expect(post.subjectContactId).toBeNull();
  });

  it('decodes text-only style metadata stored in filter', () => {
    const post = rowToWallPost({
      id: 'p2',
      author_user_id: 'u1',
      subject_contact_id: 'c1',
      visibility: 'private',
      body: 'Styled note',
      filter: '__yf_text_style__:{"font":"marker","size":34,"effect":"glow","color":"rose"}',
      created_at: '2024-04-02',
    });
    expect(post.filter).toBeNull();
    expect(post.textFont).toBe('marker');
    expect(post.textSize).toBe(34);
    expect(post.textEffect).toBe('glow');
    expect(post.textColor).toBe('rose');
  });
});

describe('rowToFriendFact', () => {
  it('maps all fields', () => {
    const fact = rowToFriendFact({
      id: 'ff1',
      author_user_id: 'u1',
      subject_user_id: 'u2',
      body: 'Likes pizza',
      created_at: '2024-05-01',
    });
    expect(fact.authorUserId).toBe('u1');
    expect(fact.body).toBe('Likes pizza');
  });
});

describe('rowToNotification', () => {
  it('maps all fields and defaults referenceId', () => {
    const n = rowToNotification({
      id: 'n1',
      recipient_user_id: 'u1',
      actor_user_id: 'u2',
      type: 'wall_post',
      message: 'New post',
      read: false,
      created_at: '2024-06-01',
    });
    expect(n.recipientUserId).toBe('u1');
    expect(n.referenceId).toBeNull();
    expect(n.read).toBe(false);
  });
});
