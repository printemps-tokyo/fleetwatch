#!/usr/bin/env node
import { parseArgs } from "node:util";
import { execFileSync, spawn } from "node:child_process";

import { classifyPane } from "./classify.js";
import { parsePaneList, isClaudePane, projectName, paneIncluded, DEFAULT_MATCH, LIST_FORMAT } from "./tmux.js";
import { renderJson, renderTable, summarize, type Row } from "./render.js";
import { updateTracker, elapsedMs, humanizeDuration, parseDuration, type Tracker } from "./track.js";
import { hashText, updateActivity, quietMs, type ActivityTracker } from "./activity.js";
import { notifyEnv } from "./notify.js";

const HELP = `fleetwatch - watch your tmux Claude Code panes

Usage:
  fleetwatch [options]

Lists every Claude Code pane in your tmux server and classifies it as working,
idle, blocked (waiting for input), or error — so a pane silently stuck on a
permission/sign-in prompt does not go unnoticed.

Options:
  --watch [secs]      Refresh continuously (default interval: 5s)
  --session <name>    Only panes in this tmux session
  --filter <regex>    Only panes whose path matches this regex
  --exclude <regex>   Skip panes whose path matches this regex
  --match <regex>     Override how Claude panes are detected by command name
                      (default: a version like 2.1.193)
  --blocked-only      Show only blocked/error panes
  --stuck <duration>  Flag a pane whose output has not changed for this long
                      (watch mode; e.g. 90s, 10m, 1h). Catches silent hangs that
                      the prompt classifier cannot recognize.
  --bell              Ring the terminal bell when a pane becomes blocked (watch)
  --notify <command>  Run this shell command when a pane becomes blocked (watch).
                      Pane details are passed as FW_PROJECT/FW_TARGET/FW_REASON/
                      FW_CATEGORY/FW_ID env vars (not interpolated)
  --json              Output JSON instead of a table
  --no-color          Disable ANSI colors
  -h, --help          Show this help
  -v, --version       Show version

Exit code is 1 (in one-shot mode) when any pane is blocked, so it fits scripts.
`;

async function readVersion(): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const here = dirname(fileURLToPath(import.meta.url));
  try {
    const raw = await readFile(join(here, "..", "package.json"), "utf8");
    return (JSON.parse(raw) as { version: string }).version;
  } catch {
    return "0.0.0";
  }
}

function tmux(args: string[]): string {
  return execFileSync("tmux", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

/** Capture and classify the Claude Code panes into display rows. */
interface Snapshot {
  rows: Row[];
  /** key (pane id) -> captured-text hash, for stuck detection. */
  hashes: Map<string, string>;
}

function collect(
  match: RegExp,
  session: string | undefined,
  paneFilter: { filter?: RegExp; exclude?: RegExp },
): Snapshot {
  const list = tmux(["list-panes", "-a", "-F", LIST_FORMAT]);
  const rows: Row[] = [];
  const hashes = new Map<string, string>();
  for (const pane of parsePaneList(list)) {
    if (!isClaudePane(pane.command, match)) {
      continue;
    }
    if (session && !pane.target.startsWith(`${session}:`)) {
      continue;
    }
    if (!paneIncluded(pane.path, paneFilter)) {
      continue;
    }
    let text = "";
    try {
      text = tmux(["capture-pane", "-p", "-t", pane.target]);
    } catch {
      text = "";
    }
    const { state, reason, category } = classifyPane(text);
    const row: Row = { target: pane.target, id: pane.id, project: projectName(pane.path), state, reason, category };
    rows.push(row);
    hashes.set(pane.id || pane.target, hashText(text));
  }
  return { rows, hashes };
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  if (argv.includes("-h") || argv.includes("--help")) {
    process.stdout.write(HELP);
    return 0;
  }
  if (argv.includes("-v") || argv.includes("--version")) {
    process.stdout.write((await readVersion()) + "\n");
    return 0;
  }

  let values;
  try {
    values = parseArgs({
      args: argv,
      allowPositionals: false,
      options: {
        watch: { type: "string" },
        session: { type: "string" },
        match: { type: "string" },
        filter: { type: "string" },
        exclude: { type: "string" },
        "blocked-only": { type: "boolean", default: false },
        stuck: { type: "string" },
        bell: { type: "boolean", default: false },
        notify: { type: "string" },
        json: { type: "boolean", default: false },
        "no-color": { type: "boolean", default: false },
      },
    }).values;
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 1;
  }

  let match = DEFAULT_MATCH;
  const paneFilter: { filter?: RegExp; exclude?: RegExp } = {};
  try {
    if (values.match) {
      match = new RegExp(values.match);
    }
    if (values.filter) {
      paneFilter.filter = new RegExp(values.filter);
    }
    if (values.exclude) {
      paneFilter.exclude = new RegExp(values.exclude);
    }
  } catch (err) {
    process.stderr.write(`error: invalid regex: ${(err as Error).message}\n`);
    return 1;
  }

  let stuckMs: number | undefined;
  try {
    stuckMs = values.stuck ? parseDuration(values.stuck) : undefined;
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 1;
  }
  const color = !values["no-color"] && !process.env.NO_COLOR && process.stdout.isTTY === true;
  const watching = values.watch !== undefined;
  const intervalMs = Math.max(1, values.watch ? Number(values.watch) || 5 : 5) * 1000;

  const build = (): Snapshot => {
    let snap: Snapshot;
    try {
      snap = collect(match, values.session, paneFilter);
    } catch (err) {
      process.stderr.write(`error: cannot talk to tmux (${(err as Error).message})\n`);
      process.exit(1);
    }
    if (values["blocked-only"]) {
      snap.rows = snap.rows.filter((r) => r.state === "blocked" || r.state === "error");
    }
    return snap;
  };

  if (!watching) {
    const { rows } = build();
    process.stdout.write(values.json ? renderJson(rows, new Date().toISOString()) : renderTable(rows, color));
    return summarize(rows).blocked > 0 ? 1 : 0;
  }

  // Watch mode: refresh until interrupted, alerting on newly-blocked/stuck panes.
  const keyOf = (r: Row): string => r.id || r.target;
  let prevAlerting = new Set<string>();
  let tracker: Tracker = new Map();
  let activity: ActivityTracker = new Map();
  for (;;) {
    const { rows, hashes } = build();
    const now = Date.now();

    // Track time-in-state (for "12m") and output quiescence (for --stuck).
    tracker = updateTracker(tracker, rows.map((r) => ({ key: keyOf(r), state: r.state })), now);
    activity = updateActivity(activity, [...hashes].map(([key, hash]) => ({ key, hash })), now);
    for (const r of rows) {
      const ms = elapsedMs(tracker, keyOf(r), now);
      if (ms !== undefined) {
        r.age = humanizeDuration(ms);
      }
      if (stuckMs !== undefined && (r.state === "working" || r.state === "unknown")) {
        const quiet = quietMs(activity, keyOf(r), now);
        r.stuck = quiet !== undefined && quiet >= stuckMs;
      }
    }

    // Panes needing attention: blocked, or stuck past the threshold.
    const alerting = rows.filter((r) => r.state === "blocked" || r.stuck === true);
    const newlyAlerting = alerting.filter((r) => !prevAlerting.has(keyOf(r)));
    prevAlerting = new Set(alerting.map(keyOf));

    if (values.notify) {
      for (const r of newlyAlerting) {
        try {
          spawn("sh", ["-c", values.notify], { env: { ...process.env, ...notifyEnv(r) }, stdio: "ignore" }).unref();
        } catch {
          // A failing notify hook must not stop the watch loop.
        }
      }
    }

    if (!values.json) {
      process.stdout.write("\x1b[2J\x1b[H"); // clear screen
      process.stdout.write(`fleetwatch · ${new Date().toLocaleTimeString()} · every ${intervalMs / 1000}s\n\n`);
    }
    process.stdout.write(values.json ? renderJson(rows, new Date().toISOString()) : renderTable(rows, color));
    if (values.bell && newlyAlerting.length > 0) {
      process.stdout.write("\x07");
    }
    await sleep(intervalMs);
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err: unknown) => {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    process.exitCode = 1;
  });
