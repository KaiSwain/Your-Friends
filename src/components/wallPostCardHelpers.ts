import type { ColorTokens } from '../features/theme/themes';
import { semanticColors } from '../theme/tokens';
import { WallPost } from '../types/domain';

export function getMemoryEditBorderColor(post: WallPost, colors: ColorTokens) {
  if (post.postType === 'voice' || post.voice) return semanticColors.voiceRed;
  if (post.postType === 'movie' || post.movie) return semanticColors.movieGold;
  if (post.postType === 'media') return colors.accentTertiary ?? '#3A8C8C';
  if (post.postType === 'polaroid' || post.imageUri) return colors.accentAlt ?? colors.accent;
  return semanticColors.replyPurple;
}

export function formatStars(rating: number | null | undefined) {
  const clamped = Math.max(0, Math.min(5, Math.round((rating ?? 0) * 2) / 2));
  return `${clamped}/5`;
}

export function getStarIcon(rating: number, starValue: number) {
  if (rating >= starValue) return 'star' as const;
  if (rating >= starValue - 0.5) return 'star-half-outline' as const;
  return 'star-outline' as const;
}

export function getResponseTypeLabel(post: WallPost) {
  const parts: string[] = [];
  if (post.song) parts.push('song');
  if (post.movie) parts.push('movie');
  if (post.postType === 'media' && post.videoUri && !post.imageUri) parts.push('video');
  else if (post.imageUri || post.referencedWallPostId) parts.push('photo');
  if (post.body?.trim() && !post.song && !post.movie && !post.imageUri && !post.referencedWallPostId) parts.push('note');
  if (post.voice) parts.push('voice');
  if (parts.length === 0 && post.promptType === 'location' && post.locationName?.trim()) parts.push('a location');
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} + ${parts[parts.length - 1]}`;
}

export function getStablePolaroidTilt(id: string) {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return (hash / 0xffffffff - 0.5) * 5;
}
