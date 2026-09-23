/**
 * Pure helpers for scraped pages, unit-tested in tests/scrape-text.test.ts.
 */

const MAX_RATE_LIMIT_WAIT_MS = 30_000;

/**
 * How long to wait if Firecrawl rate-limited us ("... retry after 13s"),
 * or null if the error wasn't a rate limit. Capped at 30 seconds.
 */
export function rateLimitWaitMs(err: unknown): number | null {
  const message = err instanceof Error ? err.message : String(err);
  if (!/rate limit/i.test(message)) return null;
  const seconds = Number(/retry after (\d+)\s*s/i.exec(message)?.[1] ?? 15);
  return Math.min(MAX_RATE_LIMIT_WAIT_MS, (seconds + 1) * 1000);
}

/** The first `max` words of `text`, keeping its original spacing and line breaks. */
export function trimWords(text: string, max: number): { text: string; trimmed: boolean } {
  const parts = text.split(/(\s+)/);
  let count = 0;
  for (let i = 0; i < parts.length; i++) {
    if (/\S/.test(parts[i]) && ++count > max) {
      return { text: parts.slice(0, i).join("").trimEnd(), trimmed: true };
    }
  }
  return { text, trimmed: false };
}
