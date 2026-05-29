import type { Href, Router } from 'expo-router';

const DEFAULT_NAVIGATION_GUARD_MS = 900;

type PushOptions = Parameters<Router['push']>[1];
type ReplaceOptions = Parameters<Router['replace']>[1];
type DismissToOptions = Parameters<Router['dismissTo']>[1];
type NavigateOptions = Parameters<Router['navigate']>[1];

let lastNavigationKey: string | null = null;
let lastNavigationAt = 0;

export function getNavigationKey(href: Href): string {
  if (typeof href === 'string') return href;

  const params = href.params
    ? Object.entries(href.params)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : String(value)}`)
      .join('&')
    : '';

  return params ? `${href.pathname}?${params}` : href.pathname;
}

export function pushOnce(router: Pick<Router, 'push'>, href: Href, options?: PushOptions): boolean {
  if (!claimNavigation(`push:${getNavigationKey(href)}`)) {
    return false;
  }

  router.push(href, options);
  return true;
}

export function replaceOnce(router: Pick<Router, 'replace'>, href: Href, options?: ReplaceOptions): boolean {
  if (!claimNavigation(`replace:${getNavigationKey(href)}`)) {
    return false;
  }

  router.replace(href, options);
  return true;
}

export function navigateOnce(router: Pick<Router, 'navigate'>, href: Href, options?: NavigateOptions): boolean {
  if (!claimNavigation(`navigate:${getNavigationKey(href)}`)) {
    return false;
  }

  router.navigate(href, options);
  return true;
}

export function dismissToOnce(router: Pick<Router, 'dismissTo'>, href: Href, options?: DismissToOptions): boolean {
  if (!claimNavigation(`dismissTo:${getNavigationKey(href)}`)) {
    return false;
  }

  router.dismissTo(href, options);
  return true;
}

export function backOnce(router: Pick<Router, 'back'>): boolean {
  if (!claimNavigation('back')) {
    return false;
  }

  router.back();
  return true;
}

export function shouldPopForBackTarget(href: string | null | undefined): boolean {
  if (!href) return false;
  const path = href.split('?')[0] ?? href;
  return path.startsWith('/(app)/profiles/')
    || path.startsWith('/profiles/')
    || path.startsWith('/(app)/wall/')
    || path.startsWith('/wall/');
}

export function backOrReplaceOnce(
  router: Pick<Router, 'back' | 'replace'> & { canGoBack?: () => boolean },
  href: Href,
  options?: ReplaceOptions,
): boolean {
  if (router.canGoBack?.()) {
    return backOnce(router);
  }
  return replaceOnce(router, href, options);
}

function claimNavigation(key: string): boolean {
  const now = Date.now();

  if (lastNavigationKey === key && now - lastNavigationAt < DEFAULT_NAVIGATION_GUARD_MS) {
    return false;
  }

  lastNavigationKey = key;
  lastNavigationAt = now;
  return true;
}

export function resetNavigationGuardForTests() {
  lastNavigationKey = null;
  lastNavigationAt = 0;
}
