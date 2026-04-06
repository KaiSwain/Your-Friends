// Keep a module-level counter so repeated calls in the same session can still produce different IDs.
let sequence = 0;

// Export a helper that creates a compact client-side identifier using a prefix, timestamp, and counter.
export function createClientId(prefix: string) {
  // Increase the counter first so each new ID from this session stays unique.
  sequence += 1;

  // Return a string that combines the caller's prefix, the current time, and the sequence number.
  return `${prefix}_${Date.now().toString(36)}_${sequence.toString(36)}`;
} // End createClientId after returning the generated client ID.