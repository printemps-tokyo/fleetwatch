import { parseArgs } from "node:util";

import { describe, expect, it } from "vitest";
import { normalizeWatchArgv, DEFAULT_WATCH_SECS } from "../src/args.js";

/** Mirror of the CLI's parseArgs call, reduced to the options under test. */
function parse(argv: string[]) {
  return parseArgs({
    args: normalizeWatchArgv(argv),
    allowPositionals: false,
    options: {
      watch: { type: "string" },
      bell: { type: "boolean", default: false },
    },
  }).values;
}

describe("normalizeWatchArgv", () => {
  it("injects the default interval after a bare --watch", () => {
    expect(normalizeWatchArgv(["--watch"])).toEqual(["--watch", DEFAULT_WATCH_SECS]);
  });

  it("injects the default when --watch is followed by another flag", () => {
    expect(normalizeWatchArgv(["--watch", "--bell"])).toEqual(["--watch", DEFAULT_WATCH_SECS, "--bell"]);
  });

  it("keeps an explicit interval", () => {
    expect(normalizeWatchArgv(["--watch", "5"])).toEqual(["--watch", "5"]);
    expect(normalizeWatchArgv(["--watch", "2.5"])).toEqual(["--watch", "2.5"]);
  });

  it("leaves --watch=<secs> and unrelated argv untouched", () => {
    expect(normalizeWatchArgv(["--watch=3"])).toEqual(["--watch=3"]);
    expect(normalizeWatchArgv(["--bell", "--json"])).toEqual(["--bell", "--json"]);
    expect(normalizeWatchArgv([])).toEqual([]);
  });
});

describe("--watch through parseArgs", () => {
  it("no longer throws for --watch alone", () => {
    expect(parse(["--watch"]).watch).toBe(DEFAULT_WATCH_SECS);
  });

  it("no longer throws for --watch --bell", () => {
    const values = parse(["--watch", "--bell"]);
    expect(values.watch).toBe(DEFAULT_WATCH_SECS);
    expect(values.bell).toBe(true);
  });

  it("still accepts --watch 5", () => {
    expect(parse(["--watch", "5"]).watch).toBe("5");
  });
});
