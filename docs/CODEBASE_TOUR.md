# YourFriends Codebase Tour

This document is the fast, high-level explanation of how the app works.

If you are a junior developer, read this file first, then read `docs/FILE_REFERENCE.md`, then open the source files.

## What This App Does

YourFriends is a React Native app built with Expo Router.

The app lets a signed-in user:

- create an account and sign in with Supabase Auth
- add real friends using a friend code
- save private contacts that only they can see
- open user and contact profile screens
- write memories about a user or a contact
- optionally upload an image with a memory

## The Main Layers

The app is easiest to understand if you read it as four layers.

### 1. Routing and screens

The `app/` folder defines navigation and screens.

- `app/_layout.tsx` is the root layout for the entire app
- `app/index.tsx` decides whether the user goes to auth screens or app screens
- `app/(auth)/...` contains sign-in and sign-up
- `app/(app)/...` contains the main logged-in experience

Expo Router uses the file system as the route map.

That means:

- a file becomes a route
- folders in parentheses like `(auth)` and `(app)` group routes without becoming part of the URL
- dynamic route files like `[userId].tsx` accept route params

## 2. Shared UI components

The `src/components/` folder contains reusable building blocks.

These components keep screens small and consistent.

Examples:

- `AppScreen` gives every screen the same safe area, gradient background, and optional footer
- `ActionButton` gives a shared button style
- `SectionCard` gives a shared content card style
- `PolaroidCarousel` renders the stacked photo-style carousel on the friends screen

When reading a screen, separate the layout logic from the shared components it uses.

Usually the screen decides what data to show, and the component decides how it looks.

## 3. State and business logic

The app uses two React Context providers.

### AuthContext

`src/features/auth/AuthContext.tsx` handles:

- current auth session
- current signed-in user profile
- sign in
- sign up
- sign out

Important detail:

Supabase Auth stores login credentials and sessions, but the app also keeps a separate `profiles` table.

That means signing up is a two-step process:

1. create the auth user in Supabase Auth
2. create the matching row in `profiles`

### SocialGraphContext

`src/features/social/SocialGraphContext.tsx` handles:

- loading users
- loading contacts
- loading friendships
- loading wall posts
- adding friends by friend code
- creating manual contacts
- creating memories
- helper queries used by screens

This file is the main data layer for the app.

If a screen needs people, friendships, or memories, it usually asks `useSocialGraph()`.

## 4. Infrastructure and utility code

The `src/lib/` and `supabase/` folders handle lower-level setup.

- `src/lib/supabase.ts` creates the shared Supabase client
- `src/lib/friendCode.ts` generates and normalizes friend codes
- `src/lib/createClientId.ts` generates temporary client IDs
- `supabase/schema.sql` defines the database schema and security rules

## Typical App Flow

This is the most useful mental model when reading the app.

### App startup

1. Expo loads `app/_layout.tsx`
2. fonts are loaded
3. `SocialGraphProvider` and `AuthProvider` are mounted
4. `app/index.tsx` checks whether the user is authenticated
5. the user is redirected to either auth or app routes

### Sign up flow

1. the user fills out the form on `app/(auth)/sign-up.tsx`
2. the screen calls `useAuth().signUp(...)`
3. Supabase Auth creates the auth account
4. the app creates a matching `profiles` row
5. the app fetches the profile and stores it in context
6. the user is redirected to the friends screen

### Add friend by code flow

1. the user opens `app/(app)/friends/add.tsx`
2. they enter a friend code
3. the screen calls `useSocialGraph().addFriendByCode(...)`
4. the app looks up the user in the `profiles` table
5. if found, it inserts a row into `friendships`
6. the social graph refreshes and the user is redirected to the friend's profile

### Add memory flow

1. the user opens a profile screen
2. they tap the `Add` action in the memory wall section
3. the app opens `app/(app)/memories/add.tsx` with route params
4. the user writes text and optionally picks or captures an image
5. if an image exists, it is read from the device, encoded, and uploaded to Supabase Storage
6. the screen calls `useSocialGraph().addWallPost(...)`
7. the new memory is stored in `wall_posts`
8. the screen goes back to the profile

## Important Data Models

The app uses a few core domain types from `src/types/domain.ts`.

### AppUser

Represents a real signed-in app user.

Key fields:

- `id`
- `email`
- `displayName`
- `friendCode`
- `avatarColor`
- `profileFacts`

### Contact

Represents a private contact saved by one user.

Key fields:

- `ownerUserId`
- `linkedUserId`
- `displayName`
- `nickname`
- `facts`

### Friendship

Represents a connection between two real users.

Important detail:

The app stores friendships in canonical order:

- lower user ID goes in `userLowId`
- higher user ID goes in `userHighId`

This avoids duplicate friendships like `(A, B)` and `(B, A)`.

### WallPost

Represents a memory written about a user or contact.

Important detail:

A wall post must target exactly one subject:

- either `subjectUserId`
- or `subjectContactId`

never both at the same time.

## Styling System

The design system lives in:

- `src/theme/tokens.ts`
- `src/theme/typography.ts`

Use those values instead of hardcoding sizes or colors whenever possible.

This keeps the app visually consistent.

## Junior Developer Reading Order

If you are new to the repo, read files in this order:

1. `app/_layout.tsx`
2. `app/index.tsx`
3. `src/features/auth/AuthContext.tsx`
4. `src/features/social/SocialGraphContext.tsx`
5. `src/types/domain.ts`
6. `src/lib/supabase.ts`
7. `app/(auth)/sign-in.tsx`
8. `app/(auth)/sign-up.tsx`
9. `app/(app)/friends/index.tsx`
10. `app/(app)/friends/add.tsx`
11. `app/(app)/profiles/user/[userId].tsx`
12. `app/(app)/profiles/contact/[contactId].tsx`
13. `app/(app)/memories/add.tsx`
14. `src/components/*`
15. `supabase/schema.sql`

## Common Gotchas

### Route params can be arrays

Expo Router may return route params as a string or a string array.

That is why screens often do this kind of conversion before using the param.

### Context hooks only work under providers

`useAuth()` and `useSocialGraph()` throw errors if you call them outside their provider.

That is a good thing. It fails fast instead of hiding a broken app structure.

### Auth user and profile row are not the same thing

The auth account lives in Supabase Auth.

The app profile lives in the `profiles` table.

You usually need both.

### Friendships are stored in sorted order

Never assume the current user is always stored in the same friendship column.

Use helper functions like `isConnected()` and `getDirectFriends()` instead of reimplementing this logic in screens.

### The memory add screen talks to storage directly

Most data writes go through `SocialGraphContext`, but image upload happens in the screen before the wall post is created.

That means `app/(app)/memories/add.tsx` owns both UI logic and part of the upload flow.

## What To Read Next

Open `docs/FILE_REFERENCE.md` for the detailed, file-by-file walkthrough.