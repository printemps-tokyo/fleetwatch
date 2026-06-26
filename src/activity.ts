/**
 * Detect a pane that is wedged by watching whether its output changes at all.
 *
 * The regex classifier can only recognize prompts it knows; a pane stuck in a
 * way it does not anticipate (a hung tool call, an unusually-worded question, a
 * half-rendered screen) stays `working`/`unknown` and raises no alarm. This
 * module closes that gap: it hashes each pane's captured text per poll and
 * tracks how long the hash has been unchanged, so "no output for 12m" can be
 * surfaced regardless of classification. Like `track`, it is a pure,
 * clock-injected reducer with no IO.
 */

/** A fast, stable 32-bit FNV-1a hash of the captured text. */
export function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

export interface ActivitySample {
  key: string;
  hash: string;
}

interface Entry {
  hash: string;
  sinceMs: number;
}

export type ActivityTracker = Map<string, Entry>;

/** Fold the latest content hashes in, resetting the clock when content changes. */
export function updateActivity(prev: ActivityTracker, samples: ActivitySample[], nowMs: number): ActivityTracker {
  const next: ActivityTracker = new Map();
  for (const s of samples) {
    const before = prev.get(s.key);
    next.set(s.key, before && before.hash === s.hash ? before : { hash: s.hash, sinceMs: nowMs });
  }
  return next;
}

/** Milliseconds a pane's output has been unchanged, or undefined if unknown. */
export function quietMs(tracker: ActivityTracker, key: string, nowMs: number): number | undefined {
  const entry = tracker.get(key);
  return entry ? Math.max(0, nowMs - entry.sinceMs) : undefined;
}
