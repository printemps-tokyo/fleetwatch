import { parseArgs } from "node:util";

import { describe, expect, it } from "vitest";
import { normalizeWatchArgv, parseWatchSecs, DEFAULT_WATCH_SECS } from "../src/args.js";

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

  it("passes any non-option token through as the value candidate", () => {
    // Validation (not the pre-scan) decides whether these are acceptable.
    expect(normalizeWatchArgv(["--watch", "1e3"])).toEqual(["--watch", "1e3"]);
    expect(normalizeWatchArgv(["--watch", "abc"])).toEqual(["--watch", "abc"]);
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

  it("accepts exponent notation again (--watch 1e3)", () => {
    expect(parse(["--watch", "1e3"]).watch).toBe("1e3");
  });
});

describe("parseWatchSecs", () => {
  it("parses plain and fractional seconds", () => {
    expect(parseWatchSecs("5")).toBe(5);
    expect(parseWatchSecs("2.5")).toBe(2.5);
    expect(parseWatchSecs(DEFAULT_WATCH_SECS)).toBe(5);
  });

  it("parses exponent notation", () => {
    expect(parseWatchSecs("1e3")).toBe(1000);
  });

  it("rejects non-numeric values with a clear message", () => {
    expect(() => parseWatchSecs("abc")).toThrow('--watch must be a positive number of seconds (got "abc")');
  });

  it("rejects zero and negative values", () => {
    expect(() => parseWatchSecs("0")).toThrow('--watch must be a positive number of seconds (got "0")');
    expect(() => parseWatchSecs("-5")).toThrow('--watch must be a positive number of seconds (got "-5")');
  });

  it("rejects empty and non-finite values", () => {
    expect(() => parseWatchSecs("")).toThrow("--watch must be a positive number");
    expect(() => parseWatchSecs("Infinity")).toThrow("--watch must be a positive number");
  });
});
