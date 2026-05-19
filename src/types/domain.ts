// Define the allowed kinds of people-like entities the UI can route to and render.
export type EntityType = 'user' | 'contact';
// Define the allowed visibility modes for a wall post.
export type WallPostVisibility = 'private' | 'visible_to_subject';
// Define the supported top-level memory shapes shown on a wall.
export type WallPostType = 'note' | 'polaroid' | 'song' | 'movie';
// Define the supported music providers for song memories and attachments.
export type SongProvider = 'apple' | 'spotify';
// Define the supported font presets for text-only memories.
export type WallPostTextFont = 'handwritten' | 'handwrittenBold' | 'marker' | 'editorial' | 'modern' | 'body' | 'heading';
// Define the numeric size used for text-only memory text.
export type WallPostTextSize = number;
// Define the supported text effects for text-only memories.
export type WallPostTextEffect = 'none' | 'shadow' | 'glow' | 'echo' | 'dreamy';
// Define the supported text color presets for text-only memories.
export type WallPostTextColor = 'ink' | 'accent' | 'terracotta' | 'rose' | 'plum' | 'lavender' | 'sky';

export interface SongAttachment {
  provider: SongProvider;
  providerTrackId: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  previewUrl: string | null;
  externalUrl: string | null;
}

export interface MovieAttachment {
  tmdbId: string;
  title: string;
  year: string | null;
  posterUrl: string | null;
  overview: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
  reviewRating: number | null;
  reviewRequestId?: string | null;
}

// Describe the shape of a real app user after profile data has been loaded.
export interface AppUser {
  // Store the unique user ID, which should match the Supabase auth user ID.
  id: string;
  // Store the user's email address.
  email: string;
  // Store the name shown throughout the UI.
  displayName: string;
  // Store the code other users can enter to add this person as a friend.
  friendCode: string;
  // Store the accent color used for this user's avatar surfaces.
  avatarColor: string;
  // Optionally store a path or URL for a real avatar image.
  avatarPath?: string | null;
  // Store the user's birthday as YYYY-MM-DD so friends can see it on calendars.
  birthday: string | null;
  // Optionally store an uploaded image URL used as the user's own profile background.
  profileBgImagePath?: string | null;
  // Whether the user's Settings background is allowed to appear on their public profile.
  profileBgImagePublic: boolean;
  // Store short profile facts displayed on the profile screen.
  profileFacts: string[];
  // Store the ISO timestamp for when this profile was created.
  createdAt: string;
  // Optionally store when Premium access expires, including referral rewards.
  premiumUntil?: string | null;
} // End the AppUser interface.

// Describe the shape of a private contact saved by a signed-in user.
export interface Contact {
  // Store the unique ID for the contact row.
  id: string;
  // Store the user ID of the owner who created this private contact.
  ownerUserId: string;
  // Optionally point to a real user profile if this contact is linked later.
  linkedUserId: string | null;
  // Store the main display name shown in the app.
  displayName: string;
  // Optionally store a nickname or personal label for the contact.
  nickname: string | null;
  // Store facts the owner wants to remember about this contact.
  facts: string[];
  // Optionally store a path or URL for the contact's avatar image.
  avatarPath?: string | null;
  // Optionally store a path or URL for the contact hero card video.
  avatarVideoPath?: string | null;
  // Store whether the contact hero video should always play without audio.
  avatarVideoMuted?: boolean;
  // Store relationship tags for this contact (e.g. "Best Friend", "Family").
  tags: string[];
  // Optionally store a short note or description about this contact.
  note: string | null;
  // Optionally store a card background color for this contact.
  cardColor: string | null;
  // Optionally store text written on the back of the profile card.
  backText: string | null;
  // Optionally store a profile background theme key.
  profileBg: string | null;
  // Optionally store an uploaded image URL used as the profile background.
  profileBgImagePath: string | null;
  // Whether this contact is pinned to the front of the carousel.
  pinned: boolean;
  // Store when this contact was pinned so pinned contacts keep insertion order.
  pinnedAt: string | null;
  // Store the ISO timestamp for when the contact was created.
  createdAt: string;
} // End the Contact interface.

// Describe the shape of a friendship between two real users.
export interface Friendship {
  // Store the unique ID for the friendship record.
  id: string;
  // Store the lower-sorting user ID so friendships stay in a canonical order.
  userLowId: string;
  // Store the higher-sorting user ID so the pair stays unique.
  userHighId: string;
  // Store the user ID of the person who created the friendship.
  createdByUserId: string;
  // Store the ISO timestamp for when the friendship was created.
  createdAt: string;
} // End the Friendship interface.

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined';

// Describe a pending/handled request before a real friendship row exists.
export interface FriendRequest {
  id: string;
  requesterUserId: string;
  recipientUserId: string;
  status: FriendRequestStatus;
  createdAt: string;
  respondedAt: string | null;
} // End the FriendRequest interface.

// Describe the shape of a unified list item used by the carousel and people lists.
export interface PeopleListItem {
  // Store the unique ID of the underlying user or contact.
  id: string;
  // Store whether this item points to a real user or a private contact.
  entityType: EntityType;
  // Store the creation timestamp used for sorting the mixed people list.
  createdAt: string;
  // Store the primary label shown as the item title.
  title: string;
  // Store the supporting text shown below the title.
  subtitle: string;
  // Store a short category label used by the UI.
  caption: string;
  // Store the accent color used for this person's avatar block.
  avatarColor: string;
  // Optionally store an image URI for this person's avatar.
  imageUri?: string | null;
  // Optionally store a hero card video URI for this person.
  avatarVideoPath?: string | null;
  // Store whether the hero card video should always play without audio.
  avatarVideoMuted?: boolean;
  // Store relationship tags shown on the card.
  tags: string[];
  // Optionally store a short note about this person.
  note?: string | null;
  // Optionally store a card background color.
  cardColor?: string | null;
  // Optionally include a linked real user ID when the list item represents a linked contact.
  linkedUserId?: string | null;
  // Optionally include a likely friend account match that still needs explicit linking.
  suggestedLinkedUserId?: string | null;
  // Whether this item is pinned to the front.
  pinned?: boolean;
  // Store when this item was pinned so pinned items sort oldest pin first.
  pinnedAt?: string | null;
  // Whether the underlying user has an active Premium subscription. Used to
  // paint the golden glow + PREMIUM badge on the polaroid card. Always
  // undefined for private contacts.
  isPremium?: boolean;
} // End the PeopleListItem interface.

// Describe the minimum data needed to create a user-like record in app logic.
export interface CreateUserInput {
  // Store the display name the new user should have.
  displayName: string;
  // Store the email address for the new user.
  email: string;
} // End the CreateUserInput interface.

// Describe the shape of a memory entry shown on a profile wall.
export interface WallPost {
  // Store the unique ID for the wall post.
  id: string;
  // Store the ID of the user who wrote the memory.
  authorUserId: string;
  // Optionally store the target user ID when the memory is about a real user.
  subjectUserId: string | null;
  // Optionally store the target contact ID when the memory is about a private contact.
  subjectContactId: string | null;
  // Store who is allowed to see this memory.
  visibility: WallPostVisibility;
  // Store which wall presentation this memory uses.
  postType: WallPostType;
  // Store the main text body of the memory.
  body: string;
  // Optionally store the image URL or path attached to the memory.
  imageUri: string | null;
  // Optionally store the video URL or path for a Live Polaroid.
  videoUri?: string | null;
  // Store whether this Live Polaroid should always play without audio.
  videoMuted?: boolean;
  // Optionally store a custom card color for the polaroid frame.
  cardColor: string | null;
  // Optionally store text written on the back of the polaroid.
  backText: string | null;
  // Optionally store a photo filter key.
  filter: string | null;
  // Optionally store a text font preset for text-only memories.
  textFont?: WallPostTextFont | null;
  // Optionally store a text size preset for text-only memories.
  textSize?: WallPostTextSize | null;
  // Optionally store a text effect preset for text-only memories.
  textEffect?: WallPostTextEffect | null;
  // Optionally store a text color preset for text-only memories.
  textColor?: WallPostTextColor | null;
  // Optionally store whether the date stamp overlay is shown.
  dateStamp: boolean;
  // Optionally store a song used by standalone song memories or attachments.
  song: SongAttachment | null;
  // Optionally store a movie reviewed for a friend request.
  movie?: MovieAttachment | null;
  // Optionally link this memory back to the prompt that produced it.
  memoryPromptRequestId?: string | null;
  // Optionally reference an existing polaroid chosen while answering a prompt.
  referencedWallPostId?: string | null;
  // Optionally store the original prompt text for completed prompt responses.
  promptText?: string | null;
  // Optionally store the original prompt type for completed prompt responses.
  promptType?: MemoryPromptType | null;
  // Optionally store when the memory happened, separate from when it was posted.
  memoryDate?: string | null;
  // Store the ISO timestamp for when the memory was created.
  createdAt: string;
  // UI-only local-first sync state for memories saved before the server write finishes.
  syncStatus?: 'saving' | 'waiting' | 'failed' | 'synced';
  // Optional sync error shown on pending memories.
  syncError?: string | null;
  // Pending-memory queue ID used to retry or replace local optimistic posts.
  pendingMemoryId?: string | null;
} // End the WallPost interface.

// Describe an existing memory that a user chose to feature on their own profile wall.
export interface ProfileWallItem {
  id: string;
  ownerUserId: string;
  wallPostId: string;
  repliesHidden: boolean;
  createdAt: string;
}

export interface MemoryReply {
  id: string;
  wallPostId: string;
  authorUserId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export type WallPostLayoutContext = 'contact_profile' | 'shared_wall' | 'my_profile' | 'user_profile';

export interface WallPostLayout {
  id: string;
  ownerUserId: string;
  wallContext: WallPostLayoutContext;
  wallContextId: string;
  wallPostId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface SaveWallPostLayoutInput {
  ownerUserId: string;
  wallContext: WallPostLayoutContext;
  wallContextId: string;
  wallPostId: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  zIndex: number;
}

// Describe the payload needed when creating a new wall post.
export interface CreateWallPostInput {
  // Store the user target when the post is about a real user.
  subjectUserId: string | null;
  // Store the contact target when the post is about a private contact.
  subjectContactId: string | null;
  // Store the selected visibility for the new post.
  visibility: WallPostVisibility;
  // Optionally store which wall presentation this memory uses.
  postType?: WallPostType;
  // Store the text body for the new post.
  body: string;
  // Optionally store the uploaded image URL or path for the new post.
  imageUri: string | null;
  // Optionally store the uploaded video URL or path for Live Polaroids.
  videoUri?: string | null;
  // Optionally store whether the Live Polaroid should always play without audio.
  videoMuted?: boolean;
  // Optionally store a card color for the new post.
  cardColor?: string | null;
  // Optionally store text written on the back of the polaroid.
  backText?: string | null;
  // Optionally store a photo filter key for the new post.
  filter?: string | null;
  // Optionally store a text font preset for text-only memories.
  textFont?: WallPostTextFont | null;
  // Optionally store a text size preset for text-only memories.
  textSize?: WallPostTextSize | null;
  // Optionally store a text effect preset for text-only memories.
  textEffect?: WallPostTextEffect | null;
  // Optionally store a text color preset for text-only memories.
  textColor?: WallPostTextColor | null;
  // Optionally store whether the date stamp overlay should be shown.
  dateStamp?: boolean;
  // Optionally store a song used by standalone song memories or attachments.
  song?: SongAttachment | null;
  // Optionally store movie review metadata for movie memories.
  movie?: MovieAttachment | null;
  // Optionally link this memory back to the prompt that produced it.
  memoryPromptRequestId?: string | null;
  // Optionally reference an existing polaroid chosen while answering a prompt.
  referencedWallPostId?: string | null;
  // Optionally store the original prompt text for completed prompt responses.
  promptText?: string | null;
  // Optionally store the original prompt type for completed prompt responses.
  promptType?: MemoryPromptType | null;
  // Optionally store when the memory happened, separate from when it was posted.
  memoryDate?: string | null;
} // End the CreateWallPostInput interface.

export type MovieReviewRequestStatus = 'pending' | 'completed' | 'cancelled';
export type MemoryPromptType = 'song' | 'text' | 'photo_reference';
export type MemoryPromptRequestStatus = 'pending' | 'completed' | 'cancelled';

export interface MovieReviewRequest {
  id: string;
  requesterUserId: string;
  recipientUserId: string;
  movie: MovieAttachment;
  prompt: string | null;
  status: MovieReviewRequestStatus;
  reviewRating: number | null;
  reviewBody: string | null;
  completedWallPostId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface CreateMovieReviewRequestInput {
  recipientUserId: string;
  movie: MovieAttachment;
  prompt?: string | null;
}

export interface CompleteMovieReviewRequestInput {
  requestId: string;
  rating: number;
  body: string;
}

export interface MemoryPromptRequest {
  id: string;
  requesterUserId: string;
  recipientUserId: string;
  promptType: MemoryPromptType;
  promptText: string;
  status: MemoryPromptRequestStatus;
  responseBody: string | null;
  responseSong: SongAttachment | null;
  referencedWallPostId: string | null;
  completedWallPostId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface CreateMemoryPromptRequestInput {
  recipientUserId: string;
  promptType: MemoryPromptType;
  promptText: string;
}

export interface CompleteMemoryPromptRequestInput {
  requestId: string;
  body?: string | null;
  song?: SongAttachment | null;
  referencedWallPostId?: string | null;
}

// Describe the payload needed when creating a new private contact.
export interface CreateContactInput {
  displayName: string;
  nickname?: string;
}

export type ContactPrivateNoteBlockType = 'text' | 'link' | 'image';

export interface ContactPrivateNote {
  id: string;
  ownerUserId: string;
  contactId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactPrivateNoteBlock {
  id: string;
  noteId: string;
  ownerUserId: string;
  type: ContactPrivateNoteBlockType;
  content: string | null;
  url: string | null;
  imagePath: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactPrivateNoteInput {
  title?: string;
}

export interface UpdateContactPrivateNoteInput {
  title?: string;
}

export interface CreateContactPrivateNoteBlockInput {
  type: ContactPrivateNoteBlockType;
  content?: string | null;
  url?: string | null;
  imagePath?: string | null;
  sortOrder?: number;
}

export interface UpdateContactPrivateNoteBlockInput {
  content?: string | null;
  url?: string | null;
  imagePath?: string | null;
  sortOrder?: number;
}

export type CalendarEventType = 'reminder' | 'birthday' | 'anniversary' | 'custom';
export type CalendarRecurrence = 'none' | 'yearly' | 'monthly';
export type CalendarReminderOffset = 0 | 1 | 7;

export interface CalendarEvent {
  id: string;
  ownerUserId: string;
  subjectUserId: string | null;
  subjectContactId: string | null;
  type: CalendarEventType;
  title: string;
  eventDate: string;
  eventTime: string | null;
  allDay: boolean;
  recurrence: CalendarRecurrence;
  reminderOffsets: CalendarReminderOffset[];
  completedOccurrenceKeys: string[];
  note: string | null;
  createdAt: string;
  updatedAt: string;
  shareId?: string | null;
  sharedByUserId?: string | null;
  sharedWithUserId?: string | null;
  sharedRemindersEnabled?: boolean;
}

export interface CalendarEventShare {
  id: string;
  eventId: string;
  ownerUserId: string;
  recipientUserId: string;
  remindersEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CalendarEventReactionValue = 'up' | 'down';

export interface CalendarEventReaction {
  id: string;
  eventId: string;
  userId: string;
  notificationId: string | null;
  value: CalendarEventReactionValue;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarEventReactionSummary {
  eventId: string;
  upCount: number;
  downCount: number;
  myReaction: CalendarEventReactionValue | null;
}

export interface CalendarEventInput {
  subjectUserId?: string | null;
  subjectContactId?: string | null;
  type: CalendarEventType;
  title: string;
  eventDate: string;
  eventTime?: string | null;
  allDay?: boolean;
  recurrence?: CalendarRecurrence;
  reminderOffsets?: CalendarReminderOffset[];
  completedOccurrenceKeys?: string[];
  note?: string | null;
}

export interface UpdateCalendarEventInput {
  subjectUserId?: string | null;
  subjectContactId?: string | null;
  type?: CalendarEventType;
  title?: string;
  eventDate?: string;
  eventTime?: string | null;
  allDay?: boolean;
  recurrence?: CalendarRecurrence;
  reminderOffsets?: CalendarReminderOffset[];
  completedOccurrenceKeys?: string[];
  note?: string | null;
}

export interface FriendFact {
  id: string;
  authorUserId: string;
  subjectUserId: string;
  body: string;
  createdAt: string;
}

export interface CreateFriendFactInput {
  subjectUserId: string;
  body: string;
}

export type GiftNoteStatus = 'locked' | 'revealed' | 'cancelled';

export interface GiftNote {
  id: string;
  authorUserId: string;
  recipientUserId: string;
  subjectContactId: string | null;
  unlockDate: string;
  unlockTime: string;
  title: string;
  status: GiftNoteStatus;
  revealedWallPostId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGiftNoteInput {
  recipientUserId: string;
  subjectContactId?: string | null;
  unlockDate: string;
  unlockTime?: string;
  title?: string;
  body: string;
}

export type NotificationType = 'wall_post' | 'friend_request' | 'contact_update' | 'calendar_event' | 'calendar_event_reaction' | 'movie_review_request' | 'memory_prompt_request' | 'memory_reply' | 'local';

export type NotificationMetadata = Record<string, unknown> & {
  /** friend_request: `requested` | `accepted` */
  action?: string;
  birthdayUserId?: string;
  contactId?: string;
  date?: string;
  eventId?: string;
  eventTitle?: string;
  friendRequestId?: string;
  giftNoteId?: string;
  memoryReplyId?: string;
  memoryPromptRequestId?: string;
  movieReviewRequestId?: string;
  notificationId?: string;
  ownerUserId?: string;
  postType?: string;
  reactionValue?: CalendarEventReactionValue;
  shareId?: string;
  /** Provenance: table or feature (e.g. `friend_requests`, `calendar_event_shares`, `throwback`). */
  source?: string;
  throwbackBucket?: 'month' | 'year';
  wallPostId?: string;
};

export interface Notification {
  id: string;
  recipientUserId: string;
  actorUserId: string;
  type: NotificationType;
  referenceId: string | null;
  message: string;
  metadata: NotificationMetadata;
  read: boolean;
  createdAt: string;
}