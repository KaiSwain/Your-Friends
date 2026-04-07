// Define the allowed kinds of people-like entities the UI can route to and render.
export type EntityType = 'user' | 'contact';
// Define the allowed visibility modes for a wall post.
export type WallPostVisibility = 'private' | 'visible_to_subject';

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
  // Store short profile facts displayed on the profile screen.
  profileFacts: string[];
  // Store the ISO timestamp for when this profile was created.
  createdAt: string;
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
  // Store relationship tags for this contact (e.g. "Best Friend", "Family").
  tags: string[];
  // Optionally store a short note or description about this contact.
  note: string | null;
  // Optionally store a card background color for this contact.
  cardColor: string | null;
  // Optionally store a profile background theme key.
  profileBg: string | null;
  // Whether this contact is pinned to the front of the carousel.
  pinned: boolean;
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
  // Store relationship tags shown on the card.
  tags: string[];
  // Optionally store a short note about this person.
  note?: string | null;
  // Optionally store a card background color.
  cardColor?: string | null;
  // Optionally include a linked real user ID when the list item represents a linked contact.
  linkedUserId?: string | null;
  // Whether this item is pinned to the front.
  pinned?: boolean;
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
  // Store the main text body of the memory.
  body: string;
  // Optionally store the image URL or path attached to the memory.
  imageUri: string | null;
  // Optionally store a custom card color for the polaroid frame.
  cardColor: string | null;
  // Store the ISO timestamp for when the memory was created.
  createdAt: string;
} // End the WallPost interface.

// Describe the payload needed when creating a new wall post.
export interface CreateWallPostInput {
  // Store the user target when the post is about a real user.
  subjectUserId: string | null;
  // Store the contact target when the post is about a private contact.
  subjectContactId: string | null;
  // Store the selected visibility for the new post.
  visibility: WallPostVisibility;
  // Store the text body for the new post.
  body: string;
  // Optionally store the uploaded image URL or path for the new post.
  imageUri: string | null;
  // Optionally store a card color for the new post.
  cardColor?: string | null;
} // End the CreateWallPostInput interface.

// Describe the payload needed when creating a new private contact.
export interface CreateContactInput {
  displayName: string;
  nickname?: string;
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

export type NotificationType = 'wall_post' | 'friend_request' | 'contact_update';

export interface Notification {
  id: string;
  recipientUserId: string;
  actorUserId: string;
  type: NotificationType;
  referenceId: string | null;
  message: string;
  read: boolean;
  createdAt: string;
}