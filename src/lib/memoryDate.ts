import type { WallPost } from '../types/domain';

export function getWallPostMemoryDateValue(post: Pick<WallPost, 'createdAt' | 'memoryDate'>): string {
  return post.memoryDate || post.createdAt;
}

export function getWallPostMemoryDate(post: Pick<WallPost, 'createdAt' | 'memoryDate'>): Date {
  return parseMemoryDateValue(getWallPostMemoryDateValue(post));
}

export function compareWallPostsByMemoryDateDesc(left: WallPost, right: WallPost): number {
  const byMemoryDate = getWallPostMemoryDate(right).getTime() - getWallPostMemoryDate(left).getTime();
  if (byMemoryDate !== 0) return byMemoryDate;
  return right.createdAt.localeCompare(left.createdAt);
}

export function groupPostsByMemoryDateDay<T extends Pick<WallPost, 'createdAt' | 'memoryDate'>>(posts: T[]) {
  const groups: { label: string; posts: T[] }[] = [];
  let currentLabel = '';
  for (const post of posts) {
    const date = getWallPostMemoryDate(post);
    const label = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    if (label !== currentLabel) {
      currentLabel = label;
      groups.push({ label, posts: [] });
    }
    groups[groups.length - 1].posts.push(post);
  }
  return groups;
}

export function getLocalDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : parseMemoryDateValue(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseMemoryDateValue(value: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(Number(year), Number(month) - 1, Number(day), 12);
  }
  return new Date(value);
}
