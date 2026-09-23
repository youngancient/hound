import "server-only";
import { runCompanySearch } from "../apify";
import { supabaseService } from "../supabase/service";
import { logToolCall } from "./log-tool-call";
import { qualifiedLeadCountForRun } from "./save-lead";
import { reserveDiscovery, releaseCandidates } from "./budget";
import { getRefinedIcp } from "./icp";
import { uncheckedCandidateCount } from "./progress";
import {
  buildActorInputs,
  candidateKey,
  mapCompany,
  normalizeQuery,
  screenCandidates,
  type ActorInput,
  type CompanyCandidate,
  type DropReason,
} from "../discovery";
import { APIFY_COST_PER_LINKEDIN_RESULT, APIFY_RETRY_LIMIT } from "../agent-config";
import type { ToolLimits } from "../schemas";

const PURPOSE = "Find candidate companies via LinkedIn company search";

export type DiscoverOutcome = {
  companies: CompanyCandidate[];
  passNumber: number | null;
  droppedBeforeScraping?: Partial<Record<DropReason, number>>;
  skipped?: string;
};

type Attempt = { filtered: boolean; count?: number; error?: string };

/**
 * Discovery tool — Apify only, per the PRD. Defense in depth (design.md
 * Section 3):
 * (a) the agent supplies only the query text. `maxItems` is whatever the
 *     database grants from the run's `tool_limits`, reserved atomically
 *     before the paid call; size and location filters are computed in
 *     code from the saved ICP (lib/discovery.ts).
 * (b) a query already used in this run is refused — the actor pages in
 *     50s, so repeating one re-buys the same companies.
 * (c) the actor sometimes returns an empty page for a query that has
 *     results, so zero results are retried once before being believed.
 * (d) a failed filtered run falls back once to an unfiltered one (country
 *     in the text instead), so a rejected filter value costs relevance,
 *     never the search.
 * (e) results are cleaned and screened in code (website, size, HQ
 *     country) before the agent ever sees them.
 */
export async function discoverCompanies(
  runId: string,
  limits: ToolLimits,
  searchQuery: string
): Promise<DiscoverOutcome> {
  // All refusals below are checked before reserving, so none spends a pass.
  const icp = await getRefinedIcp(runId);
  if (!icp) {
    return skip(runId, searchQuery, "no refined ICP saved yet — call save_icp first");
  }

  if ((await qualifiedLeadCountForRun(runId)) >= limits.max_qualified_leads) {
    return skip(runId, searchQuery, "qualified-lead target already reached");
  }

  const normalizedQuery = normalizeQuery(searchQuery);
  if (await queryAlreadyUsed(runId, normalizedQuery)) {
    return skip(runId, searchQuery, "this query was already used in this search — rephrase it for the re-search");
  }

  // The re-search is for when the first batch didn't reach the target, so
  // it waits until that batch has been checked. Otherwise it spends budget
  // on new companies while paid-for ones sit unchecked.
  const unchecked = await uncheckedCandidateCount(runId);
  if (unchecked > 0) {
    return skip(
      runId,
      searchQuery,
      `check the ${unchecked} ${unchecked === 1 ? "company" : "companies"} already found first (call get_progress for the list); search again only if they don't reach the target`
    );
  }

  const reservation = await reserveDiscovery(runId);
  if (reservation.granted === 0) {
    return skip(runId, searchQuery, reservation.reason);
  }

  const icpFilters = {
    headcount: { min: icp.headcount_min, max: icp.headcount_max },
    countryCodes: icp.country_codes,
  };
  const { filtered, fallback } = buildActorInputs(searchQuery, reservation.granted, icpFilters);
  const plan: ActorInput[] = fallback ? [filtered, fallback] : Array(APIFY_RETRY_LIMIT + 1).fill(filtered);

  const attempts: Attempt[] = [];
  let items: unknown[] | null = null;
  let usedInput: ActorInput | null = null;

  for (const input of plan) {
    try {
      items = await runWithEmptyRetry(input, attempts);
      usedInput = input;
      break;
    } catch (err) {
      attempts.push({ filtered: isFiltered(input), error: errorMessage(err) });
    }
  }

  const inputSummary = { searchQuery, normalizedQuery, pass: reservation.passNumber, actorInput: usedInput ?? filtered };

  if (items === null) {
    // Nothing was bought, so the candidates go back — but the pass stays
    // spent, which keeps the number of discovery attempts per run bounded.
    await releaseCandidates(runId, reservation.granted);
    await logToolCall({
      runId,
      toolName: "discover_companies",
      purpose: PURPOSE,
      inputSummary,
      resultSummary: { attempts },
      status: "error",
      errorMessage: attempts.map((a) => a.error).filter(Boolean).join(" | "),
    });
    // Permanent failure — continue with the candidates already found
    // rather than crash the whole run (design.md Section 5).
    return { companies: [], passNumber: reservation.passNumber, skipped: "discovery call failed" };
  }

  await releaseCandidates(runId, Math.max(0, reservation.granted - items.length));

  const candidates = items.map(mapCompany).filter((c): c is CompanyCandidate => c !== null);
  const { kept, dropped } = screenCandidates(candidates, icpFilters);
  const droppedBeforeScraping: Partial<Record<DropReason, number>> = {};
  for (const d of dropped) droppedBeforeScraping[d.reason] = (droppedBeforeScraping[d.reason] ?? 0) + 1;

  // Checkpoint: a retry or a continued search picks these up rather than
  // losing companies that were found (and paid for) but not yet checked.
  await saveCandidates(runId, kept, dropped);

  await logToolCall({
    runId,
    toolName: "discover_companies",
    purpose: PURPOSE,
    inputSummary,
    resultSummary: {
      returned: items.length,
      kept: kept.length,
      dropped: dropped.map(({ name, reason }) => ({ name, reason })),
      attempts,
      usedFallback: usedInput === fallback,
    },
    status: "success",
    costUsd: items.length * APIFY_COST_PER_LINKEDIN_RESULT,
  });

  return { companies: kept, passNumber: reservation.passNumber, droppedBeforeScraping };
}

/** An empty result is retried once with the same input before it's believed (test run A: 0, then 600 on re-run). */
async function runWithEmptyRetry(input: ActorInput, attempts: Attempt[]): Promise<unknown[]> {
  const filtered = isFiltered(input);
  const first = await runCompanySearch(input);
  attempts.push({ filtered, count: first.length });
  if (first.length > 0) return first;

  const second = await runCompanySearch(input);
  attempts.push({ filtered, count: second.length });
  return second;
}

/** Best-effort: failing to checkpoint must not throw away results already bought. */
async function saveCandidates(
  runId: string,
  kept: CompanyCandidate[],
  dropped: Array<{ reason: DropReason; company: CompanyCandidate }>
): Promise<void> {
  const rows = [
    ...kept.map((c) => ({ run_id: runId, domain: candidateKey(c), name: c.name, data: c, ruled_out_reason: null })),
    // Ruled out before checking, kept so "All companies" can list them with the reason.
    ...dropped.map((d) => ({
      run_id: runId,
      domain: candidateKey(d.company),
      name: d.company.name,
      data: d.company,
      ruled_out_reason: d.reason,
    })),
  ];
  if (rows.length === 0) return;

  const db = supabaseService();
  const { error } = await db.from("candidates").upsert(rows, { onConflict: "run_id,domain", ignoreDuplicates: true });
  if (!error) return;

  // Before migration 0003 there's no ruled_out_reason column: still save the
  // companies that passed the checks, since resuming depends on them.
  console.error("saveCandidates failed, retrying without ruled-out companies:", error.message);
  const keptOnly = kept.map((c) => ({ run_id: runId, domain: candidateKey(c), name: c.name, data: c }));
  if (keptOnly.length === 0) return;
  const retry = await db.from("candidates").upsert(keptOnly, { onConflict: "run_id,domain", ignoreDuplicates: true });
  if (retry.error) console.error("saveCandidates failed:", retry.error.message);
}

async function queryAlreadyUsed(runId: string, normalizedQuery: string): Promise<boolean> {
  const { count, error } = await supabaseService()
    .from("tool_calls")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId)
    .eq("tool_name", "discover_companies")
    .eq("input_summary->>normalizedQuery", normalizedQuery);

  if (error) throw new Error(`queryAlreadyUsed check failed: ${error.message}`);
  return (count ?? 0) > 0;
}

async function skip(runId: string, searchQuery: string, reason: string): Promise<DiscoverOutcome> {
  await logToolCall({
    runId,
    toolName: "discover_companies",
    purpose: PURPOSE,
    inputSummary: { searchQuery },
    resultSummary: { skipped: true, reason },
    status: "success",
  });
  return { companies: [], passNumber: null, skipped: reason };
}

function isFiltered(input: ActorInput): boolean {
  return input.companySize !== undefined || input.locations !== undefined;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
