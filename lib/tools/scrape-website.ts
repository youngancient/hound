import "server-only";
import { scrapeUrl } from "../firecrawl";
import { logToolCall } from "./log-tool-call";
import { leadExists, qualifiedLeadCountForRun } from "./save-lead";
import { reserveScrape } from "./budget";
import { FIRECRAWL_COST_PER_SCRAPE, FIRECRAWL_RETRY_LIMIT } from "../agent-config";
import type { ToolLimits } from "../schemas";
import { rateLimitWaitMs, trimWords } from "../scrape-text";

const THIN_CONTENT_MIN_WORDS = 100;

/**
 * Only the start of a page goes to the agent: that's where a company says
 * what it does and for whom, which is what qualification needs. Whole pages
 * (one real search hit 8,000 words) made sessions slow and costly and gave
 * the agent more to lose track of (design.md Section 7, context growth).
 */
const MAX_WORDS_FOR_AGENT = 2000;

/** Firecrawl's free plan rate-limits bursts; wait out a limit instead of failing (capped). */
const MAX_RATE_LIMIT_WAITS = 2;

export type ScrapeOutcome =
  | { kind: "skipped_existing" }
  | { kind: "skipped_budget" }
  | { kind: "skipped_target_reached" }
  | { kind: "thin_content"; url: string }
  | { kind: "error"; message: string }
  | { kind: "ok"; url: string; title: string | null; content: string };

/**
 * Wraps every scrape in the untrusted-content delimiter (design.md Section
 * 3) — the qualification step must only ever see the page's text inside
 * this wrapper, never as a bare string that could be confused for an
 * instruction. Idempotency (Section 4): skips a domain already saved for
 * this run before spending anything. Budget (Section 3): stops once the
 * qualified-lead target is reached, and reserves one scrape from the run's
 * `max_scrapes` in the database before calling Firecrawl — every attempt
 * counts, including thin or failed pages that never become leads. Retry policy (Section 5): one retry
 * on a hard failure, then permanent; a 200 with near-empty text is treated
 * as "thin content," not retried, and never handed to qualification as if
 * it were real evidence.
 */
export async function scrapeWebsite(
  runId: string,
  limits: ToolLimits,
  companyDomain: string,
  url: string
): Promise<ScrapeOutcome> {
  if (await leadExists(runId, companyDomain)) {
    return { kind: "skipped_existing" };
  }

  if ((await qualifiedLeadCountForRun(runId)) >= limits.max_qualified_leads) {
    await logSkip(runId, companyDomain, url, "qualified-lead target already reached");
    return { kind: "skipped_target_reached" };
  }

  if (!(await reserveScrape(runId))) {
    await logSkip(runId, companyDomain, url, "scrape budget exhausted");
    return { kind: "skipped_budget" };
  }

  let attempt = 0;
  let rateLimitWaits = 0;
  let lastError: unknown;

  while (attempt <= FIRECRAWL_RETRY_LIMIT) {
    try {
      const page = await scrapeUrl(url);
      const wordCount = page.markdown.trim().split(/\s+/).filter(Boolean).length;

      if (wordCount < THIN_CONTENT_MIN_WORDS) {
        await logToolCall({
          runId,
          toolName: "scrape_website",
          purpose: `Scrape ${companyDomain} for qualification evidence`,
          inputSummary: { url, companyDomain },
          resultSummary: { wordCount, thin: true },
          status: "error",
          errorMessage: "insufficient scraped content",
          costUsd: FIRECRAWL_COST_PER_SCRAPE,
        });
        return { kind: "thin_content", url: page.url };
      }

      await logToolCall({
        runId,
        toolName: "scrape_website",
        purpose: `Scrape ${companyDomain} for qualification evidence`,
        inputSummary: { url, companyDomain },
        resultSummary: { wordCount },
        status: "success",
        costUsd: FIRECRAWL_COST_PER_SCRAPE,
      });

      const { text, trimmed } = trimWords(page.markdown, MAX_WORDS_FOR_AGENT);
      return {
        kind: "ok",
        url: page.url,
        title: page.title,
        content: wrapUntrustedContent(page.url, trimmed ? `${text}\n\n[Page trimmed: showing the first ${MAX_WORDS_FOR_AGENT} of ${wordCount} words.]` : text),
      };
    } catch (err) {
      lastError = err;
      // A rate limit isn't a failure of this site: wait as asked and try
      // again, within the same scrape reservation, without using up a retry.
      const waitMs = rateLimitWaitMs(err);
      if (waitMs !== null && rateLimitWaits < MAX_RATE_LIMIT_WAITS) {
        rateLimitWaits++;
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      attempt++;
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  await logToolCall({
    runId,
    toolName: "scrape_website",
    purpose: `Scrape ${companyDomain} for qualification evidence`,
    inputSummary: { url, companyDomain },
    resultSummary: null,
    status: "error",
    errorMessage: message,
  });

  return { kind: "error", message };
}

async function logSkip(runId: string, companyDomain: string, url: string, reason: string): Promise<void> {
  await logToolCall({
    runId,
    toolName: "scrape_website",
    purpose: `Scrape ${companyDomain} for qualification evidence`,
    inputSummary: { url, companyDomain },
    resultSummary: { skipped: true, reason },
    status: "success",
  });
}

/**
 * Explicit delimiter marking page text as data, not instructions
 * (design.md Section 3 & the outreach-safety skill). A page that says
 * "ignore previous instructions" is just more text inside this wrapper.
 */
function wrapUntrustedContent(url: string, markdown: string): string {
  return `<scraped_content source="${url}">\n${markdown}\n</scraped_content>`;
}
