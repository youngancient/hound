import "server-only";
import { runLinkedinCompanySearch, type LinkedinCompanyResult } from "../apify";
import { logToolCall } from "./log-tool-call";
import { leadCountForRun } from "./save-lead";
import { MAX_CANDIDATES, APIFY_COST_PER_LINKEDIN_RESULT, APIFY_RETRY_LIMIT } from "../agent-config";

/**
 * Discovery tool — Apify only, per the PRD. Defense in depth (design.md
 * Section 3): (a) requested maxItems is clamped server-side, never passed
 * through raw from the agent, (b) the run's *current* candidate count is
 * re-checked against Supabase (not an in-memory counter) before allowing
 * more discovery, so this tool won't exceed MAX_CANDIDATES no matter how
 * many times the agent calls it, (c) actor failures are caught and logged
 * rather than propagating as an unhandled crash.
 */
export async function discoverCompanies(
  runId: string,
  input: {
    searchQueries: string[];
    industries?: string[];
    locations?: string[];
    companySizes?: string[];
    requestedCount: number;
  }
): Promise<{ results: LinkedinCompanyResult[]; remainingBudget: number }> {
  const existing = await leadCountForRun(runId);
  const remainingBudget = Math.max(0, MAX_CANDIDATES - existing);

  if (remainingBudget === 0) {
    await logToolCall({
      runId,
      toolName: "discover_companies",
      purpose: "Find candidate companies via LinkedIn company search",
      inputSummary: input,
      resultSummary: { skipped: true, reason: "MAX_CANDIDATES already reached" },
      status: "success",
    });
    return { results: [], remainingBudget: 0 };
  }

  const maxItems = Math.min(input.requestedCount, remainingBudget);

  let attempt = 0;
  let lastError: unknown;

  while (attempt <= APIFY_RETRY_LIMIT) {
    try {
      const results = await runLinkedinCompanySearch({
        searchQueries: input.searchQueries,
        industries: input.industries,
        locations: input.locations,
        companySizes: input.companySizes,
        maxItems,
      });

      await logToolCall({
        runId,
        toolName: "discover_companies",
        purpose: "Find candidate companies via LinkedIn company search",
        inputSummary: { ...input, clampedMaxItems: maxItems },
        resultSummary: { count: results.length },
        status: "success",
        costUsd: results.length * APIFY_COST_PER_LINKEDIN_RESULT,
      });

      return { results, remainingBudget: remainingBudget - results.length };
    } catch (err) {
      lastError = err;
      attempt++;
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  await logToolCall({
    runId,
    toolName: "discover_companies",
    purpose: "Find candidate companies via LinkedIn company search",
    inputSummary: { ...input, clampedMaxItems: maxItems },
    resultSummary: null,
    status: "error",
    errorMessage: message,
  });

  // Permanent failure after retry — continue with fewer candidates from
  // other queries rather than crash the whole run (design.md Section 5).
  return { results: [], remainingBudget };
}
