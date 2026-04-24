// Store the allowed characters for friend codes in one place so generation stays consistent.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

// Export a helper that cleans up user input before the app compares or stores a friend code.
export function normalizeFriendCode(value: string) {
  // Remove anything that is not a letter or number, then force the result to uppercase.
  return value.replace(/[^a-z0-9]/gi, '').toUpperCase();
} // End normalizeFriendCode after returning the cleaned code.

// Extract a friend code from plain text, QR payloads, or shareable deep links.
export function extractFriendCode(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  const queryMatch = trimmed.match(/[?&]code=([^&#]+)/i);
  if (queryMatch?.[1]) {
    return normalizeFriendCode(decodeURIComponent(queryMatch[1]));
  }

  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^\/+/, '');
  const pathParts = withoutScheme.split(/[/?#]/).filter(Boolean);
  if (pathParts.length === 1) {
    return normalizeFriendCode(pathParts[0]);
  }

  return normalizeFriendCode(trimmed);
} // End extractFriendCode after returning the best available code candidate.

// Build the canonical deep link used when sharing friend invites.
export function createFriendInviteLink(friendCode: string) {
  const normalized = normalizeFriendCode(friendCode);
  if (!normalized) return 'yourfriends://add-friend';
  return `yourfriends://add-friend?code=${encodeURIComponent(normalized)}`;
} // End createFriendInviteLink after returning the deep link.

// Export a helper that generates an 8-character friend code from a stable seed value.
export function createFriendCode(seed: string, existingCodes: string[]) {
  // Convert the existing code list into a Set so duplicate checks are fast.
  const usedCodes = new Set(existingCodes);
  // Start the retry counter at zero so each failed attempt can generate a new variation.
  let attempt = 0;

  // Keep trying until we either find an unused code or hit the safety limit.
  while (attempt < 1000) {
    // Combine the seed and the current attempt so retries produce different hashes.
    const hash = hashString(`${seed}:${attempt}`);
    // Start with an empty string and build the friend code one character at a time.
    let friendCode = '';

    // Run exactly eight times because a friend code in this app is always 8 characters long.
    for (let index = 0; index < 8; index += 1) {
      // Turn the hash and loop index into a valid position inside the alphabet string.
      const charIndex = (hash + index * 17) % ALPHABET.length;
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
  // Start the running hash value at zero before processing the input string.
  let hash = 0;

  // Visit each character in the string so we can fold it into the running hash.
  for (const character of value) {
    // Multiply the current hash, add the character code, and force the result to stay unsigned.
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  } // End the character loop after every character has contributed to the hash.

  // Return the finished numeric hash to the caller.
  return hash;
} // End hashString after computing the final hash value.