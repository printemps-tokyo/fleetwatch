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
});

describe("renderJson", () => {
  it("emits panes (blocked first) and a summary", () => {
    const parsed = JSON.parse(renderJson(rows));
    expect(parsed.panes[0].state).toBe("blocked");
    expect(parsed.summary.blocked).toBe(1);
  });
});
