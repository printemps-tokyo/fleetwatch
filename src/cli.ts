#!/usr/bin/env node
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";

import { classifyPane } from "./classify.js";
import { parsePaneList, isClaudePane, projectName, DEFAULT_MATCH, LIST_FORMAT } from "./tmux.js";
import { renderJson, renderTable, summarize, type Row } from "./render.js";
import { updateTracker, elapsedMs, humanizeDuration, type Tracker } from "./track.js";

const HELP = `fleetwatch - watch your tmux Claude Code panes

Usage:
  fleetwatch [options]

Lists every Claude Code pane in your tmux server and classifies it as working,
idle, blocked (waiting for input), or error — so a pane silently stuck on a
permission/sign-in prompt does not go unnoticed.

Options:
  --watch [secs]      Refresh continuously (default interval: 5s)
  --session <name>    Only panes in this tmux session
  --match <regex>     Override how Claude panes are detected by command name
                      (default: a version like 2.1.193)
  --blocked-only      Show only blocked/error panes
  --bell              Ring the terminal bell when a pane becomes blocked (watch)
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
function collect(match: RegExp, session: string | undefined): Row[] {
  const list = tmux(["list-panes", "-a", "-F", LIST_FORMAT]);
  const rows: Row[] = [];
  for (const pane of parsePaneList(list)) {
    if (!isClaudePane(pane.command, match)) {
      continue;
    }
    if (session && !pane.target.startsWith(`${session}:`)) {
      continue;
    }
    let text = "";
    try {
      text = tmux(["capture-pane", "-p", "-t", pane.target]);
    } catch {
      text = "";
    }
    const { state, reason, category } = classifyPane(text);
    rows.push({ target: pane.target, project: projectName(pane.path), state, reason, category });
  }
  return rows;
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
        "blocked-only": { type: "boolean", default: false },
        bell: { type: "boolean", default: false },
        json: { type: "boolean", default: false },
        "no-color": { type: "boolean", default: false },
      },
    }).values;
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n`);
    return 1;
  }

  let match = DEFAULT_MATCH;
  if (values.match) {
    try {
      match = new RegExp(values.match);
    } catch (err) {
      process.stderr.write(`error: invalid --match regex: ${(err as Error).message}\n`);
      return 1;
    }
  }
  const color = !values["no-color"] && !process.env.NO_COLOR && process.stdout.isTTY === true;
  const watching = values.watch !== undefined;
  const intervalMs = Math.max(1, values.watch ? Number(values.watch) || 5 : 5) * 1000;

  const build = (): Row[] => {
    let rows: Row[];
    try {
      rows = collect(match, values.session);
    } catch (err) {
      process.stderr.write(`error: cannot talk to tmux (${(err as Error).message})\n`);
      process.exit(1);
    }
    return values["blocked-only"] ? rows.filter((r) => r.state === "blocked" || r.state === "error") : rows;
  };

  if (!watching) {
    const rows = build();
    process.stdout.write(values.json ? renderJson(rows) : renderTable(rows, color));
    return summarize(rows).blocked > 0 ? 1 : 0;
  }

  // Watch mode: refresh until interrupted, ringing the bell on newly-blocked panes.
  let prevBlocked = new Set<string>();
  let tracker: Tracker = new Map();
  for (;;) {
    const rows = build();
    const now = Date.now();
    tracker = updateTracker(
      tracker,
      rows.map((r) => ({ key: r.target, state: r.state })),
      now,
    );
    for (const r of rows) {
      const ms = elapsedMs(tracker, r.target, now);
      if (ms !== undefined) {
        r.age = humanizeDuration(ms);
      }
    }
    const blocked = new Set(rows.filter((r) => r.state === "blocked").map((r) => r.target));
    const isNew = [...blocked].some((t) => !prevBlocked.has(t));
    prevBlocked = blocked;

    if (!values.json) {
      process.stdout.write("\x1b[2J\x1b[H"); // clear screen
      process.stdout.write(`fleetwatch · ${new Date().toLocaleTimeString()} · every ${intervalMs / 1000}s\n\n`);
    }
    process.stdout.write(values.json ? renderJson(rows) : renderTable(rows, color));
    if (values.bell && isNew && blocked.size > 0) {
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
