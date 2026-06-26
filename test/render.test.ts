import { describe, expect, it } from "vitest";
import { renderTable, renderJson, sortRows, summarize, type Row } from "../src/render.js";

const rows: Row[] = [
  { target: "7:9.1", project: "p5js", state: "working", reason: "generating" },
  { target: "7:12.1", project: "rive", state: "blocked", reason: "sign-in prompt", category: "auth" },
  { target: "7:7.1", project: "printemps.tokyo", state: "idle", reason: "waiting for input" },
];

describe("sortRows / summarize", () => {
  it("puts blocked first and counts states", () => {
    expect(sortRows(rows).map((r) => r.state)).toEqual(["blocked", "idle", "working"]);
    expect(summarize(rows)).toMatchObject({ working: 1, blocked: 1, idle: 1 });
  });
});

describe("renderTable", () => {
  it("renders a row per pane and a summary (no color)", () => {
    const out = renderTable(rows, false);
    expect(out).toContain("rive");
    expect(out).toContain("BLOCKED");
    expect(out).toContain("[auth] sign-in prompt");
    expect(out).toContain("3 panes");
    expect(out).toContain("1 BLOCKED");
    expect(out).not.toContain("\x1b[");
  });

  it("handles no panes", () => {
    expect(renderTable([], false)).toContain("no Claude Code panes found");
  });

  it("shows an age column when rows carry one (watch mode)", () => {
    const withAge: Row[] = [{ target: "7:12.1", project: "rive", state: "blocked", reason: "sign-in prompt", category: "auth", age: "12m" }];
    expect(renderTable(withAge, false)).toContain("12m");
  });

  it("annotates and prioritizes a stuck pane", () => {
    const rs: Row[] = [
      { target: "7:1.1", project: "a", state: "idle", reason: "waiting for input" },
      { target: "7:2.1", project: "b", state: "working", reason: "generating", age: "15m", stuck: true },
    ];
    const out = renderTable(rs, false);
    expect(out).toContain("no output for 15m");
    // The stuck pane sorts above the healthy idle one.
    expect(out.indexOf("7:2.1")).toBeLessThan(out.indexOf("7:1.1"));
  });
});

describe("renderJson", () => {
  it("emits panes (blocked first) and a summary", () => {
    const parsed = JSON.parse(renderJson(rows));
    expect(parsed.panes[0].state).toBe("blocked");
    expect(parsed.summary.blocked).toBe(1);
    expect(parsed.generatedAt).toBeUndefined();
  });

  it("includes a generatedAt timestamp when given", () => {
    const parsed = JSON.parse(renderJson(rows, "2026-06-27T00:00:00.000Z"));
    expect(parsed.generatedAt).toBe("2026-06-27T00:00:00.000Z");
  });
});
