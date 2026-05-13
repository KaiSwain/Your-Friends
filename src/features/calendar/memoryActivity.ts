import type { WallPost } from '../../types/domain';

export interface CalendarMemoryActivity {
  dateKey: string;
  kind: 'photo' | 'note';
  post: WallPost;
}

export function getLocalDateKey(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function groupMemoryActivityByDay(posts: readonly WallPost[]): Record<string, CalendarMemoryActivity[]> {
  const grouped: Record<string, CalendarMemoryActivity[]> = {};
  for (const post of posts) {
    const dateKey = getLocalDateKey(post.createdAt);
    if (!dateKey) continue;
    const item: CalendarMemoryActivity = {
      dateKey,
      kind: post.imageUri ? 'photo' : 'note',
      post,
    };
    grouped[dateKey] = [...(grouped[dateKey] ?? []), item];
  }

  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => b.post.createdAt.localeCompare(a.post.createdAt));
  }
  return grouped;
}
