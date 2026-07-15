/** Default refresh interval, in seconds, for `--watch` without a value. */
export const DEFAULT_WATCH_SECS = "5";

/**
 * Make `--watch [secs]` work with node's parseArgs, which only supports
 * options that always take a value ("string") or never do ("boolean").
 *
 * Pre-scans argv: whenever a bare `--watch` token is followed by nothing or
 * by another option (a token starting with "-"), the default interval is
 * injected so parseArgs sees `--watch <secs>`. Any other following token is
 * left alone as the value candidate — validating it (numeric, positive) is
 * the job of parseWatchSecs, which produces a clear error message. This keeps
 * exotic-but-valid spellings like `--watch 1e3` working.
 */
export function normalizeWatchArgv(argv: string[], defaultSecs: string = DEFAULT_WATCH_SECS): string[] {
  const out: string[] = [];
  for (const [i, arg] of argv.entries()) {
    out.push(arg);
    if (arg === "--watch") {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("-")) {
        out.push(defaultSecs);
      }
    }
  }
  return out;
}

/**
 * Parse the value of `--watch` into seconds.
 *
 * Rejects anything that is not a positive finite number (NaN, zero,
 * negatives) instead of silently coercing it to a default.
 */
export function parseWatchSecs(value: string): number {
  const secs = Number(value);
  if (!Number.isFinite(secs) || secs <= 0) {
    throw new Error(`--watch must be a positive number of seconds (got "${value}")`);
  }
  return secs;
}
