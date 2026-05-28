import type { WallPost } from '../../types/domain';
import { getWallPostMemoryDate } from '../../lib/memoryDate';

export type FriendshipRecapRange = 'month' | 'year';

export interface FriendshipRecapGroup {
  key: string;
  label: string;
  posts: WallPost[];
}

export interface FriendshipRecapViewModel {
  title: string;
  subtitle: string;
  memoryCount: number;
  photoCount: number;
  noteCount: number;
  songCount: number;
  featuredPost: WallPost | null;
  groupedPosts: FriendshipRecapGroup[];
}

export function buildFriendshipRecap({
  currentUserId,
  friendName,
  friendUserId,
  posts,
  range,
  cursorDate,
}: {
  currentUserId: string;
  friendName: string;
  friendUserId: string;
  posts: readonly WallPost[];
  range: FriendshipRecapRange;
  cursorDate: Date;
}): FriendshipRecapViewModel {
  const rangePosts = posts
    .filter((post) => isSharedFriendshipPost(post, currentUserId, friendUserId))
    .filter((post) => isPostInRange(post, range, cursorDate))
    .sort((left, right) => getWallPostMemoryDate(right).getTime() - getWallPostMemoryDate(left).getTime() || right.createdAt.localeCompare(left.createdAt));

  const memoryCount = rangePosts.length;
  const label = range === 'month'
    ? cursorDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : String(cursorDate.getFullYear());
  return {
    title: `${range === 'month' ? 'Monthly' : 'Yearly'} recap`,
    subtitle: memoryCount > 0
      ? `You and ${friendName} made ${memoryCount} ${memoryCount === 1 ? 'memory' : 'memories'} in ${label}.`
      : `No memories with ${friendName} in ${label} yet.`,
    memoryCount,
    photoCount: rangePosts.filter((post) => post.postType === 'polaroid' || post.postType === 'media').length,
    noteCount: rangePosts.filter((post) => post.postType === 'note').length,
    songCount: rangePosts.filter((post) => post.postType === 'song').length,
    featuredPost: rangePosts[0] ?? null,
    groupedPosts: groupRecapPosts(rangePosts, range),
  };
}

function isSharedFriendshipPost(post: WallPost, currentUserId: string, friendUserId: string) {
  if (post.visibility !== 'visible_to_subject') return false;
  return (
    post.authorUserId === currentUserId && post.subjectUserId === friendUserId
  ) || (
    post.authorUserId === friendUserId && post.subjectUserId === currentUserId
  );
}

function isPostInRange(post: WallPost, range: FriendshipRecapRange, cursorDate: Date) {
  const date = getWallPostMemoryDate(post);
  if (date.getFullYear() !== cursorDate.getFullYear()) return false;
  if (range === 'month') return date.getMonth() === cursorDate.getMonth();
  return true;
}

function groupRecapPosts(posts: WallPost[], range: FriendshipRecapRange): FriendshipRecapGroup[] {
  const groups: FriendshipRecapGroup[] = [];
  for (const post of posts) {
    const date = getWallPostMemoryDate(post);
    const key = range === 'month'
      ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
      : `${date.getFullYear()}-${date.getMonth()}`;
    const label = range === 'month'
      ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : date.toLocaleDateString('en-US', { month: 'long' });
    let group = groups.find((entry) => entry.key === key);
    if (!group) {
      group = { key, label, posts: [] };
      groups.push(group);
    }
    group.posts.push(post);
  }
  return groups;
}
