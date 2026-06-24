import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

// Persisted gating state lives in AsyncStorage under these keys.
const POSITIVE_ACTIONS_KEY = 'yourfriends:review:positiveActions';
const LAST_PROMPT_KEY = 'yourfriends:review:lastPromptAt';
const PROMPT_COUNT_KEY = 'yourfriends:review:promptCount';

// How many delightful actions a user should take before we ever ask. Asking
// too early (e.g. on first launch) wastes one of Apple's limited prompts on a
// user who hasn't experienced the app's value yet.
export const MIN_POSITIVE_ACTIONS = 3;
// Minimum spacing between prompts. Apple itself caps the system sheet to ~3 per
// 365 days, but we space ours out so we never nag.
export const MIN_DAYS_BETWEEN_PROMPTS = 120;
// Never ask more than this many times total from our side.
export const MAX_PROMPTS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReviewState {
  positiveActions: number;
  promptCount: number;
  lastPromptAt: number | null;
}

// Pure decision function so the gating rules can be unit-tested without touching
// AsyncStorage or the native StoreReview module.
export function shouldPromptForReview(state: ReviewState, now: number): boolean {
  if (state.positiveActions < MIN_POSITIVE_ACTIONS) return false;
  if (state.promptCount >= MAX_PROMPTS) return false;
  if (state.lastPromptAt && now - state.lastPromptAt < MIN_DAYS_BETWEEN_PROMPTS * DAY_MS) {
    return false;
  }
  return true;
}

function parseCount(raw: string | null): number {
  const value = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

async function loadReviewState(): Promise<ReviewState> {
  const [actionsRaw, countRaw, lastRaw] = await Promise.all([
    AsyncStorage.getItem(POSITIVE_ACTIONS_KEY),
    AsyncStorage.getItem(PROMPT_COUNT_KEY),
    AsyncStorage.getItem(LAST_PROMPT_KEY),
  ]);
  const lastPromptAt = lastRaw ? parseInt(lastRaw, 10) : null;
  return {
    positiveActions: parseCount(actionsRaw),
    promptCount: parseCount(countRaw),
    lastPromptAt: lastPromptAt && Number.isFinite(lastPromptAt) ? lastPromptAt : null,
  };
}

// Evaluate the gating rules and, if eligible, ask the OS to show its native
// review sheet. Everything is best-effort: failures (no store, offline, native
// module missing) are swallowed so this can be safely fire-and-forget.
export async function maybeRequestReview(): Promise<void> {
  try {
    // `hasAction` is false on platforms/devices where review isn't available
    // (e.g. simulators without the App Store, or unsupported environments).
    const available = await StoreReview.hasAction();
    if (!available) return;

    const state = await loadReviewState();
    if (!shouldPromptForReview(state, Date.now())) return;

    await StoreReview.requestReview();

    // Record that we asked. Note the OS may have chosen not to actually display
    // the sheet, but it gives us no signal either way, so we treat a request as
    // a prompt for spacing purposes — this is the standard, Apple-sanctioned
    // approach.
    await AsyncStorage.multiSet([
      [LAST_PROMPT_KEY, String(Date.now())],
      [PROMPT_COUNT_KEY, String(state.promptCount + 1)],
    ]);
  } catch {
    // Best-effort only — never let a review prompt break a user flow.
  }
}

// Increment the count of delightful actions and, once the user has done enough
// of them, attempt a review prompt shortly afterward. The delay lets the
// triggering UI (save confirmation, navigation, polaroid animation) settle so
// the system sheet never interrupts an in-progress task.
export async function recordReviewableMoment(delayMs = 2500): Promise<void> {
  try {
    const current = parseCount(await AsyncStorage.getItem(POSITIVE_ACTIONS_KEY));
    await AsyncStorage.setItem(POSITIVE_ACTIONS_KEY, String(current + 1));
  } catch {
    // Ignore — a missed increment just delays the prompt slightly.
  }

  setTimeout(() => {
    void maybeRequestReview();
  }, delayMs);
}
