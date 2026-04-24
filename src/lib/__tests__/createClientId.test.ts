import { createClientId } from '../createClientId';

describe('createClientId', () => {
  it('includes the prefix', () => {
    const id = createClientId('post');
    expect(id.startsWith('post_')).toBe(true);
  });

  it('produces unique IDs across calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createClientId('test')));
    expect(ids.size).toBe(100);
  });

  it('uses base-36 encoded segments', () => {
    const id = createClientId('seg');
    const parts = id.split('_');
    // prefix, timestamp, sequence
    expect(parts).toHaveLength(3);
    // base-36 strings should only contain [a-z0-9]
    expect(parts[1]).toMatch(/^[a-z0-9]+$/);
    expect(parts[2]).toMatch(/^[a-z0-9]+$/);
  });
});
