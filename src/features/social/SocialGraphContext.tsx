import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useCallback, useContext, useEffect } from 'react';

import { supabase } from '../../lib/supabase';
import { accentPalette } from '../../theme/tokens';
import {
  AppUser,
  Contact,
  CreateContactInput,
  CreateFriendFactInput,
  CreateWallPostInput,
  FriendFact,
  Friendship,
  PeopleListItem,
  WallPost,
} from '../../types/domain';

// Describe the full API that the social graph provider exposes to screens and components.
interface SocialGraphContextValue {
  // Expose the raw contact list because several screens use it directly.
  contacts: Contact[];
  // Expose a helper for creating friendships through a friend code lookup.
  addFriendByCode: (currentUserId: string, friendCode: string) => Promise<{ ok: true; friend: AppUser } | { ok: false; error: string }>;
  // Expose a helper for creating a private manual contact.
  addManualContact: (ownerUserId: string, input: CreateContactInput) => Promise<Contact>;
  // Expose a helper for creating a memory post.
  addWallPost: (authorUserId: string, input: CreateWallPostInput) => Promise<WallPost>;
  // Expose a lookup helper for a contact by ID.
  getContactById: (contactId: string) => Contact | undefined;
  // Expose a helper that returns only direct friends for a user.
  getDirectFriends: (userId: string) => AppUser[];
  // Expose a helper that returns the mixed people list used on the home screen.
  getPeopleListForUser: (userId: string) => PeopleListItem[];
  // Expose a lookup helper for a user by ID.
  getUserById: (userId: string) => AppUser | undefined;
  // Expose a helper that returns wall posts for a given user or contact subject.
  getWallPostsForSubject: (subjectId: string, subjectType: 'user' | 'contact') => WallPost[];
  // Expose a helper that answers whether two real users are already connected.
  isConnected: (leftUserId: string, rightUserId: string) => boolean;
  addFriendFact: (authorUserId: string, input: CreateFriendFactInput) => Promise<FriendFact>;
  deleteFriendFact: (factId: string) => Promise<void>;
  getFriendFactsFor: (authorUserId: string, subjectUserId: string) => FriendFact[];
  refresh: () => Promise<void>;
}

// Create the social graph context with a null default so missing providers fail fast.
const SocialGraphContext = createContext<SocialGraphContextValue | null>(null);

/* ---- Row → domain mappers ---- */

// Convert a raw Supabase profile row into the `AppUser` shape used by the app.
function rowToUser(row: any): AppUser {
  // Return a new object whose field names match the app's camelCase domain type.
  return {
    // Copy the row ID into the app user object.
    id: row.id,
    // Copy the user's email address.
    email: row.email,
    // Map the snake_case database column to camelCase.
    displayName: row.display_name,
    // Copy the stored friend code.
    friendCode: row.friend_code,
    // Copy the stored avatar color token.
    avatarColor: row.avatar_color,
    // Use the stored avatar path or null if there is none.
    avatarPath: row.avatar_path ?? null,
    // Use the stored profile facts array or an empty array if missing.
    profileFacts: row.profile_facts ?? [],
    // Copy the creation timestamp.
    createdAt: row.created_at,
  };
} // End rowToUser after returning the mapped user object.

// Convert a raw Supabase contact row into the `Contact` shape used by the app.
function rowToContact(row: any): Contact {
  // Return a new object with camelCase keys that match the app's type definitions.
  return {
    // Copy the contact ID.
    id: row.id,
    // Map the contact owner field from snake_case to camelCase.
    ownerUserId: row.owner_user_id,
    // Copy the linked real-user ID if one exists.
    linkedUserId: row.linked_user_id ?? null,
    // Copy the display name for the contact.
    displayName: row.display_name,
    // Copy the nickname if present.
    nickname: row.nickname ?? null,
    // Use the facts array or fall back to an empty array.
    facts: row.facts ?? [],
    // Copy the creation timestamp.
    createdAt: row.created_at,
  };
} // End rowToContact after returning the mapped contact object.

// Convert a raw Supabase friendship row into the `Friendship` shape used by the app.
function rowToFriendship(row: any): Friendship {
  // Return a new friendship object with the field names expected by the app.
  return {
    // Copy the friendship ID.
    id: row.id,
    // Copy the lower-sorting user ID from the canonical friendship pair.
    userLowId: row.user_low_id,
    // Copy the higher-sorting user ID from the canonical friendship pair.
    userHighId: row.user_high_id,
    // Copy the ID of the user who created the friendship.
    createdByUserId: row.created_by_user_id,
    // Copy the creation timestamp.
    createdAt: row.created_at,
  };
} // End rowToFriendship after returning the mapped friendship object.

// Convert a raw Supabase wall post row into the `WallPost` shape used by the app.
function rowToWallPost(row: any): WallPost {
  // Return a new wall post object with camelCase field names.
  return {
    // Copy the wall post ID.
    id: row.id,
    // Copy the author user ID.
    authorUserId: row.author_user_id,
    // Copy the subject user ID or null if the post targets a contact.
    subjectUserId: row.subject_user_id ?? null,
    // Copy the subject contact ID or null if the post targets a user.
    subjectContactId: row.subject_contact_id ?? null,
    // Copy the visibility setting.
    visibility: row.visibility,
    // Copy the main body text.
    body: row.body,
    // Copy the stored image path or URL if one exists.
    imageUri: row.image_path ?? null,
    // Copy the creation timestamp.
    createdAt: row.created_at,
  };
}

function rowToFriendFact(row: any): FriendFact {
  return {
    id: row.id,
    authorUserId: row.author_user_id,
    subjectUserId: row.subject_user_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

// Query keys used by the social graph. Exported so external code can invalidate if needed.
export const socialQueryKeys = {
  users: ['social', 'users'] as const,
  contacts: ['social', 'contacts'] as const,
  friendships: ['social', 'friendships'] as const,
  wallPosts: ['social', 'wallPosts'] as const,
  friendFacts: ['social', 'friendFacts'] as const,
  all: ['social'] as const,
};

// Fetcher functions — each fetches one Supabase table and maps rows to domain types.
async function fetchUsers(): Promise<AppUser[]> {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) throw error;
  return (data ?? []).map(rowToUser);
}

async function fetchContacts(): Promise<Contact[]> {
  const { data, error } = await supabase.from('contacts').select('*');
  if (error) throw error;
  return (data ?? []).map(rowToContact);
}

async function fetchFriendships(): Promise<Friendship[]> {
  const { data, error } = await supabase.from('friendships').select('*');
  if (error) throw error;
  return (data ?? []).map(rowToFriendship);
}

async function fetchWallPosts(): Promise<WallPost[]> {
  const { data, error } = await supabase.from('wall_posts').select('*');
  if (error) throw error;
  return (data ?? []).map(rowToWallPost);
}

async function fetchFriendFacts(): Promise<FriendFact[]> {
  const { data, error } = await supabase.from('friend_facts').select('*');
  if (error) throw error;
  return (data ?? []).map(rowToFriendFact);
}

export function SocialGraphProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // Each table is its own query — independent loading, caching, and background refetch.
  const usersQuery = useQuery({ queryKey: socialQueryKeys.users, queryFn: fetchUsers });
  const contactsQuery = useQuery({ queryKey: socialQueryKeys.contacts, queryFn: fetchContacts });
  const friendshipsQuery = useQuery({ queryKey: socialQueryKeys.friendships, queryFn: fetchFriendships });
  const wallPostsQuery = useQuery({ queryKey: socialQueryKeys.wallPosts, queryFn: fetchWallPosts });
  const friendFactsQuery = useQuery({ queryKey: socialQueryKeys.friendFacts, queryFn: fetchFriendFacts });

  // Derive arrays from query data (empty array while loading/errored).
  const users = usersQuery.data ?? [];
  const contacts = contactsQuery.data ?? [];
  const friendships = friendshipsQuery.data ?? [];
  const wallPosts = wallPostsQuery.data ?? [];
  const friendFacts = friendFactsQuery.data ?? [];

  // Invalidate all social queries when auth state changes (sign-in, sign-out).
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      queryClient.invalidateQueries({ queryKey: socialQueryKeys.all });
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  // refresh() invalidates all social queries, triggering background refetch.
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: socialQueryKeys.all });
  }, [queryClient]);

  // Look up a real user by ID from the in-memory users array.
  function getUserById(userId: string) {
    // Return the first user whose ID matches the requested ID.
    return users.find((user) => user.id === userId);
  } // End getUserById after searching the user list.

  // Look up a private contact by ID from the in-memory contacts array.
  function getContactById(contactId: string) {
    // Return the first contact whose ID matches the requested ID.
    return contacts.find((contact) => contact.id === contactId);
  } // End getContactById after searching the contact list.

  // Return only the direct friends connected to the given real user.
  function getDirectFriends(userId: string) {
    // Start from the friendships array and narrow it to friendships involving this user.
    return friendships
      // Keep only friendships where the user appears on either side of the pair.
      .filter((f) => f.userLowId === userId || f.userHighId === userId)
      // Convert each friendship into the other user in the pair.
      .map((f) => {
        // Figure out which side of the friendship is the friend rather than the current user.
        const friendId = f.userLowId === userId ? f.userHighId : f.userLowId;
        // Resolve that friend ID to a full AppUser object.
        return getUserById(friendId);
      })
      // Remove any unresolved values and tell TypeScript the result is definitely AppUser[].
      .filter((u): u is AppUser => Boolean(u));
  } // End getDirectFriends after building the friend list.

  // Answer whether two real users are already connected by a friendship row.
  function isConnected(leftUserId: string, rightUserId: string) {
    // Put the lower-sorting ID on the left so the lookup matches the table's canonical ordering rule.
    const low = leftUserId < rightUserId ? leftUserId : rightUserId;
    // Put the higher-sorting ID on the right for the same reason.
    const high = leftUserId < rightUserId ? rightUserId : leftUserId;
    // Return true if a friendship with that canonical pair already exists.
    return friendships.some((f) => f.userLowId === low && f.userHighId === high);
  } // End isConnected after checking the friendship list.

  // Build the mixed people list used by the friends screen carousel and summary lists.
  function getPeopleListForUser(userId: string) {
    // Convert direct friends into the `PeopleListItem` view model expected by the UI.
    const friendItems: PeopleListItem[] = getDirectFriends(userId).map((friend) => ({
      // Reuse the friend user's ID as the item ID.
      id: friend.id,
      // Mark this item as a real user.
      entityType: 'user',
      // Prefer the friendship creation date, but fall back to the user's own creation date if needed.
      createdAt:
        friendships.find(
          // Find the friendship row connecting the requested user and this friend.
          (f) =>
            // Match the canonical pair no matter which side the requested user is on.
            (f.userLowId === userId && f.userHighId === friend.id) ||
            // Match the reverse canonical pair case as well.
            (f.userHighId === userId && f.userLowId === friend.id),
        )?.createdAt ?? friend.createdAt,
      // Use the friend's display name as the UI title.
      title: friend.displayName,
      // Show the friend code as supporting text.
      subtitle: `Friend code ${friend.friendCode}`,
      // Use a short label that explains what this item represents.
      caption: 'Connected friend',
      // Reuse the friend's avatar color in the UI view model.
      avatarColor: friend.avatarColor,
    }));

    // Convert owned contacts into the same `PeopleListItem` shape so the UI can render both kinds together.
    const contactItems: PeopleListItem[] = contacts
      // Keep only contacts owned by the requested user.
      .filter((contact) => contact.ownerUserId === userId)
      // Map each owned contact into the UI view model.
      .map((contact) => ({
        // Reuse the contact ID as the item ID.
        id: contact.id,
        // Mark this item as a private contact.
        entityType: 'contact',
        // Use the contact creation date for sorting.
        createdAt: contact.createdAt,
        // Use the contact display name as the title.
        title: contact.displayName,
        // Show either the nickname or a generic contact label as supporting text.
        subtitle: contact.nickname ? `Saved as ${contact.nickname}` : 'Manual contact',
        // Show whether the contact is linked to a real account or remains private-only.
        caption: contact.linkedUserId ? 'Linked to a real account' : 'Private contact',
        // Derive a stable accent color from the contact ID.
        avatarColor: getContactAccent(contact.id),
        // Carry forward any linked real-user ID the contact may have.
        linkedUserId: contact.linkedUserId,
      }));

    // Combine friends and contacts into one list and sort newest-first for the UI.
    return [...friendItems, ...contactItems].sort((a, b) =>
      // Sort descending by timestamp so the most recent relationships appear first.
      b.createdAt.localeCompare(a.createdAt),
    );
  } // End getPeopleListForUser after building and sorting the mixed list.

  // Add a friendship by looking up a user through their friend code.
  async function addFriendByCode(currentUserId: string, friendCode: string) {
    // Normalize the typed code by trimming whitespace and uppercasing it.
    const code = friendCode.trim().toUpperCase();

    // Reject empty input before querying the database.
    if (!code) return { ok: false as const, error: 'Enter a friend code.' };

    // Look up the user by friend code
    // Query the profiles table for exactly one user with the supplied friend code.
    const { data: profile, error: lookupErr } = await supabase
      // Search the profiles table because friend codes live there.
      .from('profiles')
      // Select all columns so the found profile can be mapped back into the app shape.
      .select('*')
      // Filter by the unique friend code column.
      .eq('friend_code', code)
      // Require exactly one row.
      .single();

    // If no matching profile was found, return a readable error.
    if (lookupErr || !profile) {
      // Tell the UI that the entered code did not match a real user.
      return { ok: false as const, error: 'No one found with that friend code.' };
    }

    // Prevent the user from adding themselves as a friend.
    if (profile.id === currentUserId) {
      // Return a friendly error for the self-add case.
      return { ok: false as const, error: "That's your own friend code!" };
    }

    // Check if already friends
    // Build the canonical low ID for the friendship row.
    const low = currentUserId < profile.id ? currentUserId : profile.id;
    // Build the canonical high ID for the friendship row.
    const high = currentUserId < profile.id ? profile.id : currentUserId;

    // If that friendship already exists, stop here.
    if (isConnected(currentUserId, profile.id)) {
      // Tell the UI the relationship already exists.
      return { ok: false as const, error: 'You are already friends with this person.' };
    }

    // Create the friendship
    // Insert the canonical friendship row into Supabase.
    const { error: insertErr } = await supabase.from('friendships').insert({
      // Store the lower-sorting user ID.
      user_low_id: low,
      // Store the higher-sorting user ID.
      user_high_id: high,
      // Record who initiated the friendship.
      created_by_user_id: currentUserId,
    });

    // If the insert fails, return the database error.
    if (insertErr) {
      // Surface the insert error to the UI.
      return { ok: false as const, error: insertErr.message };
    }

    // Refresh friendships and users so the new friend shows up immediately.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: socialQueryKeys.friendships }),
      queryClient.invalidateQueries({ queryKey: socialQueryKeys.users }),
    ]);

    // Map the found raw profile row into the app's `AppUser` shape.
    const friend = rowToUser(profile);
    // Return success along with the newly connected friend object.
    return { ok: true as const, friend };
  } // End addFriendByCode after returning either success or failure.

  // Create a new private contact owned by the current user.
  async function addManualContact(ownerUserId: string, input: CreateContactInput) {
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        owner_user_id: ownerUserId,
        display_name: input.displayName.trim(),
        nickname: input.nickname?.trim() || null,
        facts: ['Freshly added to your circle.'],
      })
      .select()
      .single();

    if (error || !data) throw new Error(error?.message ?? 'Failed to create contact');

    const contact = rowToContact(data);
    // Optimistically prepend to the cached contacts list.
    queryClient.setQueryData<Contact[]>(socialQueryKeys.contacts, (old) => [contact, ...(old ?? [])]);
    return contact;
  }

  // Return all wall posts for a given subject, sorted newest-first.
  function getWallPostsForSubject(subjectId: string, subjectType: 'user' | 'contact') {
    // Start from the full wall post list and keep only posts about the requested subject.
    return wallPosts
      // Decide which subject column to compare based on whether the target is a user or a contact.
      .filter((post) => {
        // If the subject type is `user`, compare against `subjectUserId`.
        if (subjectType === 'user') return post.subjectUserId === subjectId;
        // Otherwise compare against `subjectContactId`.
        return post.subjectContactId === subjectId;
      })
      // Sort newest-first so recent memories appear at the top.
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } // End getWallPostsForSubject after filtering and sorting the result.

  // Create a new wall post and update the cache immediately.
  async function addWallPost(authorUserId: string, input: CreateWallPostInput) {
    const { data, error } = await supabase
      .from('wall_posts')
      .insert({
        author_user_id: authorUserId,
        subject_user_id: input.subjectUserId,
        subject_contact_id: input.subjectContactId,
        visibility: input.visibility,
        body: input.body,
        image_path: input.imageUri,
      })
      .select()
      .single();

    if (error || !data) throw new Error(error?.message ?? 'Failed to create memory');

    const post = rowToWallPost(data);
    queryClient.setQueryData<WallPost[]>(socialQueryKeys.wallPosts, (old) => [post, ...(old ?? [])]);
    return post;
  }

  function getFriendFactsFor(authorUserId: string, subjectUserId: string) {
    return friendFacts
      .filter((f) => f.authorUserId === authorUserId && f.subjectUserId === subjectUserId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async function addFriendFact(authorUserId: string, input: CreateFriendFactInput) {
    const { data, error } = await supabase
      .from('friend_facts')
      .insert({ author_user_id: authorUserId, subject_user_id: input.subjectUserId, body: input.body })
      .select()
      .single();
    if (error || !data) throw new Error(error?.message ?? 'Failed to create fact');
    const fact = rowToFriendFact(data);
    queryClient.setQueryData<FriendFact[]>(socialQueryKeys.friendFacts, (old) => [fact, ...(old ?? [])]);
    return fact;
  }

  async function deleteFriendFact(factId: string) {
    const { error } = await supabase.from('friend_facts').delete().eq('id', factId);
    if (error) throw new Error(error.message);
    queryClient.setQueryData<FriendFact[]>(socialQueryKeys.friendFacts, (old) =>
      (old ?? []).filter((f) => f.id !== factId),
    );
  }

  // Render the provider so children can read social graph data and actions.
  return (
    // Provide the assembled social graph API to the component subtree.
    <SocialGraphContext.Provider
      // Build the provider value from state, helpers, and mutation functions.
      value={{
        // Expose the raw contacts array.
        contacts,
        // Expose the friend-code add action.
        addFriendByCode,
        // Expose the manual contact creation action.
        addManualContact,
        // Expose the wall post creation action.
        addWallPost,
        // Expose the contact lookup helper.
        getContactById,
        // Expose the direct-friends helper.
        getDirectFriends,
        // Expose the mixed people-list helper.
        getPeopleListForUser,
        // Expose the user lookup helper.
        getUserById,
        // Expose the subject wall-post helper.
        getWallPostsForSubject,
        // Expose the connection-check helper.
        isConnected,
        addFriendFact,
        deleteFriendFact,
        getFriendFactsFor,
        refresh,
      }}
    >
      {/* Render the child components wrapped by this provider. */}
      {children}
    </SocialGraphContext.Provider>
  );
} // End SocialGraphProvider after returning the context provider.

// Export a hook wrapper so the rest of the app can consume the social graph easily.
export function useSocialGraph() {
  // Read the current social graph context value.
  const context = useContext(SocialGraphContext);

  // Fail fast if someone uses the hook outside the provider tree.
  if (!context) {
    // Throw a clear setup error for development.
    throw new Error('useSocialGraph must be used inside SocialGraphProvider.');
  }

  // Return the non-null social graph API.
  return context;
} // End useSocialGraph after returning the context value.

// Derive a stable accent color for a private contact based on its ID.
function getContactAccent(contactId: string) {
  // Sum the character codes of the ID so different IDs usually land on different colors.
  const total = Array.from(contactId).reduce((sum, c) => sum + c.charCodeAt(0), 0);
  // Use modulo arithmetic so the total maps into a valid accent palette index.
  return accentPalette[total % accentPalette.length];
} // End getContactAccent after returning the derived palette color.