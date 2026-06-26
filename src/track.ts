/**
 * Track how long each pane has been in its current state, across watch polls.
 *
 * This is a pure reducer: feed it the previous tracker, the latest samples, and
 * the current time, and it returns a new tracker that remembers when each pane
 * last changed state. That lets the watch view show "BLOCKED 12m" so the pane
 * that has been stuck longest stands out. No clock or IO lives here — the time
 * is passed in — so it is fully unit-testable.
 */

import type { PaneState } from "./classify.js";

export interface Sample {
  key: string;
  state: PaneState;
}

interface Entry {
  state: PaneState;
  sinceMs: number;
}

export type Tracker = Map<string, Entry>;

/** Fold the latest samples into the tracker, resetting the clock on a change. */
export function updateTracker(prev: Tracker, samples: Sample[], nowMs: number): Tracker {
  const next: Tracker = new Map();
  for (const s of samples) {
    const before = prev.get(s.key);
    next.set(s.key, before && before.state === s.state ? before : { state: s.state, sinceMs: nowMs });
  }
  return next;
}

/** Milliseconds a pane has held its current state, or undefined if unknown. */
export function elapsedMs(tracker: Tracker, key: string, nowMs: number): number | undefined {
  const entry = tracker.get(key);
  return entry ? Math.max(0, nowMs - entry.sinceMs) : undefined;
}

/** Parse a duration like "90s", "10m", "1h" (bare number = minutes) into ms. */
export function parseDuration(value: string): number {
  const m = /^(\d+)\s*(s|m|h)?$/.exec(value.trim());
  if (!m) {
    throw new Error(`invalid duration "${value}" (use e.g. 90s, 10m, 1h)`);
  }
  const n = Number(m[1]);
  const unit = m[2] ?? "m";
  const mult = unit === "s" ? 1000 : unit === "h" ? 3_600_000 : 60_000;
  return n * mult;
}

/** Compact duration like "45s", "12m", "1h3m". */
export function humanizeDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem > 0 ? `${hours}h${rem}m` : `${hours}h`;
}
