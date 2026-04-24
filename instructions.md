# Instructions

## Core Rule

- [ ] After every completed task or user prompt, update this file and check off the relevant checklist item(s).

## Standard Task Checklist

- [x] Read the full prompt before making changes.
- [x] Confirm the task scope and requirements.
- [x] Make the requested change.
- [x] Validate the result.
- [x] Mark the completed work in this file.

## Prompt Tracking Checklist

- [x] Current prompt reviewed.
- [x] Current task implemented.
- [x] Current task verified.
- [x] Checklist updated after completion.

## Working Notes

- Use this file as the running checklist for work in this project.
- Add new checklist items when a task needs multiple steps.
- When a prompt is fully handled, mark the related items as complete here.
- Added junior-focused repository documentation in `docs/CODEBASE_TOUR.md` and `docs/FILE_REFERENCE.md`.
- Fixed the home/friends carousel scroll measurement so lower sections remain reachable below the polaroid cards.
- Added shareable polaroids via text: installed `react-native-view-shot` + `expo-sharing`, created `src/lib/sharePolaroid.ts`, and wired a share button into `WallPostCard` (opt-in via `shareable` prop). Enabled on wall screen, user profile, contact profile, and throwback feed. Share works for both front and back faces of the flipped polaroid.
- Added 10 new themes (Neon, Synthwave, Matcha, Bubblegum, Lava, Arctic, Vintage, Grape, Cocoa, Mint) in `src/features/theme/themes.ts` — each with light/dark variants. Settings theme picker now shows a colored swatch dot next to each theme name.
- Disabled the paywall for testing: `PremiumProvider` now defaults `isPremium` to `true` so all themes and unlimited friends are unlocked. To re-enable, flip the default back to `false`.
- Removed the original basic themes (Warm, Ocean, Forest, Sunset, Midnight, Rose, Monochrome). Theme picker now shows only Default + the 10 new themes. `ThemeContext` falls back to Default if a removed theme name was saved in storage.
- Tied card colors to themes: created `src/features/theme/cardColorUnlocks.ts` that exposes a base neutral palette plus a curated per-theme set. The card color pickers in `memories/add.tsx` and `profiles/contact/edit.tsx` now show locked swatches dimmed with a lock icon and show an alert naming the theme(s) that unlock each color.
- Rewrote `PremiumContext` so themes are individual unlocks stored in a list (`purchasedThemes`) plus a separate `friendsUnlocked` flag. Card color unlock logic now reads the purchased theme list, not the currently active theme. Settings has a per-theme paywall (each theme $0.99, migrates legacy `isPremium=true` flag to full unlock). Friend limit uses a dedicated `unlockFriends()` purchase ($2.99).
- Moved the per-person unread badge from below the carousel card into an app-style top-right corner badge on the polaroid in `src/components/PolaroidCarousel.tsx`.
- Added font and size controls for text-only memories in the add/edit memory flow, with live preview, and persisted the styling through wall-post metadata so saved note cards match the preview.
- Expanded text-only memory styling with more loaded fonts, a real size slider, and persisted text effects including glow/echo/shadow/dreamy presets in the note preview and saved cards.
- Added text color presets for text-only memories so note-only cards can preview, save, and render custom lettering colors alongside the existing font, size, and effect options.
- Changed the top-left back action in the memory add/edit screens to route deterministically to the subject's profile, with the friends home screen as a fallback, instead of relying on the navigation stack.
- Fixed shared polaroid captures so the exported image includes extra margin around tilted cards, preventing the rotated corners from getting clipped while keeping the tilt intact.
- Repaired malformed JSX in `src/components/WallPostCard.tsx` after the share-capture padding change so the tilted polaroid share flow builds cleanly again.
- Reduced startup work by moving `PremiumProvider` and `SocialGraphProvider` into the authenticated app layout, removing PremiumProvider's mount-time storage write/render gate, deferring push token registration until after interactions, gating social queries to authenticated app startup, and increasing persisted query freshness for faster relaunches.
- Added a dedicated "Sticker Packs" coming-soon section to the store screen so upcoming sticker packs are visible without implying they are available to buy yet.
- Added two stationary shortcut buttons under the active friends carousel card so you can jump straight into adding a text note or opening the Polaroid camera for the currently selected person.
- Changed add-memory back navigation to follow an explicit `returnTo` target from the opening screen, so backing out of note creation returns to the actual source screen instead of always forcing the subject's profile.
- Refined add-memory navigation so the composer now uses `dismissTo` with a dedicated `backTo` target, which restores the native leftward back animation from profile-launched note creation while keeping the camera flow returning to the composer correctly.
- Fixed edit-memory back navigation so it now pops the current screen with `router.back()` instead of inferring a destination from the post subject fields, which avoids sending contact-launched edits to the linked user's duplicate profile.
- Replaced the duplicated date-grouped memory wall rendering with a shared month-scrollable memory wall component, so the user profile, contact profile, and view-your-wall screens can switch between months while keeping day-level grouping inside the selected month.
- Reworked the month-scrollable memory wall to pin the active month/year in the outer page scroll instead of creating a nested scrolling lane, so the date stays stuck while the full profile page keeps scrolling naturally.
- Removed flip-time image flashing by keeping both sides of flippable polaroids mounted during the animation and only swapping face visibility at the midpoint, so front photos no longer disappear and re-render when cards flip.
- Applied the same no-fade photo rendering to the remaining non-flipping polaroid components, so carousel cards and the user profile hero card no longer use the default image fade-in that made the photos feel less like physical instant photos.
- Chose not to add literal inline documentation to every function and every JSX container across the app, because that would add high-noise comments that quickly go stale; prefer file-level docs, exported API docs, and comments only around non-obvious logic.
- Smoothed the polaroid developing effect by replacing the abrupt late-stage tint threshold with continuous easing curves and updating the on-screen cure state more frequently, so cards no longer jump from dark to beige to fully developed in visible steps.
- Made the developing effect more dramatic while shortening the full cure window from five minutes to two, so fresh polaroids stay richly dark at first, bloom with a warmer chemistry tint through the middle, and finish developing much sooner.
- Added a stronger opening “almost black” hold plus a subtle blur that clears on the same shared cure curve, so fresh polaroids now feel like they emerge from chemistry and come into focus rather than simply fading an overlay away.
- Moved the “Developing…” status text out of the polaroid shell and into a separate line beneath the card, so developing cards no longer grow taller just because the status is visible.
- Reduced the reserved space beneath the active friends carousel card so the large name/subtitle block sits closer to the card instead of floating too far below it.
- Added more space between the carousel indicator row and the top of the active polaroid so the numbered dots and position text don’t feel too cramped against the card.
- Changed the friends screen controls so the floating Add Friend button and the floating hamburger/notifications shortcuts now appear when scrolling up and hide when scrolling down, with only the button itself pinned instead of a full sticky footer bar.
- Added a reusable scroll-up floating header mode to `AppScreen` and applied it across the app screens that use back/edit-style top controls, so those buttons now hide on downward scroll and reappear when scrolling up instead of staying permanently pinned.
- Corrected the shared floating back/edit header positioning to respect the device's top safe-area inset, so the overlay row no longer sits too high under the status bar/notch.
- Removed the duplicate in-content menu/notifications row from the friends home screen and kept only the floating top controls, with a spacer preserving the original layout so the title/search area does not jump upward under the overlay.
- Updated `WallPostCard` to accept a per-profile color palette override and wired the contact profile and view-your-wall screens to pass their selected profile background colors, so memory details like the date accent, share icon, muted labels, and text-only note chrome now match the person's chosen profile background instead of the global app theme.
- Followed that card-palette work by updating the remaining memory date surfaces in `WallPostCard` so the text-only date line and the optional photo date stamp also use the selected profile palette instead of a fixed muted/global color.
- Extended the same palette override approach to the shared month-scrollable memory wall components and passed the selected profile colors from the contact profile and view-your-wall screens, so the scrolling month chips, sticky month label, and day-group date headers also match the person's profile background instead of the app theme.
- Nudged the friends carousel unread notification badge farther outward so it now sits right on the top-right tip of the polaroid card instead of slightly inset from the corner.
- Added extra top padding and reserved height to the carousel list container so the unread badge can keep that tip-of-card position and size without getting clipped by the parent at the top edge.
- Redesigned the friends screen Add Note and Add Polaroid shortcuts into larger circular icon-only actions with filled symbols, removing the text labels while keeping the same behaviors and accessibility labels.
- Confirmed that slight pixel stepping on tilted card image borders is an expected rasterization artifact in the current implementation because the polaroid card and inner photo frame are rotated while using very thin borders (`StyleSheet.hairlineWidth`), which makes diagonal edges anti-alias visibly.
- Applied the border-cleanup pass to the app's tilted polaroid/photo-frame surfaces by softening the inner photo border, increasing it from `hairlineWidth` to `1`, and slightly overscanning the images with a small scale so diagonal photo edges look less jagged when cards are tilted.
- Fixed the front-face polaroid footers so adding note text no longer makes the cards taller: `WallPostCard`, the friends carousel cards, the contact profile hero card, the wall/profile-of-you hero card, and the contact edit preview now reserve a fixed two-line note slot and keep a consistent front height.
- Raised the back button on the notifications screen by tightening the floating top bar's vertical padding and adding an explicit spacer above the "Notifications" title, so the Back row no longer overlaps the large title when the screen opens as a modal.
- Added a global in-app notification toast system: new `InAppNotificationProvider` mounted inside the authenticated app layout watches `useSocialGraph().notifications`, and whenever a new unread notification arrives on any authenticated screen it animates a top-anchored toast card in from under the safe-area, auto-dismisses after 4s, supports tap-to-navigate (wall post or friend profile) with mark-as-read, and supports swipe-up to dismiss. Toasts are suppressed while the user is already on the notifications screen so they don't double-notify.
- Made the profile background picker on `app/(app)/profiles/contact/edit.tsx` preview themes live: tapping a swatch now immediately recolors the edit screen's gradient and UI chrome and swaps the heading/body fonts to the chosen theme's font set, while polaroid preview text stays on the handwritten (Caveat) font. Applied the same theme-font override to the contact profile view (`profiles/contact/[contactId].tsx`) and view-your-wall (`wall/[authorId].tsx`) screens so non-polaroid surfaces on a themed profile use that theme's font set alongside the already-themed palette.
- Made the contact profile's edit-mode fact input follow the selected profile theme instead of the app theme: the "Add a fact…" TextInput placeholder and the fact-chip delete icon now use `effectiveColors` (the profileBg-derived palette), matching the rest of the themed chrome on the profile.
- Rebuilt the contact profile hero-card flip to eliminate the mid-flip "ghost" image: replaced the two-phase 0→90°→0° rotation and state-swap-at-midpoint with a single continuous 0→180° rotation driving both faces (front `rotateY` 0°→180°, back `rotateY` 180°→360°) and set `backfaceVisibility: 'hidden'` on each face, so whichever side is facing away is cleanly hidden on every frame instead of lingering through the swap.
- Applied the same continuous-rotation fix to the view-your-wall (`wall/[authorId].tsx`) hero card: single 0°→180° rotation with a counter-rotated back face and `backfaceVisibility: 'hidden'`, removing the brief ghosted image on flip.
- Disabled carousel looping on the friends home screen while a search query is active: `PolaroidCarousel` now takes an optional `loop` prop (defaults to true) and, when false or when there's only one item, renders the list once instead of triplicating it and skips the wraparound snap-back in `onMomentumScrollEnd`. The friends screen passes `loop={!query}` and keys the carousel by search-state so switching between search and non-search cleanly re-initializes the scroll position.
- Fixed an empty gap appearing above the keyboard on scrollable screens (e.g. the friends search bar): `AppScreen` was using `KeyboardAvoidingView` with `behavior="padding"` while the inner `ScrollView` already set `automaticallyAdjustKeyboardInsets`, which double-padded the layout. `behavior` is now only set for non-scroll screens; scrollable screens rely on iOS's native contentInset handling, so the blank panel under the field is gone while inputs still stay visible above the keyboard.
- Removed the solid `canvas` background from the memory wall's sticky month header so the label blends into the scrolling content instead of flashing a flat color panel as posts scroll under it.
- Moved the tape strip inside the flipping front face on the contact profile and view-your-wall hero cards so the tape rotates with the card during the flip instead of staying fixed in place and visually intersecting the rotated card.
- Also rendered the tape strip inside the back face on both flipping hero cards so the tape appears on whichever side is showing and flips along with the card.
- Fixed "Rendered fewer hooks than expected" crash on sign-out: moved all hook calls above the `if (!currentUser) return <Redirect />` (and related loading/not-found) guards in app/(app)/friends/index.tsx, app/(app)/wall/[authorId].tsx, and app/(app)/profiles/contact/[contactId].tsx. Derived values (e.g. wallPosts, monthWall) now compute unconditionally with safe optional-chained inputs so React sees a stable hook count across renders, then the guards run just before the JSX return.
- Switched friend-code sharing to a real shareable invite deep link (`yourfriends://add-friend?code=...`) across the existing friend-code surfaces. The app now parses plain codes, QR payloads, and shared invite links through the same helper so shared links open the add-friend screen with the code prefilled
