# YourFriends File Reference

This document explains each important file in the repository in a junior-friendly way.

The goal is not to repeat every literal line. The goal is to explain what each block of code is doing in source order so you can read the files without getting lost.

## Root Files

### package.json

Purpose:

Defines project scripts, runtime requirements, and dependencies.

Read top to bottom like this:

- `name`, `version`, and `main` define basic package metadata and tell Expo Router where the app starts.
- `scripts` defines the commands you run during development.
- `engines` tells contributors which Node version range the app expects.
- `dependencies` are packages needed at runtime.
- `devDependencies` are packages used for development and type checking.

Most important lines:

- `main: expo-router/entry` means Expo Router, not a custom entry file, controls navigation startup.
- `start:tunnel` and `start:lan` are convenience scripts for mobile testing.
- `typecheck` runs TypeScript without building the app.

### app.json

Purpose:

Configures Expo behavior for iOS, Android, permissions, plugins, splash screen, and app identity.

Read top to bottom like this:

- app identity fields define how the app appears to users
- visual fields define splash and icon behavior
- platform blocks set iOS and Android behavior
- `experiments.typedRoutes` enables Expo Router type support
- `plugins` configures font and image-picker integrations

Important detail:

The camera and photo permission messages here are the messages shown to end users.

### tsconfig.json

Purpose:

Controls TypeScript rules for the repo.

Important detail:

- `strict: true` means TypeScript will catch more mistakes and require more explicit typing.

### .nvmrc

Purpose:

Pins the preferred local Node version for contributors using `nvm`.

### README.md

Purpose:

Explains environment setup, startup commands, and validation commands.

Use this file when setting up the app on a new machine.

## Routing Files

### app/_layout.tsx

Purpose:

The true app root. It loads fonts, mounts global providers, and defines the top-level route stack.

Read in this order:

1. imports pull in fonts, Expo Router, status bar, providers, and theme colors
2. `RootLayout` calls `useFonts(...)` to load the custom fonts used across the app
3. if fonts are not loaded yet, a loading spinner is shown
4. once ready, the app is wrapped with `SocialGraphProvider` and `AuthProvider`
5. a root `Stack` is returned for routing

Why this matters:

- every screen depends on this file indirectly
- if a provider is missing here, hooks will fail across the app

### app/index.tsx

Purpose:

Chooses the first destination based on auth state.

Read in this order:

1. ask `useAuth()` for `isAuthenticated` and `loading`
2. show a loading spinner while auth is restoring from storage
3. redirect authenticated users to the main app
4. redirect everyone else to sign-in

This file is small but important because it decides the first screen users see.

### app/(auth)/_layout.tsx

Purpose:

Defines navigation behavior for auth screens.

It returns a `Stack` with shared screen options for sign-in and sign-up.

### app/(auth)/sign-in.tsx

Purpose:

Renders the sign-in form and calls auth logic.

Read in this order:

1. imports bring in routing, state, shared UI, auth, and theme helpers
2. local state tracks form input, errors, and loading
3. `handleSignIn()` validates the form through `useAuth().signIn(...)`
4. on success, the route is replaced with the main friends screen
5. the returned JSX renders hero copy, form fields, error text, and a sign-up link

Junior notes:

- the screen does not talk to Supabase directly
- it delegates auth work to `AuthContext`
- this is a good pattern because screens stay thinner

### app/(auth)/sign-up.tsx

Purpose:

Renders account creation form UI.

Read in this order:

1. local state stores name, email, password, error, and busy status
2. `handleSignUp()` calls `useAuth().signUp(...)`
3. on success, the user is sent to the logged-in app
4. the screen also renders a back button to return to sign-in

Important detail:

The actual friend code creation and profile row insert do not happen here. They happen in `AuthContext`.

### app/(app)/_layout.tsx

Purpose:

Defines shared navigation settings for authenticated screens.

### app/(app)/index.tsx

Purpose:

Redirects the authenticated route group root to the friends screen.

This avoids a blank route when someone lands on `/(app)`.

## Main App Screens

### app/(app)/friends/index.tsx

Purpose:

The app home screen for logged-in users.

This screen mixes:

- account-level actions
- carousel-based browsing
- friend list rendering
- private contact list rendering

Read in this order:

1. hooks get router, auth state, social data, and local carousel index
2. the redirect guard stops unauthenticated access
3. derived values are calculated:
   - `people`
   - `directFriends`
   - `manualContacts`
   - `activePerson`
4. the `AppScreen` wrapper adds a fixed footer button for adding friends
5. the header shows a shortcut to the current user's own profile and a sign-out action
6. the hero section introduces the page
7. if `people.length > 0`, the carousel, dots, active person meta, and mini stats are shown
8. if there are no people yet, an empty state is shown instead
9. two section cards render:
   - real connected friends
   - private saved contacts

How to reason about it:

- this file is mostly a view layer
- the heavy lifting for data comes from `useSocialGraph()`
- navigation is based on whether a list item represents a `user` or a `contact`

### app/(app)/friends/add.tsx

Purpose:

Lets the user either add a real friend by code or create a manual contact.

Read in this order:

1. hooks load router, auth user, and social graph actions
2. local state is split into two separate flows:
   - manual contact flow state
   - friend code flow state
3. the auth guard redirects unauthenticated users
4. `handleCreateManualContact()` validates manual contact input and creates a contact
5. `handleAddByCode()` looks up a user by friend code and creates a friendship
6. the JSX renders two `SectionCard` blocks, one for each flow

Junior notes:

- separate error and busy states avoid one form blocking the other
- route replacement sends the user straight to the newly created person profile

### app/(app)/profiles/user/[userId].tsx

Purpose:

Shows a real user's profile.

Read in this order:

1. the route param is read and normalized from array-or-string form to a single string
2. `useAuth()` gives the current user
3. `useSocialGraph()` provides user lookup, connection checks, and wall posts
4. if the profile user is missing, a fallback card is shown
5. derived booleans determine whether the viewer is connected or is looking at their own profile
6. the page renders:
   - back button
   - hero card
   - own friend code badge if relevant
   - placeholder action button for a future wall feature
   - facts section
   - memory wall section

Important detail:

The facts section is currently read-only in the UI.

### app/(app)/profiles/contact/[contactId].tsx

Purpose:

Shows a private contact profile.

Read in this order:

1. normalize route param
2. load current user and social graph helpers
3. validate that the contact exists and belongs to the current user
4. optionally fetch a linked real user
5. compute an accent color using the people list
6. load wall posts for this contact
7. render hero card, optional linked-user button, facts section, and memory wall section

Important detail:

This screen enforces ownership. A user cannot view another person's private contacts.

### app/(app)/memories/add.tsx

Purpose:

Creates a new memory about a user or contact.

Read in this order:

1. imports bring in router helpers, image tools, Supabase, social graph actions, and theme tokens
2. route params are read and normalized
3. current user and subject lookup helpers are loaded
4. local state stores memory body, selected image, visibility, error, and loading state
5. auth guard redirects if needed
6. `subjectName` is derived so the UI can show who the memory is about
7. `pickImage()` opens the gallery
8. `takePhoto()` requests permission and opens the camera
9. `handleSave()` validates input, optionally uploads the image to storage, creates the wall post, and navigates back
10. the JSX renders a back button, title, image area, text input, visibility toggle, and save footer

Junior notes:

- this file is one of the most important files to understand because it combines UI state, device APIs, storage upload, and data creation
- the image upload happens before the wall post insert
- if there is no image, the wall post is still created normally

## Shared Components

### src/components/AppScreen.tsx

Purpose:

Shared layout wrapper for screens.

Read in this order:

1. imports pull in gradient support, safe area support, and style types
2. `AppScreenProps` defines the component API
3. `AppScreen(...)` builds either:
   - a scrollable body using `ScrollView`
   - a fixed body using `View`
4. the component returns a gradient background, safe area wrapper, body, and optional footer
5. styles define shared screen spacing and footer padding

Important detail:

This component keeps layout concerns out of most screen files.

### src/components/ActionButton.tsx

Purpose:

Reusable button component with three variants.

Read in this order:

1. prop types define label, variant, disabled state, and click handler
2. the `Pressable` chooses styles based on variant and pressed state
3. the text chooses matching label styles
4. styles define shared button size and per-variant colors

### src/components/FormField.tsx

Purpose:

Reusable labeled text input.

Read in this order:

1. the prop type defines allowed input options
2. the component renders a label and a `TextInput`
3. style values come from theme tokens and typography helpers

### src/components/SectionCard.tsx

Purpose:

Standard card container used across the app.

Read in this order:

1. optional eyebrow and title props are checked
2. the card renders those labels if present
3. it always renders `children`

### src/components/PolaroidCarousel.tsx

Purpose:

Renders the handmade, stacked-photo carousel on the friends screen.

Read in this order:

1. props define the active index, items, and callbacks
2. `useWindowDimensions()` drives responsive sizing
3. a set of dimension variables is calculated from the screen width
4. `handleMomentumEnd()` calculates the currently snapped card index
5. the component renders decorative stack shadows behind the list
6. a horizontal `FlatList` renders one stylized card per person
7. each card is pressable and calls `onPressItem(item)` when tapped
8. helper `getInitials()` builds the avatar letters

Junior notes:

- this file is mostly presentation logic
- it looks large because visual math is grouped near the top

### src/components/ProfileHeroCard.tsx

Purpose:

Shows a large profile avatar card with stacked paper styling.

Read in this order:

1. prop type defines accent color, name, and subtitle
2. the component renders stacked decorative sheets and a main avatar card
3. the helper `getInitials()` derives letters from the name
4. the constant `CARD_SIZE` keeps the design consistent

### src/components/WallPostCard.tsx

Purpose:

Displays one memory entry.

Read in this order:

1. receive `authorName` and `post`
2. convert `createdAt` to a short readable date
3. render an image if present or a placeholder if not
4. render the text and author attribution
5. styles add the scrapbook tilt effect

### src/components/PersonCard.tsx

Purpose:

Reusable card for displaying a person.

Current status:

This component is available but not the main card used on the home screen right now.

It is still useful to read because it shows the app's shared list-item design ideas.

### src/components/FactChip.tsx

Purpose:

Reusable chip-style text badge.

Current status:

This component is currently available but not the primary rendering path for facts.

## Feature Modules

### src/features/auth/AuthContext.tsx

Purpose:

Owns auth state and auth-related actions.

Read in this order:

1. imports pull in Supabase session typing, React context helpers, app user typing, friend code generation, and theme palette
2. `AuthContextValue` defines what the context exposes
3. `AuthContext` is created with a nullable default
4. `AuthProvider` creates local state for:
   - session
   - current user profile
   - loading status
5. the first `useEffect` restores an existing session and subscribes to auth changes
6. `fetchProfile(userId)` loads the matching row from the `profiles` table and maps it into the app's `AppUser` shape
7. `signIn(email, password)` validates input, signs in with Supabase Auth, then loads the profile
8. `signUp(displayName, email, password)` validates input, creates the auth account, generates a friend code, computes an avatar color, creates the profile row, then loads the profile
9. `signOut()` signs out and clears local user state
10. the provider returns the assembled context value
11. `useAuth()` reads the context and throws if the provider is missing

Why this file matters:

This file connects UI forms to Supabase Auth and to the app-specific `profiles` table.

### src/features/social/SocialGraphContext.tsx

Purpose:

Owns the social graph data layer for users, contacts, friendships, and memories.

Read in this order:

1. imports pull in React helpers, Supabase, theme colors, and domain types
2. `SocialGraphContextValue` defines the public API for screens
3. `SocialGraphContext` is created
4. row-mapper helpers convert database rows into app-friendly objects:
   - `rowToUser`
   - `rowToContact`
   - `rowToFriendship`
   - `rowToWallPost`
5. `SocialGraphProvider` creates state arrays for users, contacts, friendships, and wall posts
6. `refresh()` loads all four tables in parallel using `Promise.all(...)`
7. one `useEffect` runs `refresh()` on mount
8. another `useEffect` reruns `refresh()` when auth state changes
9. helper query functions read from in-memory state
10. mutation functions write to Supabase and update local state
11. the provider returns the assembled context value
12. `useSocialGraph()` safely exposes the context
13. `getContactAccent()` creates a stable avatar color for contacts based on their ID

Why this file matters:

If the app needs people or memory data, this file is usually the answer.

## Utilities and Theme

### src/lib/supabase.ts

Purpose:

Creates the shared Supabase client.

Read in this order:

1. load the React Native URL polyfill so Supabase works correctly in the app environment
2. import `AsyncStorage` so auth sessions can be persisted on device
3. read the public Supabase URL and anon key from environment variables
4. create and export one configured Supabase client

Important detail:

This file is intentionally tiny. Centralized setup is easier to change later.

### src/lib/friendCode.ts

Purpose:

Generates and normalizes friend codes.

Read in this order:

1. `ALPHABET` defines allowed characters and removes visually confusing ones
2. `normalizeFriendCode(value)` removes non-alphanumeric characters and uppercases the result
3. `createFriendCode(seed, existingCodes)` builds a deterministic 8-character code from a seed and retries until it finds an unused one
4. `hashString(value)` creates a simple unsigned integer hash

Junior notes:

- this is not cryptographic code
- it is app-level identifier generation, not security code

### src/lib/createClientId.ts

Purpose:

Generates temporary client-side IDs.

Read line by line:

- `let sequence = 0;` creates a module-level counter that survives across calls while the app is running
- `createClientId(prefix: string)` is the exported helper
- `sequence += 1;` ensures two calls in the same millisecond still get different IDs
- the return statement combines:
  - the caller-provided prefix
  - the current timestamp in base 36
  - the sequence number in base 36

Example output:

- `contact_m8x2to_1`

Important detail:

This is good for temporary client IDs, but not for permanent IDs stored as the source of truth.

### src/theme/tokens.ts

Purpose:

Stores the app's design tokens.

Read in this order:

1. `colors` stores named colors used across the app
2. `spacing` stores shared spacing values
3. `radius` stores border radius values
4. `shadow` stores shared shadow presets
5. `accentPalette` stores reusable accent colors for avatars and profile styling

Why this matters:

Using named tokens makes the UI more consistent and easier to redesign later.

### src/theme/typography.ts

Purpose:

Maps semantic font roles to actual loaded font names.

Read top to bottom:

- `heading` uses Newsreader
- `body`, `bodyMedium`, and `bodyBold` use Manrope

This file lets components ask for a role instead of remembering exact font names.

## Types and Mock Data

### src/types/domain.ts

Purpose:

Defines the main TypeScript shapes used across the app.

Read in this order:

1. small union types define reusable categories like `EntityType` and `WallPostVisibility`
2. main interfaces define stored app shapes:
   - `AppUser`
   - `Contact`
   - `Friendship`
   - `PeopleListItem`
   - `WallPost`
3. input interfaces define payloads for creation flows:
   - `CreateUserInput`
   - `CreateWallPostInput`
   - `CreateContactInput`

Why this matters:

These types are the contract between screens, contexts, and utilities.

### src/mocks/socialSeed.ts

Purpose:

Stores sample users, contacts, friendships, and memories.

Current status:

The app now uses live Supabase-backed data, so this file mainly acts as reference seed data and a useful example of domain shape.

## Database

### supabase/schema.sql

Purpose:

Defines the database schema, constraints, row-level security rules, and indexes.

Read in this order:

1. enable UUID generation
2. create `profiles` table and its security policies
3. create `contacts` table and its security policies
4. create `friendships` table and its uniqueness and ordering constraints
5. create `wall_posts` table and its subject constraint
6. define row-level security policies for reads and writes
7. note the required storage bucket
8. create supporting indexes

Important database rules:

- a profile row is linked to an auth user row
- private contacts belong to one owner
- friendships are unique and canonically ordered
- a wall post must target either a user or a contact, not both
- visible wall posts about a user can be read by that subject user

## How To Use This Document While Reading Code

For each file:

1. read the file once without editing
2. compare what you see to the section in this document
3. identify where the file reads data, transforms data, and renders UI
4. then follow its connections into the next file