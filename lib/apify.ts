import "server-only";
import { ApifyClient } from "apify-client";
import { APIFY_ACTOR_ID } from "./agent-config";

let client: ApifyClient | null = null;

function apify(): ApifyClient {
  if (client) return client;
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("Missing APIFY_API_TOKEN env var");
  client = new ApifyClient({ token });
  return client;
}

export type LinkedinCompanyResult = {
  name: string;
  website: string | null;
  industry: string | null;
  location: string | null;
  companySize: string | null;
  summary: string | null;
  linkedinUrl: string | null;
};

/**
 * Runs the LinkedIn Company Search Scraper (automation-lab) — company
 * discovery ONLY, per the PRD's "Apify only for company discovery" rule.
 * `maxItems` is the caller's responsibility to clamp before calling this
 * (see lib/tools/discover-companies.ts) — this function does not decide
 * how many results are "enough," it just executes the run.
 */
export async function runLinkedinCompanySearch(input: {
  searchQueries: string[];
  industries?: string[];
  locations?: string[];
  companySizes?: string[];
  maxItems: number;
}): Promise<LinkedinCompanyResult[]> {
  const run = await apify().actor(APIFY_ACTOR_ID).call({
    searchQueries: input.searchQueries,
    industries: input.industries ?? [],
    locations: input.locations ?? [],
    companySizes: input.companySizes ?? [],
    maxItems: input.maxItems,
  });

  const { items } = await apify().dataset(run.defaultDatasetId).listItems();

  return items.map((item) => {
    const record = item as Record<string, unknown>;
    return {
      name: String(record.name ?? ""),
      website: (record.website as string | undefined) ?? null,
      industry: (record.industry as string | undefined) ?? null,
      location: (record.location as string | undefined) ?? null,
      companySize: (record.companySize as string | undefined) ?? null,
      summary: (record.summary as string | undefined) ?? null,
      linkedinUrl: (record.linkedinUrl as string | undefined) ?? null,
    };
  });
}
