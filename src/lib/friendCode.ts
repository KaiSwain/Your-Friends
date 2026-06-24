// Store the allowed characters for friend codes in one place so generation stays consistent.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Export a helper that cleans up user input before the app compares or stores a friend code.
export function normalizeFriendCode(value: string) {
  // Remove anything that is not a letter or number, then force the result to uppercase.
  return value.replace(/[^a-z0-9]/gi, '').toUpperCase();
} // End normalizeFriendCode after returning the cleaned code.

// Reserved route segments that must never be treated as a friend code if they
// show up as the path of a deep link (e.g. `yourfriends://add-friend` on cold
// start — without this guard `normalizeFriendCode` would happily return
// "ADDFRIEND" and pop the add-friend modal with a bogus auto-filled code).
const RESERVED_DEEP_LINK_PATHS = new Set([
  'add-friend',
  'addfriend',
  'add',
  'friend',
  'friends',
  'invite',
  'notifications',
  'home',
]);

// Extract a friend code from plain text, QR payloads, or shareable deep links.
export function extractFriendCode(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const queryMatch = trimmed.match(/[?&]code=([^&#]+)/i);
  if (queryMatch?.[1]) {
    return normalizeFriendCode(decodeURIComponent(queryMatch[1]));
  }

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed);
  if (hasScheme) {
    // For URLs we will only treat a single path segment as a friend code, and
    // we ignore reserved route names. Anything else (Expo dev URLs, push
    // notification deep links, malformed shares) returns empty so the deep
    // link handler does nothing.
    const withoutScheme = trimmed
      .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
      .replace(/^\/+/, '');
    const pathParts = withoutScheme.split(/[/?#]/).filter(Boolean);
    // A real friend-code segment is alphanumeric (with optional dashes for
    // human-friendly formatting). Reject anything containing dots or colons,
    // which are typical of host:port or IP addresses (e.g. the Expo dev
    // launch URL `exp://192.168.1.50:8081`).
    if (
      pathParts.length === 1 &&
      !RESERVED_DEEP_LINK_PATHS.has(pathParts[0].toLowerCase()) &&
      /^[A-Za-z0-9-]+$/.test(pathParts[0])
    ) {
      return normalizeFriendCode(pathParts[0]);
    }
    return '';
  }

  // Plain typed text or pasted code — strip non-alphanumerics and uppercase.
  return normalizeFriendCode(trimmed);
} // End extractFriendCode after returning the best available code candidate.

// Public web base used for shareable invite links. This is a Universal Link
// (https) so it works for people who DON'T have the app yet: it opens the app
// when installed, otherwise it lands on yourfriendsapp.com which routes to the
// App Store. The in-app deep-link handler still understands this URL via
// extractFriendCode, and the legacy `yourfriends://` scheme keeps working too.
export const INVITE_LINK_BASE_URL = 'https://yourfriendsapp.com/add-friend';

// Build the canonical shareable link used when sharing friend invites.
export function createFriendInviteLink(friendCode: string) {
  const normalized = normalizeFriendCode(friendCode);
  if (!normalized) return INVITE_LINK_BASE_URL;
  return `${INVITE_LINK_BASE_URL}?code=${encodeURIComponent(normalized)}`;
} // End createFriendInviteLink after returning the invite link.

// Export a helper that generates an 8-character friend code from a stable seed value.
export function createFriendCode(seed: string, existingCodes: string[]) {
  // Convert the existing code list into a Set so duplicate checks are fast.
  const usedCodes = new Set(existingCodes);
  // Start the retry counter at zero so each failed attempt can generate a new variation.
  let attempt = 0;

  // Keep trying until we either find an unused code or hit the safety limit.
  while (attempt < 1000) {
    // Start with an empty string and build the friend code one character at a time.
    let friendCode = '';

    // Run exactly eight times because a friend code in this app is always 8 characters long.
    for (let index = 0; index < 8; index += 1) {
      // Hash each position independently (seed + attempt + index) so every
      // character draws from its own entropy. This yields the full 32^8 code
      // space; deriving all 8 characters from a single hash would collapse the
      // space to just ALPHABET.length (32) possible codes.
      const hash = hashString(`${seed}:${attempt}:${index}`);
      // Turn the per-position hash into a valid position inside the alphabet string.
      const charIndex = hash % ALPHABET.length;
      // Append the selected character to the code we are building.
      friendCode += ALPHABET[charIndex];
    } // End the 8-step loop after all friend code characters have been added.

    // If the generated code is not already in use, we can return it immediately.
    if (!usedCodes.has(friendCode)) {
      // Send the new unique friend code back to the caller.
      return friendCode;
    } // End the success check when the generated code was already taken.

    // Move to the next attempt so the next loop iteration produces a different code.
    attempt += 1;
  } // End the retry loop after either success or exhausting the safety limit.

  // Throw an error instead of looping forever if we somehow fail too many times.
  throw new Error('Unable to generate a unique friend code.');
} // End createFriendCode after either returning a code or throwing an error.

// Keep this hashing helper private because only this file needs it.
function hashString(value: string) {
  // Use FNV-1a as the base hash because it folds every byte into the result.
  let hash = 0x811c9dc5; // FNV offset basis (2166136261).
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193); // Multiply by the FNV prime (16777619).
  }

  // Apply MurmurHash3's finalizer so the low bits avalanche. The plain
  // multiply-by-31 hash this replaced had almost no entropy in its low 5 bits,
  // which made `hash % ALPHABET.length` collapse to a handful of distinct codes.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;

  // Return an unsigned 32-bit integer to the caller.
  return hash >>> 0;
} // End hashString after computing the final hash value.