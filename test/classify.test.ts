import { describe, expect, it } from "vitest";
import { classifyPane, nonBlankTail } from "../src/classify.js";

// Fixtures adapted from real captures of the author's tmux Claude Code panes.
const BLOCKED = `  After it finishes, disable then re-enable the Context7 MCP server so the new credentials take effect.
  ❯ ✔ How would you like to continue?: ▸ I'll run the command to sign in
    Accept    Decline
  Esc to cancel · ↑/↓ to navigate · Backspace to unset · → to expand`;

const WORKING = `  ⏵⏵ bypass permissions on (shift+tab to cycle) · esc to interrupt · ctrl+t to hide tasks · ← for agents`;

const WORKING_TASKS = `  ⏵⏵ bypass permissions on (shift+tab to cycle) · esc to interrupt · ← for agents · ↓ to manage
  ⏺ main
  ◯ general-purpose  reviewing the extension                         2m 20s · ↓ 40.0k tokens`;

const IDLE = `────────────────────────────── master ──
❯
──────────────────────────────
  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents`;

const YESNO = `  Do you want to proceed?
  ❯ 1. Yes
    2. No`;

const ERROR = `  API Error: Connection error.
❯
  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents`;

describe("classifyPane", () => {
  it("detects a blocked sign-in / selection prompt", () => {
    expect(classifyPane(BLOCKED).state).toBe("blocked");
  });

  it("detects a yes/no confirmation as blocked", () => {
    const c = classifyPane(YESNO);
    expect(c.state).toBe("blocked");
  });

  it("detects a working pane by 'esc to interrupt'", () => {
    expect(classifyPane(WORKING).state).toBe("working");
    expect(classifyPane(WORKING_TASKS).state).toBe("working");
  });

  it("detects an idle pane by the ready footer", () => {
    expect(classifyPane(IDLE).state).toBe("idle");
  });

  it("detects an error banner when not generating", () => {
    expect(classifyPane(ERROR).state).toBe("error");
  });

  it("falls back to unknown for unrecognized screens", () => {
    expect(classifyPane("some other full-screen UI\nwith no markers").state).toBe("unknown");
  });

  it("prefers working over a stale blocked phrase in scrollback", () => {
    // 'esc to interrupt' in the footer wins even if older text mentions a prompt.
    const mixed = `Do you want to proceed? earlier in the log\n${WORKING}`;
    expect(classifyPane(mixed).state).toBe("working");
  });
});

describe("nonBlankTail", () => {
  it("returns the last n non-blank lines", () => {
    expect(nonBlankTail("a\n\nb\n\n\nc\n", 2)).toEqual(["b", "c"]);
  });
});
