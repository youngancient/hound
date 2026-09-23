import "server-only";
import { runLinkedinCompanySearch, type LinkedinCompanyResult } from "../apify";
import { logToolCall } from "./log-tool-call";
import { qualifiedLeadCountForRun } from "./save-lead";
import { reserveDiscovery, releaseCandidates } from "./budget";
import { APIFY_COST_PER_LINKEDIN_RESULT, APIFY_RETRY_LIMIT } from "../agent-config";
import type { ToolLimits } from "../schemas";

const PURPOSE = "Find candidate companies via LinkedIn company search";

export type DiscoverOutcome = {
  results: LinkedinCompanyResult[];
  passNumber: number | null;
  skipped?: string;
};

/**
 * Discovery tool — Apify only, per the PRD. Defense in depth (design.md
 * Section 3): (a) the agent never chooses how many companies to pull —
 * `maxItems` is whatever the database grants from the run's own
 * `tool_limits` (first pass, then one re-search with the remainder),
 * (b) that grant is reserved atomically *before* the paid call, so no
 * number of calls, parallel or not, can exceed the budget, (c) actor
 * failures are caught and logged rather than propagating as a crash.
 */
export async function discoverCompanies(
  runId: string,
  limits: ToolLimits,
  input: {
    searchQueries: string[];
    industries?: string[];
    locations?: string[];
    companySizes?: string[];
  }
): Promise<DiscoverOutcome> {
  const qualified = await qualifiedLeadCountForRun(runId);
  if (qualified >= limits.max_qualified_leads) {
    return skip(runId, input, "qualified-lead target already reached");
  }

  const reservation = await reserveDiscovery(runId);
  if (reservation.granted === 0) {
    return skip(runId, input, reservation.reason);
  }

  const maxItems = reservation.granted;
  let attempt = 0;
  let lastError: unknown;

  while (attempt <= APIFY_RETRY_LIMIT) {
    try {
      const results = await runLinkedinCompanySearch({ ...input, maxItems });
      await releaseCandidates(runId, maxItems - results.length);

      await logToolCall({
        runId,
        toolName: "discover_companies",
        purpose: PURPOSE,
        inputSummary: { ...input, pass: reservation.passNumber, maxItems },
        resultSummary: { count: results.length },
        status: "success",
        costUsd: results.length * APIFY_COST_PER_LINKEDIN_RESULT,
      });

      return { results, passNumber: reservation.passNumber };
    } catch (err) {
      lastError = err;
      attempt++;
    }
  }

  // Nothing was bought, so the candidates go back — but the pass stays
  // spent, which keeps the number of discovery attempts per run bounded.
  await releaseCandidates(runId, maxItems);

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  await logToolCall({
    runId,
    toolName: "discover_companies",
    purpose: PURPOSE,
    inputSummary: { ...input, pass: reservation.passNumber, maxItems },
    resultSummary: null,
    status: "error",
    errorMessage: message,
  });

  // Permanent failure after retry — continue with the candidates already
  // found rather than crash the whole run (design.md Section 5).
  return { results: [], passNumber: reservation.passNumber, skipped: "discovery call failed" };
}

async function skip(runId: string, input: unknown, reason: string): Promise<DiscoverOutcome> {
  await logToolCall({
    runId,
    toolName: "discover_companies",
    purpose: PURPOSE,
    inputSummary: input,
    resultSummary: { skipped: true, reason },
    status: "success",
  });
  return { results: [], passNumber: null, skipped: reason };
}
