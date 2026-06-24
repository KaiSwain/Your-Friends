// Centralized error/crash reporting.
//
// This module is a thin, dependency-optional wrapper around Sentry. It is a
// no-op until two things are true:
//   1. `@sentry/react-native` is installed, and
//   2. `EXPO_PUBLIC_SENTRY_DSN` is set in the environment.
//
// We load Sentry with `require` (not a static `import`) so the app keeps
// type-checking and building whether or not the package is installed yet.
// To turn reporting on:
//   npx expo install @sentry/react-native
//   add the "@sentry/react-native/expo" config plugin to app.json
//   set EXPO_PUBLIC_SENTRY_DSN=... (and configure source maps via EAS)

type SentryLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

interface SentryLike {
  init: (options: Record<string, unknown>) => void;
  captureException: (error: unknown, hint?: Record<string, unknown>) => void;
  captureMessage: (message: string, level?: SentryLevel) => void;
  setUser: (user: { id?: string } | null) => void;
}

let sentry: SentryLike | null = null;
let initialized = false;

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

function loadSentry(): SentryLike | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@sentry/react-native') as SentryLike;
    return mod && typeof mod.init === 'function' ? mod : null;
  } catch {
    return null;
  }
}

/**
 * Initialize crash reporting once at app startup. Safe to call unconditionally;
 * it does nothing unless a DSN is configured and the Sentry package is present.
 */
export function initErrorReporting(): void {
  if (initialized) return;
  initialized = true;
  if (!DSN) return;

  sentry = loadSentry();
  if (!sentry) return;

  sentry.init({
    dsn: DSN,
    // Keep development noise out of the Sentry dashboard.
    enabled: !__DEV__,
    debug: false,
    tracesSampleRate: 0.2,
  });

  installGlobalHandler();
}

function installGlobalHandler(): void {
  const errorUtils = (globalThis as unknown as {
    ErrorUtils?: {
      getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
      setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
    };
  }).ErrorUtils;
  if (!errorUtils?.setGlobalHandler) return;

  const previousHandler = errorUtils.getGlobalHandler?.();
  errorUtils.setGlobalHandler((error, isFatal) => {
    captureException(error, { isFatal: !!isFatal });
    previousHandler?.(error, isFatal);
  });
}

/** Report a caught exception with optional structured context. */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (sentry) {
    sentry.captureException(error, context ? { extra: context } : undefined);
    return;
  }
  if (__DEV__) {
    console.error('[error]', error, context ?? '');
  }
}

/** Report a non-fatal warning/message. */
export function captureWarning(message: string, context?: Record<string, unknown>): void {
  if (sentry) {
    sentry.captureMessage(message, 'warning');
    return;
  }
  if (__DEV__) {
    console.warn('[warn]', message, context ?? '');
  }
}

/** Associate (or clear) the current user with reported events. */
export function setErrorReportingUser(userId: string | null): void {
  if (!sentry) return;
  sentry.setUser(userId ? { id: userId } : null);
}
