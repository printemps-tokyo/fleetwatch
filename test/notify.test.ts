import { describe, expect, it } from "vitest";
import { notifyEnv } from "../src/notify.js";
import type { Row } from "../src/render.js";

describe("notifyEnv", () => {
  it("exposes pane details as FW_* variables", () => {
    const row: Row = {
      target: "7:12.1",
      id: "%37",
      project: "rive",
      state: "blocked",
      reason: "sign-in prompt",
      category: "auth",
    };
    expect(notifyEnv(row)).toEqual({
      FW_TARGET: "7:12.1",
      FW_ID: "%37",
      FW_PROJECT: "rive",
      FW_STATE: "blocked",
      FW_REASON: "sign-in prompt",
      FW_CATEGORY: "auth",
    });
  });

  it("uses empty strings for missing id/category", () => {
    const row: Row = { target: "1:0.0", project: "x", state: "idle", reason: "waiting for input" };
    const env = notifyEnv(row);
    expect(env.FW_ID).toBe("");
    expect(env.FW_CATEGORY).toBe("");
  });
});
