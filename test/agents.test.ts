import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyPane, detectAgent, mayBeAgent } from "../src/classify.js";
import { appleScriptString, macNotificationScript, notifyEnv } from "../src/notify.js";
import { DEFAULT_MATCH } from "../src/tmux.js";
import { renderTable, type Row } from "../src/render.js";

// Screens as the Codex TUI renders them (its own snapshot tests).
const CODEX_IDLE = `
› Ask Codex to do anything

  ? for shortcuts                                                                100% context left
`;
const CODEX_WORKING = `
• Working (12s • esc to interrupt)

› Ask Codex to do anything

  ? for shortcuts                                                                 98% context left
`;
const CODEX_APPROVAL = `
  Do you want to approve network access to "example.com"?

  Reason: network request blocked

› 1. Yes, just this once (y)
  2. Yes, and allow this host for this conversation (a)
  3. Yes, and allow this host in the future (p)
  4. No, and tell Codex what to do differently (esc)

  Press enter to confirm or esc to cancel
`;
// Gemini CLI: the loading line, a tool approval, and the empty input box.
const GEMINI_WORKING = `
✦ Reading the project files (esc to cancel, 8s)

> Type your message or @path/to/file
`;
const GEMINI_APPROVAL = `
 ? Shell npm test
   Allow execution of: 'npm'?
 ● 1. Allow once
   2. Allow for this session
   3. No, suggest changes (esc)
`;
const GEMINI_IDLE = `
>   Type your message or @path/to/file
`;

describe("Codex and Gemini CLI screens", () => {
  it("classify by the same states as Claude Code", () => {
    expect(classifyPane(CODEX_IDLE).state).toBe("idle");
    expect(classifyPane(CODEX_WORKING).state).toBe("working");
    expect(classifyPane(CODEX_APPROVAL)).toMatchObject({ state: "blocked", category: "confirm" });
    expect(classifyPane(GEMINI_WORKING).state).toBe("working");
    expect(classifyPane(GEMINI_APPROVAL)).toMatchObject({ state: "blocked", category: "confirm" });
    expect(classifyPane(GEMINI_IDLE).state).toBe("idle");
  });

  it("tell the agent from the command, or from the screen for node", () => {
    expect(detectAgent("2.1.193", "", DEFAULT_MATCH)).toBe("claude");
    expect(detectAgent("codex", "", DEFAULT_MATCH)).toBe("codex");
    expect(detectAgent("gemini", "", DEFAULT_MATCH)).toBe("gemini");
    expect(detectAgent("node", CODEX_IDLE, DEFAULT_MATCH)).toBe("codex");
    expect(detectAgent("node", GEMINI_IDLE, DEFAULT_MATCH)).toBe("gemini");
    expect(detectAgent("node", "$ npm run dev\nready on :3000", DEFAULT_MATCH)).toBeUndefined();
    expect(detectAgent("zsh", CODEX_IDLE, DEFAULT_MATCH)).toBeUndefined();
    expect(mayBeAgent("vim", DEFAULT_MATCH)).toBe(false);
  });
});

describe("agent column", () => {
  const row = (agent: string): Row => ({ target: "s:1.1", project: "app", agent, state: "idle", reason: "waiting for input" });

  it("appears only when more than one agent is shown", () => {
    expect(renderTable([row("claude"), row("claude")], false)).not.toContain("claude");
    const mixed = renderTable([row("claude"), row("codex")], false);
    expect(mixed).toContain("codex");
    expect(mixed).toContain("claude");
  });
});

describe("macOS notifications", () => {
  const row: Row = {
    target: "work:2.1",
    project: 'quote"and-back',
    agent: "codex",
    state: "blocked",
    reason: "approval prompt",
    category: "confirm",
  };

  it("escapes pane details inside AppleScript strings", () => {
    const b = String.fromCharCode(92);
    // a"b<backslash>c, newline, d  ->  "a<b>"b<b><b>c d"
    expect(appleScriptString(`a"b${b}c\nd`)).toBe(`"a${b}"b${b}${b}c d"`);
    const script = macNotificationScript(row);
    expect(script).toContain('subtitle "codex in work:2.1"');
    expect(notifyEnv(row).FW_AGENT).toBe("codex");
  });

  it.skipIf(process.platform !== "darwin")("compiles as AppleScript (without showing anything)", () => {
    const dir = mkdtempSync(join(tmpdir(), "fw-osa-"));
    try {
      execFileSync("osacompile", ["-o", join(dir, "n.scpt"), "-e", macNotificationScript(row)]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
