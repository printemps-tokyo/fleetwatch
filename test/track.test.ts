import { describe, expect, it } from "vitest";
import { updateTracker, elapsedMs, humanizeDuration, parseDuration, type Tracker } from "../src/track.js";

describe("updateTracker", () => {
  it("stamps new panes with the current time", () => {
    const t = updateTracker(new Map(), [{ key: "a", state: "working" }], 1000);
    expect(elapsedMs(t, "a", 1000)).toBe(0);
    expect(elapsedMs(t, "a", 4000)).toBe(3000);
  });

  it("keeps the start time while the state is unchanged", () => {
    let t: Tracker = updateTracker(new Map(), [{ key: "a", state: "blocked" }], 1000);
    t = updateTracker(t, [{ key: "a", state: "blocked" }], 5000);
    expect(elapsedMs(t, "a", 5000)).toBe(4000); // measured from the first sighting
  });

  it("resets the start time when the state changes", () => {
    let t: Tracker = updateTracker(new Map(), [{ key: "a", state: "working" }], 1000);
    t = updateTracker(t, [{ key: "a", state: "blocked" }], 5000);
    expect(elapsedMs(t, "a", 5000)).toBe(0);
  });

  it("drops panes that are no longer present", () => {
    let t: Tracker = updateTracker(new Map(), [{ key: "a", state: "idle" }], 1000);
    t = updateTracker(t, [{ key: "b", state: "idle" }], 2000);
    expect(elapsedMs(t, "a", 2000)).toBeUndefined();
    expect(elapsedMs(t, "b", 2000)).toBe(0);
  });
});

describe("humanizeDuration", () => {
  it("formats seconds, minutes, and hours compactly", () => {
    expect(humanizeDuration(45_000)).toBe("45s");
    expect(humanizeDuration(12 * 60_000)).toBe("12m");
    expect(humanizeDuration(63 * 60_000)).toBe("1h3m");
    expect(humanizeDuration(120 * 60_000)).toBe("2h");
  });
});

describe("parseDuration", () => {
  it("parses s/m/h, defaulting a bare number to minutes", () => {
    expect(parseDuration("90s")).toBe(90_000);
    expect(parseDuration("10m")).toBe(600_000);
    expect(parseDuration("1h")).toBe(3_600_000);
    expect(parseDuration("10")).toBe(600_000);
    expect(() => parseDuration("soon")).toThrow();
  });
});
