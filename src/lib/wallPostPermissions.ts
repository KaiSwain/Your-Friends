import type { WallPost } from '../types/domain';

type PromptResponseFields = Pick<
  WallPost,
  'authorUserId' | 'subjectUserId' | 'memoryPromptRequestId' | 'movie' | 'promptText' | 'promptType' | 'promptVoice'
>;

export function isPromptResponseWallPost(post: PromptResponseFields) {
  return Boolean(
    post.memoryPromptRequestId
      || post.movie?.reviewRequestId
      || post.promptText
      || post.promptType
      || post.promptVoice,
  );
}

export function canEditWallPostContent(post: Pick<WallPost, 'authorUserId'>, userId: string | null | undefined) {
  return Boolean(userId && post.authorUserId === userId);
}

export function canDeleteWallPost(post: PromptResponseFields, userId: string | null | undefined) {
  return canEditWallPostContent(post, userId)
    || Boolean(userId && post.subjectUserId === userId && isPromptResponseWallPost(post));
}
