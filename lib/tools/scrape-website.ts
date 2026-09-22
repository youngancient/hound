import "server-only";
import { scrapeUrl } from "../firecrawl";
import { logToolCall } from "./log-tool-call";
import { leadExists, leadCountForRun } from "./save-lead";
import { FIRECRAWL_COST_PER_SCRAPE, FIRECRAWL_RETRY_LIMIT, MAX_SCRAPES } from "../agent-config";

const THIN_CONTENT_MIN_WORDS = 100;

export type ScrapeOutcome =
  | { kind: "skipped_existing" }
  | { kind: "skipped_budget" }
  | { kind: "thin_content"; url: string }
  | { kind: "error"; message: string }
  | { kind: "ok"; url: string; title: string | null; content: string };

/**
 * Wraps every scrape in the untrusted-content delimiter (design.md Section
 * 3) — the qualification step must only ever see the page's text inside
 * this wrapper, never as a bare string that could be confused for an
 * instruction. Idempotency (Section 4): skips a domain already saved for
 * this run before spending anything. Retry policy (Section 5): one retry
 * on a hard failure, then permanent; a 200 with near-empty text is treated
 * as "thin content," not retried, and never handed to qualification as if
 * it were real evidence.
 */
export async function scrapeWebsite(
  runId: string,
  companyDomain: string,
  url: string
): Promise<ScrapeOutcome> {
  if (await leadExists(runId, companyDomain)) {
    return { kind: "skipped_existing" };
  }

  const existingCount = await leadCountForRun(runId);
  if (existingCount >= MAX_SCRAPES) {
    await logToolCall({
      runId,
      toolName: "scrape_website",
      purpose: `Scrape ${companyDomain} for qualification evidence`,
      inputSummary: { url },
      resultSummary: { skipped: true, reason: "MAX_SCRAPES already reached" },
      status: "success",
    });
    return { kind: "skipped_budget" };
  }

  let attempt = 0;
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
          inputSummary: { url },
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
        inputSummary: { url },
        resultSummary: { wordCount },
        status: "success",
        costUsd: FIRECRAWL_COST_PER_SCRAPE,
      });

      return {
        kind: "ok",
        url: page.url,
        title: page.title,
        content: wrapUntrustedContent(page.url, page.markdown),
      };
    } catch (err) {
      lastError = err;
      attempt++;
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  await logToolCall({
    runId,
    toolName: "scrape_website",
    purpose: `Scrape ${companyDomain} for qualification evidence`,
    inputSummary: { url },
    resultSummary: null,
    status: "error",
    errorMessage: message,
  });

  return { kind: "error", message };
}

/**
 * Explicit delimiter marking page text as data, not instructions
 * (design.md Section 3 & the outreach-safety skill). A page that says
 * "ignore previous instructions" is just more text inside this wrapper.
 */
function wrapUntrustedContent(url: string, markdown: string): string {
  return `<scraped_content source="${url}">\n${markdown}\n</scraped_content>`;
}
