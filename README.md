# YourFriends

Expo Router mobile app for relationship memories, friends, contacts, and Supabase-backed auth/data.

## App Environment

This project is set up to run with:

- Node `v22.17.1` via `nvm`
- npm
- Expo SDK 54
- Supabase public env vars loaded from `.env`

## Setup

```bash
nvm use
npm install
cp .env.example .env
```

Then set these values in `.env`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Start The App

Standard start:

```bash
npm run start
```

Tunnel start:

```bash
npm run start:tunnel
```

If tunnel mode is unstable in WSL, use:

```bash
env -u ANDROID_HOME -u ANDROID_SDK_ROOT npx expo start --tunnel --clear
```

## Validation

Type check the app with:

```bash
npm run typecheck
```

## Code Documentation

Junior-friendly code documentation lives here:

- `docs/CODEBASE_TOUR.md` for the architecture overview
- `docs/FILE_REFERENCE.md` for the file-by-file walkthrough