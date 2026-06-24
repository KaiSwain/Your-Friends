const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorage.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockStorage.delete(key);
    }),
  },
}));

let uuidCounter = 0;
jest.mock('expo-crypto', () => ({
  __esModule: true,
  randomUUID: jest.fn(() => `uuid-${++uuidCounter}`),
}));

// Avoid pulling the real supabase client (and its react-native polyfills) into
// the node test environment. Replay is exercised with an injected executor.
jest.mock('../../../lib/supabase', () => ({ supabase: {} }));

import {
  coalescePrivateNoteOps,
  enqueuePrivateNoteOp,
  loadPrivateNoteOps,
  type PrivateNoteOp,
  replayPrivateNoteOps,
} from '../privateNoteQueue';

function noteInsert(id: string, title = 'Note'): PrivateNoteOp {
  return {
    opId: `op-${id}`,
    kind: 'note.insert',
    id,
    ownerUserId: 'owner',
    contactId: 'contact',
    title,
    createdAt: 't0',
    updatedAt: 't0',
  };
}

function blockInsert(id: string, noteId: string, content: string | null = ''): PrivateNoteOp {
  return {
    opId: `op-${id}`,
    kind: 'block.insert',
    id,
    noteId,
    ownerUserId: 'owner',
    type: 'text',
    content,
    url: null,
    imagePath: null,
    sortOrder: 0,
    createdAt: 't0',
    updatedAt: 't0',
  };
}

describe('coalescePrivateNoteOps', () => {
  it('folds a note title update into a pending insert', () => {
    const queue = [noteInsert('n1', 'Untitled note')];
    const next = coalescePrivateNoteOps(queue, {
      opId: 'u1',
      kind: 'note.update',
      id: 'n1',
      title: 'Trip ideas',
      updatedAt: 't1',
    });
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ kind: 'note.insert', id: 'n1', title: 'Trip ideas', updatedAt: 't1' });
  });

  it('merges consecutive note updates into one op', () => {
    let queue = coalescePrivateNoteOps([], { opId: 'u1', kind: 'note.update', id: 'n1', title: 'A', updatedAt: 't1' });
    queue = coalescePrivateNoteOps(queue, { opId: 'u2', kind: 'note.update', id: 'n1', title: 'B', updatedAt: 't2' });
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ kind: 'note.update', id: 'n1', title: 'B', updatedAt: 't2' });
  });

  it('drops a never-synced note (and its blocks) entirely on delete', () => {
    let queue = [noteInsert('n1')];
    queue = coalescePrivateNoteOps(queue, blockInsert('b1', 'n1', 'hello'));
    queue = coalescePrivateNoteOps(queue, { opId: 'u1', kind: 'note.update', id: 'n1', title: 'X', updatedAt: 't1' });
    queue = coalescePrivateNoteOps(queue, { opId: 'd1', kind: 'note.delete', id: 'n1' });
    expect(queue).toHaveLength(0);
  });

  it('keeps a server delete for a note that already synced', () => {
    // No pending insert => the note exists on the server already.
    const queue = coalescePrivateNoteOps([], { opId: 'd1', kind: 'note.delete', id: 'n1' });
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ kind: 'note.delete', id: 'n1' });
  });

  it('folds block field edits into a pending block insert', () => {
    let queue = [blockInsert('b1', 'n1', '')];
    queue = coalescePrivateNoteOps(queue, {
      opId: 'u1',
      kind: 'block.update',
      id: 'b1',
      content: 'final text',
      updatedAt: 't1',
    });
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({ kind: 'block.insert', id: 'b1', content: 'final text' });
  });

  it('drops a never-synced block on delete but keeps a synced block delete', () => {
    const neverSynced = coalescePrivateNoteOps([blockInsert('b1', 'n1')], {
      opId: 'd1',
      kind: 'block.delete',
      id: 'b1',
    });
    expect(neverSynced).toHaveLength(0);

    const synced = coalescePrivateNoteOps([], { opId: 'd2', kind: 'block.delete', id: 'b2' });
    expect(synced).toHaveLength(1);
  });
});

describe('enqueue + replay', () => {
  beforeEach(() => {
    mockStorage.clear();
    uuidCounter = 0;
  });

  it('persists ops and drains them in FIFO order', async () => {
    await enqueuePrivateNoteOp({
      kind: 'note.insert',
      id: 'n1',
      ownerUserId: 'owner',
      contactId: 'contact',
      title: 'Note',
      createdAt: 't0',
      updatedAt: 't0',
    });
    await enqueuePrivateNoteOp(blockInsertInput('b1', 'n1'));

    const processed: string[] = [];
    await replayPrivateNoteOps(async (op) => {
      processed.push(op.kind);
    });

    expect(processed).toEqual(['note.insert', 'block.insert']);
    await expect(loadPrivateNoteOps()).resolves.toEqual([]);
  });

  it('stops on a connection error and retries the same op later', async () => {
    await enqueuePrivateNoteOp(blockInsertInput('b1', 'n1'));

    let attempts = 0;
    await replayPrivateNoteOps(async () => {
      attempts += 1;
      throw new Error('Network request failed');
    });
    expect(attempts).toBe(1);
    await expect(loadPrivateNoteOps()).resolves.toHaveLength(1);

    // Reconnect: the same op drains successfully.
    await replayPrivateNoteOps(async () => {});
    await expect(loadPrivateNoteOps()).resolves.toEqual([]);
  });

  it('drops a poison op (non-connection error) and continues', async () => {
    await enqueuePrivateNoteOp(blockInsertInput('b1', 'n1'));
    await enqueuePrivateNoteOp(blockInsertInput('b2', 'n1'));

    const processed: string[] = [];
    await replayPrivateNoteOps(async (op) => {
      if (op.kind === 'block.insert' && op.id === 'b1') throw new Error('row-level security violation');
      processed.push(op.id);
    });

    expect(processed).toEqual(['b2']);
    await expect(loadPrivateNoteOps()).resolves.toEqual([]);
  });
});

function blockInsertInput(id: string, noteId: string) {
  return {
    kind: 'block.insert' as const,
    id,
    noteId,
    ownerUserId: 'owner',
    type: 'text' as const,
    content: '',
    url: null,
    imagePath: null,
    sortOrder: 0,
    createdAt: 't0',
    updatedAt: 't0',
  };
}
