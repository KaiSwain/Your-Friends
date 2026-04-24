import { createFriendCode, createFriendInviteLink, extractFriendCode, normalizeFriendCode } from '../friendCode';

describe('normalizeFriendCode', () => {
  it('uppercases lowercase input', () => {
    expect(normalizeFriendCode('abc123')).toBe('ABC123');
  });

  it('strips non-alphanumeric characters', () => {
    expect(normalizeFriendCode('AB-C1 23!')).toBe('ABC123');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeFriendCode('')).toBe('');
  });
});

describe('extractFriendCode', () => {
  it('returns plain codes unchanged apart from normalization', () => {
    expect(extractFriendCode('ab3x-k7pn')).toBe('AB3XK7PN');
  });

  it('extracts a code from a direct custom-scheme link', () => {
    expect(extractFriendCode('yourfriends://AB3XK7PN')).toBe('AB3XK7PN');
  });

  it('extracts a code from a query-param invite link', () => {
    expect(extractFriendCode('yourfriends://add-friend?code=AB3XK7PN')).toBe('AB3XK7PN');
  });

  it('returns empty string when no value is provided', () => {
    expect(extractFriendCode('')).toBe('');
  });
});

describe('createFriendInviteLink', () => {
  it('creates a deep link with the normalized code in the query string', () => {
    expect(createFriendInviteLink('ab3x-k7pn')).toBe('yourfriends://add-friend?code=AB3XK7PN');
  });

  it('falls back to the add-friend route when no code is provided', () => {
    expect(createFriendInviteLink('')).toBe('yourfriends://add-friend');
  });
});

describe('createFriendCode', () => {
  it('returns an 8-character code', () => {
    const code = createFriendCode('test-seed', []);
    expect(code).toHaveLength(8);
  });

  it('uses only the allowed alphabet (no O/0/I/1)', () => {
    const code = createFriendCode('another-seed', []);
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  });

  it('produces deterministic codes for the same seed', () => {
    const a = createFriendCode('stable', []);
    const b = createFriendCode('stable', []);
    expect(a).toBe(b);
  });

  it('avoids existing codes via retry', () => {
    const first = createFriendCode('collision-test', []);
    const second = createFriendCode('collision-test', [first]);
    expect(second).not.toBe(first);
    expect(second).toHaveLength(8);
  });

  it('produces different codes for different seeds', () => {
    const a = createFriendCode('seed-a', []);
    const b = createFriendCode('seed-b', []);
    expect(a).not.toBe(b);
  });
});
