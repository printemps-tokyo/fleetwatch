import type { PaneState } from "./classify.js";

/** A classified pane ready for display. */
export interface Row {
  target: string;
  /** Stable tmux pane id, used as the tracking key (not shown in the table). */
  id?: string;
  project: string;
  state: PaneState;
  reason: string;
  /** Blocked-pane triage bucket (auth / confirm / select / input). */
  category?: string;
  /** How long the pane has held this state (watch mode only), e.g. "12m". */
  age?: string;
}

const COLORS: Record<string, string> = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  red: "\x1b[1;31m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  dim: "\x1b[2m",
};

const STATE_COLOR: Record<PaneState, string> = {
  blocked: COLORS.red as string,
  error: COLORS.red as string,
  idle: COLORS.dim as string,
  working: COLORS.green as string,
  unknown: COLORS.yellow as string,
};

// Sort order: the panes that may need you come first.
const STATE_ORDER: Record<PaneState, number> = { blocked: 0, error: 1, idle: 2, working: 3, unknown: 4 };

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

/** Sort rows by urgency, then by target. */
export function sortRows(rows: Row[]): Row[] {
  return [...rows].sort(
    (a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.target.localeCompare(b.target),
  );
}

/** Count rows per state. */
export function summarize(rows: Row[]): Record<PaneState, number> {
  const counts: Record<PaneState, number> = { working: 0, blocked: 0, error: 0, idle: 0, unknown: 0 };
  for (const r of rows) {
    counts[r.state] += 1;
  }
  return counts;
}

/** Render the classified panes as a table. */
export function renderTable(rows: Row[], color: boolean): string {
  if (rows.length === 0) {
    return "no Claude Code panes found\n";
  }
  const sorted = sortRows(rows);
  const tw = Math.max(6, ...sorted.map((r) => r.target.length));
  const pw = Math.max(7, ...sorted.map((r) => r.project.length));
  const aw = Math.max(0, ...sorted.map((r) => (r.age ?? "").length));
  const lines: string[] = [];
  for (const r of sorted) {
    const state = color ? `${STATE_COLOR[r.state]}${pad(r.state.toUpperCase(), 8)}${COLORS.reset}` : pad(r.state.toUpperCase(), 8);
    const age = aw > 0 ? `  ${pad(r.age ?? "", aw)}` : "";
    const detail = r.category ? `[${r.category}] ${r.reason}` : r.reason;
    lines.push(`${pad(r.target, tw)}  ${pad(r.project, pw)}  ${state}${age}  ${detail}`);
  }

  const c = summarize(sorted);
  const parts = [`${rows.length} panes`, `${c.working} working`, `${c.idle} idle`];
  if (c.blocked > 0) parts.push(color ? `${COLORS.red}${c.blocked} BLOCKED${COLORS.reset}` : `${c.blocked} BLOCKED`);
  if (c.error > 0) parts.push(`${c.error} error`);
  if (c.unknown > 0) parts.push(`${c.unknown} unknown`);
  lines.push("", parts.join(" · "));
  return lines.join("\n") + "\n";
}

/** Render the classified panes as JSON. `at` (an ISO time) stamps the snapshot. */
export function renderJson(rows: Row[], at?: string): string {
  const sorted = sortRows(rows);
  const payload = { ...(at ? { generatedAt: at } : {}), panes: sorted, summary: summarize(sorted) };
  return JSON.stringify(payload, null, 2) + "\n";
}
