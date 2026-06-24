import { beforeAll, describe, expect, it } from '@jest/globals';

import { captureException, captureWarning, initErrorReporting, setErrorReportingUser } from '../errorReporting';

// React Native defines __DEV__ globally; tests run in Node where it is absent.
beforeAll(() => {
  (globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;
});

describe('errorReporting with no DSN configured', () => {
  it('initializes without throwing and stays a no-op', () => {
    expect(() => initErrorReporting()).not.toThrow();
    // Calling twice should be safe (guarded by the initialized flag).
    expect(() => initErrorReporting()).not.toThrow();
  });

  it('captureException never throws', () => {
    expect(() => captureException(new Error('boom'), { from: 'test' })).not.toThrow();
    expect(() => captureException('a string error')).not.toThrow();
  });

  it('captureWarning never throws', () => {
    expect(() => captureWarning('heads up', { from: 'test' })).not.toThrow();
  });

  it('setErrorReportingUser is a no-op without Sentry', () => {
    expect(() => setErrorReportingUser('user-1')).not.toThrow();
    expect(() => setErrorReportingUser(null)).not.toThrow();
  });
});
