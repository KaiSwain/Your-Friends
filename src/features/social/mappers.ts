import {
  AppUser,
  Contact,
  FriendFact,
  Friendship,
  Notification,
  WallPost,
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
    profileFacts: row.profile_facts ?? [],
    createdAt: row.created_at,
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
    tags: row.tags ?? [],
    note: row.note ?? null,
    cardColor: row.card_color ?? null,
    backText: row.back_text ?? null,
    profileBg: row.profile_bg ?? null,
    pinned: row.pinned ?? false,
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

export function rowToWallPost(row: any): WallPost {
  const presentation = splitWallPostPresentation(row.filter, row.text_font, row.text_size, row.text_effect, row.text_color);
  return {
    id: row.id,
    authorUserId: row.author_user_id,
    subjectUserId: row.subject_user_id ?? null,
    subjectContactId: row.subject_contact_id ?? null,
    visibility: row.visibility,
    body: row.body,
    imageUri: row.image_path ?? null,
    cardColor: row.card_color ?? null,
    backText: row.back_text ?? null,
    filter: presentation.filter,
    textFont: presentation.textFont,
    textSize: presentation.textSize,
    textEffect: presentation.textEffect,
    textColor: presentation.textColor,
    dateStamp: row.date_stamp ?? false,
    createdAt: row.created_at,
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
    read: row.read,
    createdAt: row.created_at,
  };
}
