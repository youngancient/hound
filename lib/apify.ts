import "server-only";
import { ApifyClient } from "apify-client";
import { APIFY_ACTOR_ID } from "./agent-config";
import type { ActorInput } from "./discovery";

let client: ApifyClient | null = null;

function apify(): ApifyClient {
  if (client) return client;
  const token = process.env.APIFY_API_TOKEN;
  if (!token) throw new Error("Missing APIFY_API_TOKEN env var");
  client = new ApifyClient({ token });
  return client;
}

/**
 * Runs the LinkedIn company search actor (harvestapi) — company discovery
 * ONLY, per the PRD's "Apify only for company discovery" rule. Executes
 * exactly the input it's given: `maxItems`, filters and fallbacks are all
 * decided by lib/tools/discover-companies.ts and lib/discovery.ts. Returns
 * raw items; mapping them is lib/discovery.ts's job. Throws on a run that
 * didn't succeed, so the caller's retry/fallback logic sees it.
 */
export async function runCompanySearch(input: ActorInput): Promise<unknown[]> {
  const run = await apify().actor(APIFY_ACTOR_ID).call(input);
  if (run.status !== "SUCCEEDED") {
    throw new Error(`Apify run ${run.id} finished with status ${run.status}`);
  }

  const { items } = await apify().dataset(run.defaultDatasetId).listItems();
  return items;
}
