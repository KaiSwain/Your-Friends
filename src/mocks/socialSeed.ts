// Import the domain types used to type-check the in-memory seed data.
import { Contact, Friendship, AppUser, WallPost } from '../types/domain';

// Export the initial list of example users used by local seed mode.
export const seedUsers: AppUser[] = [
  // Define Avery, the primary example user.
  {
    // Store Avery's stable seed ID.
    id: 'user_avery',
    // Store Avery's example email address.
    email: 'avery@yourfriends.app',
    // Store Avery's display name.
    displayName: 'Avery Hart',
    // Store Avery's example friend code.
    friendCode: 'AVR6K2PM',
    // Store Avery's avatar accent color.
    avatarColor: '#CC8B74',
    // Store example facts that appear on Avery's profile.
    profileFacts: ['Keeps birthday notes in a paper journal.', 'Collects tiny cafe receipts while traveling.'],
    // Store Avery's profile creation timestamp.
    createdAt: '2026-03-01T09:00:00.000Z',
  },
  // Define Noah, one of Avery's connected friends.
  {
    // Store Noah's stable seed ID.
    id: 'user_noah',
    // Store Noah's example email address.
    email: 'noah@yourfriends.app',
    // Store Noah's display name.
    displayName: 'Noah Bell',
    // Store Noah's example friend code.
    friendCode: 'NBL4R7QS',
    // Store Noah's avatar accent color.
    avatarColor: '#9AB7C9',
    // Store example facts that appear on Noah's profile.
    profileFacts: ['Remembers everyone’s coffee order.', 'Calls after hard weeks instead of texting.'],
    // Store Noah's profile creation timestamp.
    createdAt: '2026-02-18T18:20:00.000Z',
  },
  // Define Mina, another connected friend in the seed graph.
  {
    // Store Mina's stable seed ID.
    id: 'user_mina',
    // Store Mina's example email address.
    email: 'mina@yourfriends.app',
    // Store Mina's display name.
    displayName: 'Mina Sol',
    // Store Mina's example friend code.
    friendCode: 'MNS8T3LK',
    // Store Mina's avatar accent color.
    avatarColor: '#AEBFAD',
    // Store example facts that appear on Mina's profile.
    profileFacts: ['Sends voice notes from Sunday walks.', 'Finds vintage photo booths in every city.'],
    // Store Mina's profile creation timestamp.
    createdAt: '2026-02-28T14:40:00.000Z',
  },
  // Define Lina, who exists as both a real user and a linked contact.
  {
    // Store Lina's stable seed ID.
    id: 'user_lina',
    // Store Lina's example email address.
    email: 'lina@yourfriends.app',
    // Store Lina's display name.
    displayName: 'Lina Park',
    // Store Lina's example friend code.
    friendCode: 'LNP7H5WX',
    // Store Lina's avatar accent color.
    avatarColor: '#8A6D7D',
    // Store example facts that appear on Lina's profile.
    profileFacts: ['Leaves annotated books as gifts.', 'Never forgets an anniversary dinner.'],
    // Store Lina's profile creation timestamp.
    createdAt: '2026-03-06T12:05:00.000Z',
  },
];

// Export the initial list of private contacts used by local seed mode.
export const seedContacts: Contact[] = [
  // Define Rosa as a private contact owned by Avery.
  {
    // Store Rosa's stable contact ID.
    id: 'contact_rosa',
    // Store the owner user ID for this contact.
    ownerUserId: 'user_avery',
    // Leave the linked user empty because Rosa is not linked to a real account.
    linkedUserId: null,
    // Store the contact's display name.
    displayName: 'Rosa Maren',
    // Store the nickname Avery uses privately.
    nickname: 'Aunt Rosa',
    // Store example facts tied to this private contact.
    facts: ['Prefers handwritten thank-you notes.', 'Always brings apricot jam in summer.'],
    // Store the contact creation timestamp.
    createdAt: '2026-03-14T10:30:00.000Z',
  },
  // Define Lina as a private contact that is linked to her real user account.
  {
    // Store Lina's contact record ID.
    id: 'contact_lina',
    // Store the owner user ID for this contact.
    ownerUserId: 'user_avery',
    // Link the contact to Lina's real profile user ID.
    linkedUserId: 'user_lina',
    // Store the contact display name.
    displayName: 'Lina Park',
    // Store Avery's nickname for Lina.
    nickname: 'Lin',
    // Store example facts for the linked contact.
    facts: ['Met through design school.', 'Still sends screenshots of moonlit train rides.'],
    // Store the contact creation timestamp.
    createdAt: '2026-03-19T08:10:00.000Z',
  },
];

// Export the initial friend relationships used by local seed mode.
export const seedFriendships: Friendship[] = [
  // Define the friendship between Avery and Noah.
  {
    // Store the stable friendship ID.
    id: 'friendship_avery_noah',
    // Store the lexicographically lower user ID.
    userLowId: 'user_avery',
    // Store the lexicographically higher user ID.
    userHighId: 'user_noah',
    // Store which user created this friendship.
    createdByUserId: 'user_avery',
    // Store the creation timestamp for the relationship.
    createdAt: '2026-03-08T16:00:00.000Z',
  },
  // Define the friendship between Avery and Mina.
  {
    // Store the stable friendship ID.
    id: 'friendship_avery_mina',
    // Store the lexicographically lower user ID.
    userLowId: 'user_avery',
    // Store the lexicographically higher user ID.
    userHighId: 'user_mina',
    // Store which user created this friendship.
    createdByUserId: 'user_mina',
    // Store the creation timestamp for the relationship.
    createdAt: '2026-03-22T11:15:00.000Z',
  },
];

// Export the initial wall posts used by local seed mode.
export const seedWallPosts: WallPost[] = [
  // Define Noah's first visible memory about Avery.
  {
    // Store the wall post ID.
    id: 'wp_noah_about_avery_1',
    // Store the author user ID.
    authorUserId: 'user_noah',
    // Target Avery as the subject user.
    subjectUserId: 'user_avery',
    // Leave the contact subject empty because this post is about a real user.
    subjectContactId: null,
    // Make the post visible to the subject.
    visibility: 'visible_to_subject',
    // Store the memory text itself.
    body: 'She mentioned she likes the beach more than the mountains.',
    // Leave the image empty because this seed memory has no photo.
    imageUri: null,
    // Store the creation timestamp.
    createdAt: '2025-11-01T14:20:00.000Z',
  },
  // Define Noah's second visible memory about Avery.
  {
    // Store the wall post ID.
    id: 'wp_noah_about_avery_2',
    // Store the author user ID.
    authorUserId: 'user_noah',
    // Target Avery as the subject user.
    subjectUserId: 'user_avery',
    // Leave the contact subject empty because this post is about a real user.
    subjectContactId: null,
    // Make the post visible to the subject.
    visibility: 'visible_to_subject',
    // Store the memory text itself.
    body: 'Brought homemade lemon cake to the housewarming. Still the best one I ever had.',
    // Leave the image empty because this seed memory has no photo.
    imageUri: null,
    // Store the creation timestamp.
    createdAt: '2025-11-28T09:00:00.000Z',
  },
  // Define Mina's visible memory about Avery.
  {
    // Store the wall post ID.
    id: 'wp_mina_about_avery_1',
    // Store the author user ID.
    authorUserId: 'user_mina',
    // Target Avery as the subject user.
    subjectUserId: 'user_avery',
    // Leave the contact subject empty because this post is about a real user.
    subjectContactId: null,
    // Make the post visible to the subject.
    visibility: 'visible_to_subject',
    // Store the memory text itself.
    body: 'Always picks the window seat on trains and takes photos of passing stations.',
    // Leave the image empty because this seed memory has no photo.
    imageUri: null,
    // Store the creation timestamp.
    createdAt: '2026-01-15T17:45:00.000Z',
  },
  // Define Avery's visible memory about Noah.
  {
    // Store the wall post ID.
    id: 'wp_avery_about_noah_1',
    // Store the author user ID.
    authorUserId: 'user_avery',
    // Target Noah as the subject user.
    subjectUserId: 'user_noah',
    // Leave the contact subject empty because this post is about a real user.
    subjectContactId: null,
    // Make the post visible to the subject.
    visibility: 'visible_to_subject',
    // Store the memory text itself.
    body: 'Remembers everyone\'s coffee order. Even mine from three years ago.',
    // Leave the image empty because this seed memory has no photo.
    imageUri: null,
    // Store the creation timestamp.
    createdAt: '2026-02-10T08:30:00.000Z',
  },
  // Define Avery's private memory about Noah.
  {
    // Store the wall post ID.
    id: 'wp_avery_about_noah_2',
    // Store the author user ID.
    authorUserId: 'user_avery',
    // Target Noah as the subject user.
    subjectUserId: 'user_noah',
    // Leave the contact subject empty because this post is about a real user.
    subjectContactId: null,
    // Keep this post private so only Avery can see it.
    visibility: 'private',
    // Store the memory text itself.
    body: 'Called right after I had the worst week at work. Didn\'t even have to ask.',
    // Leave the image empty because this seed memory has no photo.
    imageUri: null,
    // Store the creation timestamp.
    createdAt: '2026-03-05T21:00:00.000Z',
  },
  // Define Avery's private memory about Rosa, who is a contact.
  {
    // Store the wall post ID.
    id: 'wp_avery_about_rosa_1',
    // Store the author user ID.
    authorUserId: 'user_avery',
    // Leave the user subject empty because this post is about a contact.
    subjectUserId: null,
    // Target Rosa as the subject contact.
    subjectContactId: 'contact_rosa',
    // Keep this post private because it is about a contact.
    visibility: 'private',
    // Store the memory text itself.
    body: 'She always smells like lavender and old paper. Brings apricot jam every July without fail.',
    // Leave the image empty because this seed memory has no photo.
    imageUri: null,
    // Store the creation timestamp.
    createdAt: '2026-03-18T10:00:00.000Z',
  },
];