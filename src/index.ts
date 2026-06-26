/**
 * Public API for fleetwatch.
 *
 * `fleetwatch` watches the Claude Code panes in your tmux server and surfaces
 * the ones that are blocked waiting for input. The classifier and the tmux
 * output parsers are pure functions (the tmux calls happen only in the CLI),
 * so the behavior is deterministic and unit-tested on real captures.
 */

export type { PaneState, BlockedCategory, Classification } from "./classify.js";
export { classifyPane, nonBlankTail } from "./classify.js";

export type { Pane } from "./tmux.js";
export { parsePaneList, isClaudePane, projectName, DEFAULT_MATCH, LIST_FORMAT } from "./tmux.js";

export type { Row } from "./render.js";
export { renderTable, renderJson, sortRows, summarize } from "./render.js";
