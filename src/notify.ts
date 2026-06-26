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
    FW_STATE: row.state,
    FW_REASON: row.reason,
    FW_CATEGORY: row.category ?? "",
  };
}
