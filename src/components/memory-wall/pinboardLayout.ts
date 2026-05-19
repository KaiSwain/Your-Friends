import type { WallPost } from '../../types/domain';
import { spacing } from '../../theme/tokens';

export interface PinboardCardMetrics {
  realHeight: number;
  realWidth: number;
  rotation: number;
  scale: number;
  visualHeight: number;
  visualWidth: number;
}

export interface PinboardPosition {
  scale: number;
  x: number;
  y: number;
  zIndex: number;
}

export interface PinboardFallbackResult {
  boardHeight: number;
  layouts: Map<string, PinboardPosition>;
}

export const PINBOARD_TOP_PADDING = 112;
export const PINBOARD_SIDE_PADDING = 34;
export const PINBOARD_BOTTOM_PADDING = 130;

const PINBOARD_COLUMN_GAP = spacing.xl;
const PINBOARD_ROW_GAP = 54;
const POLAROID_REAL_WIDTH = 260;
const ATTACHED_SONG_REAL_WIDTH = 360;

const PIN_COLORS = ['#D66A5C', '#E6B450', '#8DAF8F', '#8AA4C4'];

export function getPinboardCardMetrics(post: WallPost): PinboardCardMetrics {
  const realWidth = getRealCardWidth(post);
  const realHeight = getRealCardHeight(post);
  const scale = getPinboardScale(post);
  const rotation = getAutomaticRotation(post.id);

  return {
    realHeight,
    realWidth,
    rotation,
    scale,
    visualHeight: realHeight * scale,
    visualWidth: realWidth * scale,
  };
}

export function buildPinboardFallbackLayouts(posts: WallPost[], boardWidth: number): PinboardFallbackResult {
  const layouts = new Map<string, PinboardPosition>();
  const columnCount = getPinboardColumnCount(boardWidth);
  const availableWidth = boardWidth - PINBOARD_SIDE_PADDING * 2 - PINBOARD_COLUMN_GAP * (columnCount - 1);
  const columnWidth = availableWidth / columnCount;
  const columnHeights = Array.from({ length: columnCount }, () => PINBOARD_TOP_PADDING);

  posts.forEach((post, index) => {
    const metrics = getPinboardCardMetrics(post);
    const targetColumn = getShortestColumnIndex(columnHeights);
    const seed = hashString(post.id);
    const jitterLimit = Math.max(0, Math.min(14, (columnWidth - metrics.visualWidth) / 3));
    const xJitter = ((seed % 100) / 100 - 0.5) * jitterLimit;
    const yJitter = (seed % 4) * 5;
    const x = PINBOARD_SIDE_PADDING + targetColumn * (columnWidth + PINBOARD_COLUMN_GAP) + Math.max(0, (columnWidth - metrics.visualWidth) / 2) + xJitter;
    const y = columnHeights[targetColumn] + yJitter;

    layouts.set(post.id, {
      scale: metrics.scale,
      x: Math.round(Math.max(PINBOARD_SIDE_PADDING / 2, x)),
      y: Math.round(y),
      zIndex: index + 1,
    });
    columnHeights[targetColumn] = y + metrics.visualHeight + PINBOARD_ROW_GAP;
  });

  return {
    boardHeight: Math.max(520, Math.ceil(Math.max(...columnHeights) + PINBOARD_BOTTOM_PADDING)),
    layouts,
  };
}

export function getPinColor(postId: string) {
  return PIN_COLORS[hashString(postId) % PIN_COLORS.length];
}

export function getRealCardHeight(post: WallPost) {
  if (post.song && post.postType !== 'song') return 780;
  if (post.postType === 'song') return 530;
  if (post.postType === 'note') return 220;
  return 440;
}

export function getRealCardWidth(post: WallPost) {
  if (post.song && post.postType !== 'song') return ATTACHED_SONG_REAL_WIDTH;
  return POLAROID_REAL_WIDTH;
}

export function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getPinboardScale(post: WallPost) {
  if (post.song && post.postType !== 'song') return 0.54;
  if (post.postType === 'song') return 0.6;
  if (post.postType === 'note') return 0.78;
  return 0.64;
}

function getAutomaticRotation(postId: string) {
  const seed = hashString(postId);
  return ((seed % 9) - 4) * 0.45;
}

function getPinboardColumnCount(boardWidth: number) {
  if (boardWidth >= 930) return 4;
  if (boardWidth >= 700) return 3;
  return 2;
}

function getShortestColumnIndex(columnHeights: number[]) {
  return columnHeights.reduce((shortestIndex, height, index) => (height < columnHeights[shortestIndex] ? index : shortestIndex), 0);
}
