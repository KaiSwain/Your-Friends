import {
  AppUser,
  CalendarEventReaction,
  CalendarEventReactionValue,
  Contact,
  ContactPrivateNote,
  ContactPrivateNoteBlock,
  FriendFact,
  FriendRequest,
  Friendship,
  MemoryReply,
  MovieAttachment,
  Notification,
  NotificationMetadata,
  ProfileWallItem,
  SongAttachment,
  WallPost,
  WallPostLayout,
  WallPostLayoutContext,
  MemoryPromptType,
  WallPostType,
} from '../../types/domain';
import { splitWallPostPresentation } from '../../lib/wallPostTextStyle';

export function rowToUser(row: any): AppUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    friendCode: row.friend_code,
    avatarColor: row.avatar_color,
    avatarPath: row.avatar_path ?? null,
    birthday: row.birthday ?? null,
    profileBgImagePath: row.profile_bg_image_path ?? null,
    profileBgImagePublic: row.profile_bg_image_public ?? false,
    profileFacts: row.profile_facts ?? [],
    createdAt: row.created_at,
    premiumUntil: row.premium_until ?? null,
  };
}

export function rowToContact(row: any): Contact {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    linkedUserId: row.linked_user_id ?? null,
    displayName: row.display_name,
    nickname: row.nickname ?? null,
    facts: row.facts ?? [],
    avatarPath: row.avatar_path ?? null,
    avatarVideoPath: row.avatar_video_path ?? null,
    avatarVideoMuted: row.avatar_video_muted ?? false,
    tags: row.tags ?? [],
    note: row.note ?? null,
    cardColor: row.card_color ?? null,
    backText: row.back_text ?? null,
    profileBg: row.profile_bg ?? null,
    profileBgImagePath: row.profile_bg_image_path ?? null,
    pinned: row.pinned ?? false,
    pinnedAt: row.pinned_at ?? null,
    createdAt: row.created_at,
  };
}

export function rowToFriendship(row: any): Friendship {
  return {
    id: row.id,
    userLowId: row.user_low_id,
    userHighId: row.user_high_id,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
  };
}

export function rowToFriendRequest(row: any): FriendRequest {
  return {
    id: row.id,
    requesterUserId: row.requester_user_id,
    recipientUserId: row.recipient_user_id,
    status: row.status,
    createdAt: row.created_at,
    respondedAt: row.responded_at ?? null,
  };
}

export function rowToWallPost(row: any): WallPost {
  const presentation = splitWallPostPresentation(row.filter, row.text_font, row.text_size, row.text_effect, row.text_color);
  const song = rowToSongAttachment(row);
  const movie = rowToMovieAttachment(row);
  const postType = resolveWallPostType(row.post_type, row.image_path, song, movie);
  return {
    id: row.id,
    authorUserId: row.author_user_id,
    subjectUserId: row.subject_user_id ?? null,
    subjectContactId: row.subject_contact_id ?? null,
    visibility: row.visibility,
    postType,
    body: row.body,
    imageUri: row.image_path ?? null,
    videoUri: row.video_path ?? null,
    videoMuted: row.video_muted ?? false,
    cardColor: row.card_color ?? null,
    backText: row.back_text ?? null,
    filter: presentation.filter,
    textFont: presentation.textFont,
    textSize: presentation.textSize,
    textEffect: presentation.textEffect,
    textColor: presentation.textColor,
    dateStamp: row.date_stamp ?? false,
    song,
    movie,
    memoryPromptRequestId: row.memory_prompt_request_id ?? null,
    referencedWallPostId: row.referenced_wall_post_id ?? null,
    promptText: row.prompt_text ?? null,
    promptType: normalizeMemoryPromptType(row.prompt_type),
    memoryDate: row.memory_date ?? null,
    createdAt: row.created_at,
  };
}

export function rowToProfileWallItem(row: any): ProfileWallItem {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    wallPostId: row.wall_post_id,
    repliesHidden: row.replies_hidden ?? false,
    createdAt: row.created_at,
  };
}

export function rowToMemoryReply(row: any): MemoryReply {
  return {
    id: row.id,
    wallPostId: row.wall_post_id,
    authorUserId: row.author_user_id,
    body: row.body ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

export function rowToWallPostLayout(row: any): WallPostLayout {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    wallContext: normalizeWallPostLayoutContext(row.wall_context),
    wallContextId: row.wall_context_id,
    wallPostId: row.wall_post_id,
    x: Number(row.x ?? 0),
    y: Number(row.y ?? 0),
    scale: Number(row.scale ?? 1),
    rotation: Number(row.rotation ?? 0),
    zIndex: Number(row.z_index ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

function normalizeWallPostLayoutContext(value: unknown): WallPostLayoutContext {
  if (value === 'shared_wall' || value === 'my_profile' || value === 'user_profile') return value;
  return 'contact_profile';
}

function resolveWallPostType(rawType: unknown, imagePath: unknown, song: SongAttachment | null, movie: MovieAttachment | null): WallPostType {
  if (rawType === 'movie') return movie ? 'movie' : 'note';
  if (rawType === 'song') return song ? 'song' : imagePath ? 'polaroid' : 'note';
  if (rawType === 'note' || rawType === 'polaroid') return rawType;
  if (imagePath) return 'polaroid';
  if (song) return 'song';
  if (movie) return 'movie';
  return 'note';
}

export function rowToSongAttachment(row: any): SongAttachment | null {
  const provider = row.song_provider;
  const providerTrackId = row.song_provider_id;
  const title = row.song_title;
  const artist = row.song_artist;
  if ((provider !== 'apple' && provider !== 'spotify') || !providerTrackId || !title || !artist) {
    return null;
  }
  return {
    provider,
    providerTrackId: String(providerTrackId),
    title: String(title),
    artist: String(artist),
    artworkUrl: row.song_artwork_url ?? null,
    previewUrl: row.song_preview_url ?? null,
    externalUrl: row.song_external_url ?? null,
  };
}

function normalizeMemoryPromptType(value: unknown): MemoryPromptType | null {
  if (value === 'song' || value === 'text' || value === 'photo_reference') return value;
  return null;
}

export function rowToMovieAttachment(row: any): MovieAttachment | null {
  const tmdbId = row.movie_tmdb_id;
  const title = row.movie_title;
  if (!tmdbId || !title) return null;
  return {
    tmdbId: String(tmdbId),
    title: String(title),
    year: row.movie_year ? String(row.movie_year) : null,
    posterUrl: row.movie_poster_url ?? null,
    overview: row.movie_overview ?? null,
    releaseDate: row.movie_release_date ?? null,
    voteAverage: typeof row.movie_vote_average === 'number'
      ? row.movie_vote_average
      : row.movie_vote_average == null
        ? null
        : Number(row.movie_vote_average),
    reviewRating: typeof row.movie_review_rating === 'number'
      ? row.movie_review_rating
      : row.movie_review_rating == null
        ? null
        : Number(row.movie_review_rating),
    reviewRequestId: row.movie_review_request_id ?? null,
  };
}

export function rowToFriendFact(row: any): FriendFact {
  return {
    id: row.id,
    authorUserId: row.author_user_id,
    subjectUserId: row.subject_user_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

export function rowToNotification(row: any): Notification {
  return {
    id: row.id,
    recipientUserId: row.recipient_user_id,
    actorUserId: row.actor_user_id,
    type: row.type,
    referenceId: row.reference_id ?? null,
    message: row.message,
    metadata: normalizeNotificationMetadata(row.metadata),
    read: row.read,
    createdAt: row.created_at,
  };
}

export function rowToCalendarEventReaction(row: any): CalendarEventReaction {
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    notificationId: row.notification_id ?? null,
    value: normalizeReactionValue(row.value),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

function normalizeNotificationMetadata(value: unknown): NotificationMetadata {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as NotificationMetadata : {};
}

function normalizeReactionValue(value: unknown): CalendarEventReactionValue {
  return value === 'down' ? 'down' : 'up';
}

export function rowToContactPrivateNote(row: any): ContactPrivateNote {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    contactId: row.contact_id,
    title: row.title ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}

export function rowToContactPrivateNoteBlock(row: any): ContactPrivateNoteBlock {
  return {
    id: row.id,
    noteId: row.note_id,
    ownerUserId: row.owner_user_id,
    type: row.type,
    content: row.content ?? null,
    url: row.url ?? null,
    imagePath: row.image_path ?? null,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
  };
}
