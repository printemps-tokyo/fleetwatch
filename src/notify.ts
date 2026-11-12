/**
 * Build the environment a `--notify` hook command runs with.
 *
 * The pane's details are passed as `FW_*` environment variables rather than
 * interpolated into the command string, so a project name with shell-special
 * characters cannot break or inject into the command. The hook command itself
 * is whatever the user provides (e.g. a desktop notifier); fleetwatch never
 * sends keys to any pane.
 */

import type { Row } from "./render.js";

/** The `FW_*` environment for a notify hook describing one blocked pane. */
export function notifyEnv(row: Row): Record<string, string> {
  return {
    FW_TARGET: row.target,
    FW_ID: row.id ?? "",
    FW_PROJECT: row.project,
    FW_AGENT: row.agent ?? "claude",
    FW_STATE: row.state,
    FW_REASON: row.reason,
    FW_CATEGORY: row.category ?? "",
  };
}

/** A string literal for AppleScript: backslashes and double quotes escaped. */
export function appleScriptString(text: string): string {
  return `"${text.replace(/[\\"]/g, (c) => `\\${c}`).replace(/[\r\n]+/g, " ")}"`;
}

/**
 * The AppleScript for a macOS Notification Center alert about one pane,
 * run with `osascript -e`. Pane details are inside escaped string literals,
 * so they cannot change the script.
 */
export function macNotificationScript(row: Row): string {
  const what = row.stuck ? "no output for a while" : row.category ? `[${row.category}] ${row.reason}` : row.reason;
  const title = `fleetwatch: ${row.project} needs you`;
  const subtitle = `${row.agent ?? "claude"} in ${row.target}`;
  return `display notification ${appleScriptString(what)} with title ${appleScriptString(title)} subtitle ${appleScriptString(subtitle)}`;
}
