jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    multiSet: jest.fn(async () => undefined),
  },
}));

jest.mock('expo-store-review', () => ({
  __esModule: true,
  hasAction: jest.fn(async () => true),
  requestReview: jest.fn(async () => undefined),
}));

import {
  shouldPromptForReview,
  MIN_POSITIVE_ACTIONS,
  MIN_DAYS_BETWEEN_PROMPTS,
  MAX_PROMPTS,
  type ReviewState,
} from '../appReview';

const NOW = Date.parse('2026-06-21T00:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function state(overrides: Partial<ReviewState> = {}): ReviewState {
  return {
    positiveActions: MIN_POSITIVE_ACTIONS,
    promptCount: 0,
    lastPromptAt: null,
    ...overrides,
  };
}

describe('shouldPromptForReview', () => {
  it('prompts once the user has enough positive actions and has never been asked', () => {
    expect(shouldPromptForReview(state(), NOW)).toBe(true);
  });

  it('does not prompt before the minimum positive actions', () => {
    expect(shouldPromptForReview(state({ positiveActions: MIN_POSITIVE_ACTIONS - 1 }), NOW)).toBe(false);
  });

  it('does not prompt once the max prompt count is reached', () => {
    expect(shouldPromptForReview(state({ promptCount: MAX_PROMPTS }), NOW)).toBe(false);
  });

  it('does not prompt again within the spacing window', () => {
    const recently = NOW - (MIN_DAYS_BETWEEN_PROMPTS - 1) * DAY_MS;
    expect(shouldPromptForReview(state({ promptCount: 1, lastPromptAt: recently }), NOW)).toBe(false);
  });

  it('prompts again after the spacing window has elapsed', () => {
    const longAgo = NOW - (MIN_DAYS_BETWEEN_PROMPTS + 1) * DAY_MS;
    expect(shouldPromptForReview(state({ promptCount: 1, lastPromptAt: longAgo }), NOW)).toBe(true);
  });
});
