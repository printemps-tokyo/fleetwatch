/**
 * Pure parsing helpers for tmux pane data (the tmux calls live in the CLI).
 */

export interface Pane {
  /** `session:window.pane` target. */
  target: string;
  /** The pane's foreground command (Claude Code shows its version here). */
  command: string;
  /** The pane's working directory. */
  path: string;
}

/** The tmux format string fleetwatch lists panes with. */
export const LIST_FORMAT = "#{session_name}:#{window_index}.#{pane_index}\t#{pane_current_command}\t#{pane_current_path}";

/** Parse the tab-separated `tmux list-panes` output into panes. */
export function parsePaneList(output: string): Pane[] {
  const panes: Pane[] = [];
  for (const line of output.split("\n")) {
    if (line.trim() === "") {
      continue;
    }
    const [target, command, path] = line.split("\t");
    if (target) {
      panes.push({ target, command: command ?? "", path: path ?? "" });
    }
  }
  return panes;
}

/** Claude Code panes show a version like `2.1.193` as their command name. */
export const DEFAULT_MATCH = /^\d+\.\d+\.\d+$/;

/** Whether a pane's command marks it as a Claude Code instance. */
export function isClaudePane(command: string, match: RegExp = DEFAULT_MATCH): boolean {
  return match.test(command);
}

/** The last path segment of a working directory (the project name). */
export function projectName(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts.length > 0 ? (parts[parts.length - 1] as string) : path || "?";
}
