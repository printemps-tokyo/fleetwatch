/** Default refresh interval, in seconds, for `--watch` without a value. */
export const DEFAULT_WATCH_SECS = "5";

/**
 * Make `--watch [secs]` work with node's parseArgs, which only supports
 * options that always take a value ("string") or never do ("boolean").
 *
 * Pre-scans argv: whenever a bare `--watch` token is not followed by a
 * number, the default interval is injected so parseArgs sees `--watch <secs>`.
 * `--watch 5` and `--watch=5` pass through untouched.
 */
export function normalizeWatchArgv(argv: string[], defaultSecs: string = DEFAULT_WATCH_SECS): string[] {
  const out: string[] = [];
  for (const [i, arg] of argv.entries()) {
    out.push(arg);
    if (arg === "--watch") {
      const next = argv[i + 1];
      if (next === undefined || !/^\d+(\.\d+)?$/.test(next)) {
        out.push(defaultSecs);
      }
    }
  }
  return out;
}
