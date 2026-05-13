// Tiny pub/sub for handing a captured photo URI back to whichever screen opened
// the polaroid camera. We can't pass it via route params because the originating
// screen often has unsaved form state we need to preserve, so the caller stays
// mounted and just receives the URI when the camera screen pops.

type Listener = (uri: string) => void;

const listeners = new Set<Listener>();

export function postCapturedUri(uri: string): void {
  // Snapshot the current listeners so any unsubscribe during dispatch is fine.
  for (const fn of Array.from(listeners)) {
    try {
      fn(uri);
    } catch {
      // Listeners shouldn't throw; ignore if they do.
    }
  }
}

export function onCapturedUri(handler: Listener): () => void {
  listeners.add(handler);
  return () => {
    listeners.delete(handler);
  };
}
