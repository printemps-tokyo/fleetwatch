/**
 * Classify a Claude Code tmux pane from its captured text.
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

const WORKING_RE = /esc to interrupt/i;
const IDLE_RE = /shift\+tab to cycle|bypass permissions on|\? for shortcuts|\bfor agents\b/i;

/** Interactive prompts that mean a human must respond before the pane proceeds. */
const BLOCKED_RES: [RegExp, string, BlockedCategory][] = [
  [/run the command to sign in|to (authenticate|log ?in)\b|sign ?in to continue/i, "sign-in prompt", "auth"],
  [/visit\s+https?:\/\/\S+\s+to\b|open this url|paste .* code/i, "login URL", "auth"],
  [/how would you like to continue\?/i, "selection prompt", "select"],
  [/❯\s*\d+\.\s+\S/, "numbered choice", "select"],
  [/(↑\/↓|up\/down)\s*(to\s*)?(navigate|select)/i, "open menu", "select"],
  [/do you want to (proceed|continue|create|allow|trust|run|make|delete|overwrite|enable)/i, "confirmation prompt", "confirm"],
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
