import "server-only";
import { Firecrawl } from "firecrawl";

let client: Firecrawl | null = null;

function firecrawl(): Firecrawl {
  if (client) return client;
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("Missing FIRECRAWL_API_KEY env var");
  client = new Firecrawl({ apiKey });
  return client;
}

export type ScrapedPage = {
  url: string;
  title: string | null;
  markdown: string;
};

/**
 * Scrapes a single candidate company site. `scrape()` throws on a hard
 * failure (network, blocked, invalid domain) — the caller (lib/tools/
 * scrape-website.ts) is responsible for the retry-once-then-permanent
 * policy in artifact/design.md Section 5's retry table. A 200 with
 * near-empty markdown is NOT thrown here — it's returned as-is, and the
 * caller checks length against the "thin content" rule in that same table.
 */
export async function scrapeUrl(url: string): Promise<ScrapedPage> {
  const doc = await firecrawl().scrape(url, { formats: ["markdown"] });

  return {
    url: doc.metadata?.url ?? doc.metadata?.sourceURL ?? url,
    title: doc.metadata?.title ?? null,
    markdown: doc.markdown ?? "",
  };
}
