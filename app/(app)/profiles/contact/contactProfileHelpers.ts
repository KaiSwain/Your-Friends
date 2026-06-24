import type { ContactPrivateNoteBlock, WallPost } from '../../../../src/types/domain';

export function getNotePreview(blocks: ContactPrivateNoteBlock[]) {
  const text = blocks.find((block) => block.type === 'text' && block.content?.trim())?.content?.trim();
  if (text) return text;
  const linkBlocks = blocks.filter((block) => block.type === 'link' && (block.url?.trim() || block.content?.trim()));
  if (linkBlocks.length === 1) return linkBlocks[0].url?.trim() || linkBlocks[0].content?.trim() || '1 link';
  if (linkBlocks.length > 1) return `${linkBlocks.length} links`;
  const photoCount = blocks.filter((block) => block.type === 'image').length;
  if (photoCount > 0) return photoCount === 1 ? '1 photo' : `${photoCount} photos`;
  return '';
}

export type MemoryFilter = 'all' | 'photos' | 'notes' | 'songs' | 'movies' | 'prompts';

export const MEMORY_FILTER_OPTIONS: { key: MemoryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'photos', label: 'Photos' },
  { key: 'notes', label: 'Notes' },
  { key: 'songs', label: 'Songs' },
  { key: 'movies', label: 'Movies' },
  { key: 'prompts', label: 'Prompts' },
];

export function filterWallPosts(posts: WallPost[], filter: MemoryFilter) {
  if (filter === 'all') return posts;
  if (filter === 'photos') return posts.filter((post) => post.postType === 'polaroid' || post.postType === 'media');
  if (filter === 'notes') return posts.filter((post) => post.postType === 'note');
  if (filter === 'songs') return posts.filter((post) => post.postType === 'song' || Boolean(post.song));
  if (filter === 'movies') return posts.filter((post) => post.postType === 'movie');
  return posts.filter((post) => Boolean(post.memoryPromptRequestId || post.promptText || post.promptType));
}

export function getReplyGridExtraHeight(replies: { voice?: unknown }[]) {
  const visibleReplies = replies.slice(-3);
  return 34 + visibleReplies.reduce((height, reply) => height + (reply.voice ? 42 : 28), 0) + (replies.length > visibleReplies.length ? 24 : 0);
}

export function mergeStringSets(left: ReadonlySet<string>, right: ReadonlySet<string> | readonly string[]) {
  return new Set([...left, ...right]);
}

export function addStringsToSet(current: Set<string>, values: readonly string[]) {
  if (values.every((value) => current.has(value))) return current;
  return new Set([...current, ...values]);
}

export function uniqueStrings(values: readonly string[]) {
  return Array.from(new Set(values));
}

export function normalizePrivateNoteLink(value: string | null | undefined) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export type PrivateNoteInlinePart = { type: 'text' | 'link'; text: string };

const PRIVATE_NOTE_INLINE_LINK_REGEX = /((?:https?:\/\/|www\.)[^\s<>()]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>()]*)?)/gi;
const PRIVATE_NOTE_TRAILING_LINK_PUNCTUATION = /[.,!?;:)\]]$/;

export function splitPrivateNoteInlineLinks(value: string): PrivateNoteInlinePart[] {
  const parts: PrivateNoteInlinePart[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(PRIVATE_NOTE_INLINE_LINK_REGEX)) {
    const rawMatch = match[0];
    const matchIndex = match.index ?? 0;
    let linkText = rawMatch;
    let trailingText = '';

    while (linkText && PRIVATE_NOTE_TRAILING_LINK_PUNCTUATION.test(linkText)) {
      trailingText = linkText.slice(-1) + trailingText;
      linkText = linkText.slice(0, -1);
    }

    if (!linkText) continue;
    if (matchIndex > lastIndex) parts.push({ type: 'text', text: value.slice(lastIndex, matchIndex) });
    parts.push({ type: 'link', text: linkText });
    if (trailingText) parts.push({ type: 'text', text: trailingText });
    lastIndex = matchIndex + rawMatch.length;
  }

  if (lastIndex < value.length) parts.push({ type: 'text', text: value.slice(lastIndex) });
  return parts.length > 0 ? parts : [{ type: 'text', text: value }];
}

export function getNextNoteSortOrder(blocks: ContactPrivateNoteBlock[]) {
  return blocks.reduce((max, block) => Math.max(max, block.sortOrder), -1) + 1;
}

export function formatNoteDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Updated just now';
  return `Updated ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}
