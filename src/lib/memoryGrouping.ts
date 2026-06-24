import type { WallPost } from '../types/domain';
import { getWallPostMemoryDayKey } from './memoryDate';

// Identify the underlying "thing" a memory is about, independent of which wall
// it was posted to. Two wall posts that point at the same uploaded photo (or
// video/voice/song/movie/prompt) are the same memory shared to two walls.
export function getMemoryIdentityKey(post: Pick<WallPost,
  'imageUri' | 'videoUri' | 'voice' | 'song' | 'movie' | 'memoryPromptRequestId' | 'postType' | 'body'>): string {
  if (post.imageUri) return `image:${post.imageUri}`;
  if (post.videoUri) return `video:${post.videoUri}`;
  if (post.voice?.uri) return `voice:${post.voice.uri}`;
  if (post.song) return `song:${post.song.provider}:${post.song.providerTrackId}`;
  if (post.movie) return `movie:${post.movie.reviewRequestId ?? post.movie.tmdbId}`;
  if (post.memoryPromptRequestId) return `prompt:${post.memoryPromptRequestId}`;
  // Plain text/notes have no media to key on, so include the body to avoid
  // collapsing two genuinely different notes written on the same day.
  return `text:${post.postType}:${(post.body ?? '').trim()}`;
}

// Build a key that groups the multiple wall_posts created when a single memory
// is shared to several walls (or when more people are tagged into it later).
// All copies share the same author, the same underlying media/identity, and the
// same memory day, so they collapse into one group.
export function getMemoryGroupKey(post: WallPost): string {
  // Optimistic copies created from one pending memory record already carry a
  // shared id, which is the most reliable grouping signal before they sync.
  if (post.pendingMemoryId) return `pending:${post.pendingMemoryId}`;
  return [post.authorUserId, getWallPostMemoryDayKey(post), getMemoryIdentityKey(post)].join('|');
}

// Collapse posts that belong to the same memory down to a single representative,
// preserving input order. Used by home-screen sections (Developing, On This Day)
// so a memory shared to multiple walls shows up once instead of N times.
export function dedupeMemoriesForDisplay(posts: WallPost[]): WallPost[] {
  const seen = new Set<string>();
  const result: WallPost[] = [];
  for (const post of posts) {
    const key = getMemoryGroupKey(post);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(post);
  }
  return result;
}
