/**
 * Classify a coding-agent tmux pane (Claude Code, Codex CLI, Gemini CLI)
 * from its captured text.
 *
 * The goal is to surface a pane that is silently BLOCKED waiting for a human
 * (a permission prompt, a selection menu, an MCP sign-in) among many panes.
 * Classification is a pure function over the captured text, so it can be unit
 * tested on real captures without touching tmux.
 *
 * Order of checks: a pane that is actively generating (`esc to interrupt` in
 * the footer) is `working`; otherwise an interactive prompt makes it `blocked`;
 * an error banner makes it `error`; the ready input box makes it `idle`.
 */

export type PaneState = "working" | "blocked" | "error" | "idle" | "unknown";

/**
 * A coarse bucket for a blocked pane, for at-a-glance triage across many panes:
 * `auth` needs you to sign in elsewhere, `confirm` is a quick yes/approve,
 * `select` is an open menu, and `input` is a free-text question.
 */
export type BlockedCategory = "auth" | "confirm" | "select" | "input";

export interface Classification {
  state: PaneState;
  reason: string;
  /** Set only when `state` is `blocked`. */
  category?: BlockedCategory;
}

const FOOTER_LINES = 3;
const TAIL_LINES = 16;

// Claude Code and Codex show "esc to interrupt" while working; Gemini CLI
// shows "(esc to cancel, 12s)".
const WORKING_RE = /esc to interrupt|\(esc to cancel, \d/i;
// Codex's empty composer reads "Ask Codex to do anything", Gemini CLI's
// "Type your message or @path/to/file".
const IDLE_RE =
  /shift\+tab to cycle|bypass permissions on|\? for shortcuts|\bfor agents\b|Ask Codex to do anything|Type your message or @path/i;

/** Interactive prompts that mean a human must respond before the pane proceeds. */
const BLOCKED_RES: [RegExp, string, BlockedCategory][] = [
  [/run the command to sign in|to (authenticate|log ?in)\b|sign ?in to continue/i, "sign-in prompt", "auth"],
  [/visit\s+https?:\/\/\S+\s+to\b|open this url|paste .* code/i, "login URL", "auth"],
  [/how would you like to continue\?/i, "selection prompt", "select"],
  [/❯\s*\d+\.\s+\S/, "numbered choice", "select"],
  [/(↑\/↓|up\/down)\s*(to\s*)?(navigate|select)/i, "open menu", "select"],
  [/do you want to (proceed|continue|create|allow|trust|run|make|delete|overwrite|enable|approve)/i, "confirmation prompt", "confirm"],
  // Codex approvals: "Would you like to run the following command?" and a
  // footer "Press enter to confirm or esc to cancel".
  [/would you like to (run|grant|make|apply|allow|approve)\b/i, "approval prompt", "confirm"],
  [/press enter to confirm or esc to cancel/i, "approval prompt", "confirm"],
  // Gemini CLI tool approvals: "Allow once" / "No, suggest changes (esc)".
  [/\bAllow once\b|No, suggest changes/, "approval prompt", "confirm"],
  [/›\s*\d+\.\s+\S/, "numbered choice", "select"],
  [/\bAccept\b\s+\bDecline\b/, "accept/decline prompt", "confirm"],
  [/press enter to (continue|confirm|retry)/i, "press-enter prompt", "confirm"],
  [/\((y\/n)\)|\[(y\/n|y\/N|Y\/n)\]/i, "yes/no prompt", "confirm"],
  [/waiting for (your )?(input|response|confirmation)/i, "awaiting input", "input"],
];

/** Error banners that indicate the pane stalled on a failure. */
const ERROR_RES: [RegExp, string][] = [
  [/\bAPI Error\b/i, "API error"],
  [/rate limit|overloaded|\b429\b/i, "rate limited"],
  [/connection (error|reset)|ECONNRESET|ETIMEDOUT|network error/i, "network error"],
  [/\bpanic\b|fatal error|uncaught exception/i, "crash"],
];

/** The last `n` non-blank lines of the captured text, trimmed. */
export function nonBlankTail(text: string, n: number): string[] {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim() !== "");
  return lines.slice(-n);
}

/** Classify a pane from its captured text. */
export function classifyPane(text: string): Classification {
  const footer = nonBlankTail(text, FOOTER_LINES).join("\n");
  const tail = nonBlankTail(text, TAIL_LINES).join("\n");

  if (WORKING_RE.test(footer)) {
    return { state: "working", reason: "generating" };
  }
  for (const [re, why, category] of BLOCKED_RES) {
    if (re.test(tail)) {
      return { state: "blocked", reason: why, category };
    }
  }
  for (const [re, why] of ERROR_RES) {
    if (re.test(tail)) {
      return { state: "error", reason: why };
    }
  }
  if (IDLE_RE.test(footer)) {
    return { state: "idle", reason: "waiting for input" };
  }
  return { state: "unknown", reason: "no recognizable state" };
}

/** The coding agents fleetwatch recognizes. */
export type Agent = "claude" | "codex" | "gemini";

export const AGENTS: readonly Agent[] = ["claude", "codex", "gemini"];

const CODEX_SIGNATURE = /Ask Codex to do anything|tell Codex what to do|OpenAI Codex|\d+% context left/;
const GEMINI_SIGNATURE = /Type your message or @path|\(esc to cancel, \d|Gemini CLI|No, suggest changes \(esc\)/;

/**
 * Which agent a pane runs, from its foreground command and captured text:
 * Claude Code shows its version as the command (matched by `claudeMatch`),
 * the native Codex and Gemini binaries their names. An npm-installed CLI
 * shows as `node`, so then the screen decides. Undefined when it is none.
 */
export function detectAgent(command: string, text: string, claudeMatch: RegExp): Agent | undefined {
  if (claudeMatch.test(command)) return "claude";
  if (command === "codex") return "codex";
  if (command === "gemini") return "gemini";
  if (command === "node") {
    if (GEMINI_SIGNATURE.test(text)) return "gemini";
    if (CODEX_SIGNATURE.test(text)) return "codex";
  }
  return undefined;
}

/** Whether a pane with this command could be an agent (worth capturing). */
export function mayBeAgent(command: string, claudeMatch: RegExp): boolean {
  return claudeMatch.test(command) || ["codex", "gemini", "node"].includes(command);
}
