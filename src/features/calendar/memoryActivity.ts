import type { WallPost } from '../../types/domain';
import { getLocalDateKey, getWallPostMemoryDateValue } from '../../lib/memoryDate';

export { getLocalDateKey };

export interface CalendarMemoryActivity {
  dateKey: string;
  kind: 'photo' | 'note';
  post: WallPost;
}

export function groupMemoryActivityByDay(posts: readonly WallPost[]): Record<string, CalendarMemoryActivity[]> {
  const grouped: Record<string, CalendarMemoryActivity[]> = {};
  for (const post of posts) {
    const dateKey = getLocalDateKey(getWallPostMemoryDateValue(post));
    if (!dateKey) continue;
    const item: CalendarMemoryActivity = {
      dateKey,
      kind: post.imageUri ? 'photo' : 'note',
      post,
    };
    grouped[dateKey] = [...(grouped[dateKey] ?? []), item];
  }

  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => getWallPostMemoryDateValue(b.post).localeCompare(getWallPostMemoryDateValue(a.post)) || b.post.createdAt.localeCompare(a.post.createdAt));
  }
  return grouped;
}
