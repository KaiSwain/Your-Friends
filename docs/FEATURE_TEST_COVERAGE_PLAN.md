# Feature Test Coverage Plan

This checklist tracks the test suite needed before App Store release. Prefer focused unit and integration tests for business logic, plus a small manual/real-device smoke pass for camera, microphone, purchases, and push notifications.

## Current Automated Coverage

- Auth/profile data mapping and social graph selectors.
- Friend codes, referrals, Premium QR grant helpers.
- Calendar mapping, occurrences, and reminders.
- Birthday moments.
- Memory prompt seed data/helpers.
- Movie, gift, memory prompt, and social mappers.
- Friendship recaps.
- Memory location formatting/search.
- Memory card developing behavior.
- Music link generation.
- Memory media upload hardening, including voice upload retries and MIME types.

## High-Priority Automated Tests To Add

- Auth: sign-up profile defaults, profile updates, delete-account request behavior, Apple auth error handling.
- Friends: add by code, pending requests, accept/decline, link manual contact, remove friend, duplicate/candidate contacts.
- Memory creation: note, Memory Card, live video card, regular media, song, movie, gift note, voice attachment, multi-target posting.
- Voice: recorder state transitions, re-record/remove behavior, prompt voice persistence, reply voice persistence, playback error states.
- Prompts: request song/text/photo/movie, optimistic create, cancel, response validation, complete response creates correct wall post.
- Premium: free vs Premium gates, gallery/media/gift access, theme unlocks, Premium QR only for already-connected friends.
- Notifications: route resolution, mark-one-read, mark-all-read, stale wall-post notification navigation.
- Profiles/walls: facts, personality traits, profile wall pins, filter chips, replies preview, private vs visible wall posts.
- Calendar: event create/update/delete, shared events, birthday reminders, Premium reminder gating.
- Store/subscriptions: product display fallback, purchase/restore error states, subscription validation result handling.
- Onboarding: route progression, paywall dismiss to free-features, profile photo/facts/traits persistence.

## Manual Real-Device Smoke Tests

- Camera capture for Memory Card and regular media.
- Live video capture and playback.
- Voice recording, save, app restart while pending, upload, wall playback.
- Gallery permission denied/allowed flows.
- Apple Sign In.
- In-app purchase sandbox purchase and restore.
- Push notification receipt and tap-through routing.
- Account deletion.

## Release Rule

Before App Store submission, run:

```sh
npm run typecheck
npm test
npm run test:integration
```

Then complete the manual smoke tests on a physical iPhone/TestFlight build.
