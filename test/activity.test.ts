import { describe, expect, it } from "vitest";
import { hashText, updateActivity, quietMs, type ActivityTracker } from "../src/activity.js";

describe("hashText", () => {
  it("is stable and distinguishes different text", () => {
    expect(hashText("abc")).toBe(hashText("abc"));
    expect(hashText("abc")).not.toBe(hashText("abd"));
  });
});

describe("updateActivity / quietMs", () => {
  it("measures how long content has been unchanged", () => {
    let a: ActivityTracker = updateActivity(new Map(), [{ key: "p", hash: "h1" }], 1000);
    a = updateActivity(a, [{ key: "p", hash: "h1" }], 7000); // same content
    expect(quietMs(a, "p", 7000)).toBe(6000);
  });

  it("resets the clock when content changes", () => {
    let a: ActivityTracker = updateActivity(new Map(), [{ key: "p", hash: "h1" }], 1000);
    a = updateActivity(a, [{ key: "p", hash: "h2" }], 7000); // new content
    expect(quietMs(a, "p", 7000)).toBe(0);
  });

  it("returns undefined for an unknown pane", () => {
    expect(quietMs(new Map(), "nope", 1000)).toBeUndefined();
  });
});
