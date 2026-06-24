import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { supabase } from '../../lib/supabase';
import type { ContactPrivateNoteBlockType } from '../../types/domain';

const PRIVATE_NOTE_QUEUE_KEY = 'yourfriends.pendingPrivateNoteOps.v1';

/**
 * Offline-first outbox for contact private notes.
 *
 * Every note/block mutation is applied optimistically to the React Query cache
 * and an operation is appended here. Because the `contact_private_notes` and
 * `contact_private_note_blocks` tables use client-insertable `uuid` primary
 * keys, we generate IDs on-device and reuse them on the server, so there is no
 * temp-id remapping: an op references the same id whether it has synced or not.
 */
export type PrivateNoteOp =
  | {
      opId: string;
      kind: 'note.insert';
      id: string;
      ownerUserId: string;
      contactId: string;
      title: string;
      createdAt: string;
      updatedAt: string;
    }
  | { opId: string; kind: 'note.update'; id: string; title?: string; updatedAt: string }
  | { opId: string; kind: 'note.delete'; id: string }
  | {
      opId: string;
      kind: 'block.insert';
      id: string;
      noteId: string;
      ownerUserId: string;
      type: ContactPrivateNoteBlockType;
      content: string | null;
      url: string | null;
      imagePath: string | null;
      sortOrder: number;
      createdAt: string;
      updatedAt: string;
    }
  | {
      opId: string;
      kind: 'block.update';
      id: string;
      content?: string | null;
      url?: string | null;
      imagePath?: string | null;
      sortOrder?: number;
      updatedAt: string;
    }
  | { opId: string; kind: 'block.delete'; id: string };

type PrivateNoteOpInput = PrivateNoteOp extends infer T
  ? T extends PrivateNoteOp
    ? Omit<T, 'opId'>
    : never
  : never;

export function newPrivateNoteId(): string {
  return Crypto.randomUUID();
}

export async function loadPrivateNoteOps(): Promise<PrivateNoteOp[]> {
  try {
    const raw = await AsyncStorage.getItem(PRIVATE_NOTE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PrivateNoteOp[]) : [];
  } catch (error) {
    console.warn('[private notes] failed to load queue:', error);
    return [];
  }
}

async function savePrivateNoteOps(ops: PrivateNoteOp[]): Promise<void> {
  try {
    await AsyncStorage.setItem(PRIVATE_NOTE_QUEUE_KEY, JSON.stringify(ops));
  } catch (error) {
    console.warn('[private notes] failed to save queue:', error);
  }
}

/**
 * Pure reducer that folds an incoming op into the existing queue. Keeping this
 * pure makes the merge rules easy to unit test.
 *
 * Rules:
 * - inserts append.
 * - updates fold into a pending insert for the same id (so we never emit a
 *   server update for a row that has not been inserted yet) or merge with a
 *   prior pending update.
 * - deletes drop any pending ops for the same id; if the row was never synced
 *   (it still had a pending insert) the delete is dropped entirely.
 */
export function coalescePrivateNoteOps(queue: PrivateNoteOp[], incoming: PrivateNoteOp): PrivateNoteOp[] {
  switch (incoming.kind) {
    case 'note.insert':
    case 'block.insert':
      return [...queue, incoming];

    case 'note.update': {
      const insertIndex = queue.findIndex((op) => op.kind === 'note.insert' && op.id === incoming.id);
      if (insertIndex >= 0) {
        const existing = queue[insertIndex];
        if (existing.kind !== 'note.insert') return [...queue, incoming];
        const merged: PrivateNoteOp = {
          ...existing,
          title: incoming.title ?? existing.title,
          updatedAt: incoming.updatedAt,
        };
        return replaceAt(queue, insertIndex, merged);
      }
      const updateIndex = queue.findIndex((op) => op.kind === 'note.update' && op.id === incoming.id);
      if (updateIndex >= 0) {
        const existing = queue[updateIndex];
        if (existing.kind !== 'note.update') return [...queue, incoming];
        const merged: PrivateNoteOp = {
          ...existing,
          title: incoming.title ?? existing.title,
          updatedAt: incoming.updatedAt,
        };
        return replaceAt(queue, updateIndex, merged);
      }
      return [...queue, incoming];
    }

    case 'note.delete': {
      const hadPendingInsert = queue.some((op) => op.kind === 'note.insert' && op.id === incoming.id);
      const filtered = queue.filter((op) => {
        if (op.kind === 'note.insert' && op.id === incoming.id) return false;
        if (op.kind === 'note.update' && op.id === incoming.id) return false;
        if (op.kind === 'block.insert' && op.noteId === incoming.id) return false;
        return true;
      });
      return hadPendingInsert ? filtered : [...filtered, incoming];
    }

    case 'block.update': {
      const insertIndex = queue.findIndex((op) => op.kind === 'block.insert' && op.id === incoming.id);
      if (insertIndex >= 0) {
        const existing = queue[insertIndex];
        if (existing.kind !== 'block.insert') return [...queue, incoming];
        const merged: PrivateNoteOp = {
          ...existing,
          content: incoming.content !== undefined ? incoming.content : existing.content,
          url: incoming.url !== undefined ? incoming.url : existing.url,
          imagePath: incoming.imagePath !== undefined ? incoming.imagePath : existing.imagePath,
          sortOrder: incoming.sortOrder !== undefined ? incoming.sortOrder : existing.sortOrder,
          updatedAt: incoming.updatedAt,
        };
        return replaceAt(queue, insertIndex, merged);
      }
      const updateIndex = queue.findIndex((op) => op.kind === 'block.update' && op.id === incoming.id);
      if (updateIndex >= 0) {
        const existing = queue[updateIndex];
        if (existing.kind !== 'block.update') return [...queue, incoming];
        const merged: PrivateNoteOp = {
          ...existing,
          content: incoming.content !== undefined ? incoming.content : existing.content,
          url: incoming.url !== undefined ? incoming.url : existing.url,
          imagePath: incoming.imagePath !== undefined ? incoming.imagePath : existing.imagePath,
          sortOrder: incoming.sortOrder !== undefined ? incoming.sortOrder : existing.sortOrder,
          updatedAt: incoming.updatedAt,
        };
        return replaceAt(queue, updateIndex, merged);
      }
      return [...queue, incoming];
    }

    case 'block.delete': {
      const hadPendingInsert = queue.some((op) => op.kind === 'block.insert' && op.id === incoming.id);
      const filtered = queue.filter((op) => {
        if (op.kind === 'block.insert' && op.id === incoming.id) return false;
        if (op.kind === 'block.update' && op.id === incoming.id) return false;
        return true;
      });
      return hadPendingInsert ? filtered : [...filtered, incoming];
    }

    default:
      return queue;
  }
}

function replaceAt(queue: PrivateNoteOp[], index: number, op: PrivateNoteOp): PrivateNoteOp[] {
  const next = queue.slice();
  next[index] = op;
  return next;
}

export async function enqueuePrivateNoteOp(input: PrivateNoteOpInput): Promise<void> {
  const op = { ...input, opId: Crypto.randomUUID() } as PrivateNoteOp;
  const queue = await loadPrivateNoteOps();
  const next = coalescePrivateNoteOps(queue, op);
  await savePrivateNoteOps(next);
}

export function isPrivateNoteConnectionError(message: string): boolean {
  return /network|offline|timed out|fetch|connection/i.test(message);
}

function isDuplicateInsertError(message: string): boolean {
  return /duplicate key|already exists|23505/i.test(message);
}

export async function executePrivateNoteOp(op: PrivateNoteOp): Promise<void> {
  switch (op.kind) {
    case 'note.insert': {
      const { error } = await supabase.from('contact_private_notes').insert({
        id: op.id,
        owner_user_id: op.ownerUserId,
        contact_id: op.contactId,
        title: op.title,
        created_at: op.createdAt,
        updated_at: op.updatedAt,
      });
      if (error && !isDuplicateInsertError(error.message)) throw new Error(error.message);
      return;
    }
    case 'note.update': {
      const patch: Record<string, unknown> = { updated_at: op.updatedAt };
      if (op.title !== undefined) patch.title = op.title;
      const { error } = await supabase.from('contact_private_notes').update(patch).eq('id', op.id);
      if (error) throw new Error(error.message);
      return;
    }
    case 'note.delete': {
      const { error } = await supabase.from('contact_private_notes').delete().eq('id', op.id);
      if (error) throw new Error(error.message);
      return;
    }
    case 'block.insert': {
      const { error } = await supabase.from('contact_private_note_blocks').insert({
        id: op.id,
        note_id: op.noteId,
        owner_user_id: op.ownerUserId,
        type: op.type,
        content: op.content,
        url: op.url,
        image_path: op.imagePath,
        sort_order: op.sortOrder,
        created_at: op.createdAt,
        updated_at: op.updatedAt,
      });
      if (error && !isDuplicateInsertError(error.message)) throw new Error(error.message);
      return;
    }
    case 'block.update': {
      const patch: Record<string, unknown> = { updated_at: op.updatedAt };
      if (op.content !== undefined) patch.content = op.content;
      if (op.url !== undefined) patch.url = op.url;
      if (op.imagePath !== undefined) patch.image_path = op.imagePath;
      if (op.sortOrder !== undefined) patch.sort_order = op.sortOrder;
      const { error } = await supabase.from('contact_private_note_blocks').update(patch).eq('id', op.id);
      if (error) throw new Error(error.message);
      return;
    }
    case 'block.delete': {
      const { error } = await supabase.from('contact_private_note_blocks').delete().eq('id', op.id);
      if (error) throw new Error(error.message);
      return;
    }
  }
}

let replaying = false;

/**
 * Drains the queue in FIFO order. Stops on the first connection error (so it
 * retries later when back online) and drops any op that fails for a
 * non-connection reason so a single poison op can never wedge the queue.
 *
 * The executor is injectable for testing.
 */
export async function replayPrivateNoteOps(
  executor: (op: PrivateNoteOp) => Promise<void> = executePrivateNoteOp,
): Promise<void> {
  if (replaying) return;
  replaying = true;
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const queue = await loadPrivateNoteOps();
      if (queue.length === 0) break;
      const head = queue[0];
      try {
        await executor(head);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isPrivateNoteConnectionError(message)) break;
        console.warn('[private notes] dropping op after non-connection error:', message, head);
      }
      const latest = await loadPrivateNoteOps();
      await savePrivateNoteOps(latest.filter((op) => op.opId !== head.opId));
    }
  } finally {
    replaying = false;
  }
}
