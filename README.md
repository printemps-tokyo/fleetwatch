# fleetwatch

> Watch your tmux Claude Code panes and surface the ones blocked waiting for input. Zero-dependency CLI.

[![CI](https://github.com/printemps-tokyo/fleetwatch/actions/workflows/ci.yml/badge.svg)](https://github.com/printemps-tokyo/fleetwatch/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

When you run many Claude Code instances in parallel across tmux panes, one will
occasionally stall on a permission prompt, a selection menu, or an MCP sign-in —
and it is easy to miss among a dozen panes. `fleetwatch` scans your tmux server
and tells you which panes are working, idle, blocked, or errored.

```console
$ fleetwatch
7:12.1  rive             BLOCKED   sign-in prompt
7:7.1   printemps.tokyo  IDLE      waiting for input
7:9.1   p5js             WORKING   generating
...

14 panes · 7 working · 6 idle · 1 BLOCKED
```

It only reads pane contents (via `tmux capture-pane`); it never sends keys or
changes anything. The classifier is a pure function tested on real captures.

## Requirements

- Node.js >= 20
- `tmux`

## Install

Not published to npm yet — install from source:

```bash
git clone https://github.com/printemps-tokyo/fleetwatch
cd fleetwatch
npm install && npm run build
npm link   # optional: puts the `fleetwatch` command on your PATH
```

Then run `fleetwatch` (after `npm link`), or `node dist/cli.js` from the clone.

## Usage

```bash
fleetwatch                     # one-shot table of all Claude Code panes
fleetwatch --watch             # refresh every 5s
fleetwatch --watch 2 --bell    # every 2s, ring the bell on a newly-blocked pane
fleetwatch --session 7         # only panes in tmux session "7"
fleetwatch --blocked-only      # only panes needing attention
fleetwatch --json              # machine-readable
```

| Option | Description |
| --- | --- |
| `--watch [secs]` | Refresh continuously (default 5s) |
| `--session <name>` | Only panes in this tmux session |
| `--filter <regex>` | Only panes whose path matches this regex |
| `--exclude <regex>` | Skip panes whose path matches this regex |
| `--match <regex>` | How Claude panes are detected by command name (default: a version like `2.1.193`) |
| `--blocked-only` | Show only blocked / error panes |
| `--bell` | Ring the terminal bell when a pane becomes blocked (watch mode) |
| `--notify <command>` | Run a shell command when a pane becomes blocked (watch mode) |
| `--json` | Output JSON instead of a table |
| `--no-color` | Disable ANSI colors |

In one-shot mode the exit code is `1` when any pane is blocked, so it fits in
scripts and status bars. In `--watch` mode each row also shows how long the pane
has held its current state (e.g. `BLOCKED 12m`), so the one stuck longest stands
out.

### Alerting

In watch mode, `--notify <command>` runs a shell command the moment a pane
becomes blocked. The pane's details arrive as environment variables
(`FW_PROJECT`, `FW_TARGET`, `FW_REASON`, `FW_CATEGORY`, `FW_ID`, `FW_STATE`) —
they are not interpolated into the command, so unusual project names are safe.

```bash
# macOS desktop notification
fleetwatch --watch --notify 'terminal-notifier -title "$FW_PROJECT blocked" -message "$FW_REASON"'
```

fleetwatch only reads panes; the notify command is yours to define.

## How panes are detected and classified

- A pane is treated as a Claude Code instance when its foreground command looks
  like a version (e.g. `2.1.193`), which is how Claude Code appears in tmux.
  Override with `--match` if your setup differs.
- The captured text is classified, in order:
  - `working` — actively generating (`esc to interrupt` in the footer).
  - `blocked` — an interactive prompt awaits you, tagged with a triage
    category: `auth` (sign-in / login URL), `select` (a menu), `confirm`
    (yes/no, Accept/Decline, proceed, press-enter), or `input` (a question).
  - `error` — an error banner (API error, rate limit, network, crash).
  - `idle` — the ready input box is shown.
  - `unknown` — a screen with no recognizable markers (e.g. a modal).

Detection is heuristic and tuned to the Claude Code TUI; it may need updating as
that UI evolves. Contributions of new prompt signatures are welcome.

## Programmatic API

```ts
import { classifyPane } from "@printemps-tokyo/fleetwatch";

const { state, reason } = classifyPane(capturedPaneText);
// state: "working" | "blocked" | "error" | "idle" | "unknown"
```

`classifyPane` and the tmux output parsers are pure functions.

## License

[MIT](./LICENSE) (c) printemps.tokyo
