import "server-only";
import { supabaseService } from "../supabase/service";
import { RefinedIcpSchema } from "../schemas";
import { checkContinue, type ContinueCheck } from "./continue";
import { uncheckedCandidateCount } from "../tools/progress";

/**
 * found = ruledOut + checked + unchecked, always.
 * - ruledOut: bought from LinkedIn but excluded by code before checking
 *   (no usable website, size or HQ country outside the request). Expected.
 * - checked: companies Hound assessed. Once the search has ended this also
 *   includes websites it read but couldn't use; while it's running, those
 *   are "being assessed" instead, so the count matches the list.
 * - unchecked: saved companies nobody got to. The same count the status
 *   note uses, so the page never shows two different numbers.
 * Searches from before candidates were saved can't split ruled-out from
 * unchecked, so everything not assessed counts as unchecked there.
 */
export type SearchFunnelCounts = {
  found: number;
  ruledOut: number;
  checked: number;
  /** Read but not yet assessed (only while running). */
  beingAssessed: number;
  unchecked: number;
  leads: number;
};

async function funnelFor(
  runId: string,
  found: number,
  assessed: number,
  leads: number,
  isActive: boolean
): Promise<SearchFunnelCounts> {
  const { count, error } = await supabaseService()
    .from("candidates")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId)
    .is("ruled_out_reason", null);
  if (error) throw new Error(`Loading search funnel failed: ${error.message}`);
  const saved = count ?? 0;

  if (saved === 0) {
    return { found, ruledOut: 0, checked: assessed, beingAssessed: 0, unchecked: Math.max(0, found - assessed), leads };
  }
  const unchecked = await uncheckedCandidateCount(runId);
  const dealtWith = Math.max(assessed, saved - unchecked);
  return {
    found,
    ruledOut: Math.max(0, found - saved),
    checked: isActive ? assessed : dealtWith,
    beingAssessed: isActive ? dealtWith - assessed : 0,
    unchecked,
    leads,
  };
}

/**
 * Run cost = runs.claude_cost_usd + SUM(tool_calls.cost_usd) — computed at
 * read time, not a maintained running total, so it can't drift from the
 * tool_calls log that's the actual source of truth (design.md Section 7).
 */
async function costForRuns(runIds: string[]): Promise<Record<string, number>> {
  if (runIds.length === 0) return {};
  const { data, error } = await supabaseService().from("tool_calls").select("run_id, cost_usd").in("run_id", runIds);
  if (error) throw new Error(`Loading search costs failed: ${error.message}`);

  const totals: Record<string, number> = {};
  for (const row of data ?? []) {
    totals[row.run_id] = (totals[row.run_id] ?? 0) + (row.cost_usd ?? 0);
  }
  return totals;
}

export async function listSearches() {
  const db = supabaseService();
  // Errors throw (to app/error.tsx) rather than returning an empty list —
  // a database problem must never look like "No searches yet".
  const { data: runs, error } = await db
    .from("runs")
    .select("id, objective, status, status_note, current_stage, claude_cost_usd, created_by, created_by_email, created_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Loading searches failed: ${error.message}`);
  if (!runs || runs.length === 0) return [];

  const runIds = runs.map((r) => r.id);
  const toolCosts = await costForRuns(runIds);

  const { data: leadCounts, error: leadsError } = await db
    .from("leads")
    .select("run_id, qualification_status")
    .in("run_id", runIds);
  if (leadsError) throw new Error(`Loading lead counts failed: ${leadsError.message}`);

  const qualifiedByRun: Record<string, number> = {};
  const checkedByRun: Record<string, number> = {};
  for (const lead of leadCounts ?? []) {
    checkedByRun[lead.run_id] = (checkedByRun[lead.run_id] ?? 0) + 1;
    if (lead.qualification_status === "qualified") {
      qualifiedByRun[lead.run_id] = (qualifiedByRun[lead.run_id] ?? 0) + 1;
    }
  }

  return runs.map((run) => ({
    ...run,
    qualifiedCount: qualifiedByRun[run.id] ?? 0,
    // Companies Hound assessed and saved (any verdict).
    checkedCount: checkedByRun[run.id] ?? 0,
    totalCostUsd: (run.claude_cost_usd ?? 0) + (toolCosts[run.id] ?? 0),
  }));
}

export async function getSearch(runId: string) {
  const db = supabaseService();
  // null only when the search genuinely doesn't exist (a 404); any other
  // failure throws, so it isn't mistaken for "not found".
  const { data: run, error } = await db.from("runs").select("*").eq("id", runId).maybeSingle();
  if (error) throw new Error(`Loading search failed: ${error.message}`);
  if (!run) return null;

  const { data: leads, error: leadsError } = await db
    .from("leads")
    .select(
      "id, company_name, company_domain, qualification_status, confidence, fit_reasons, concerns, source_urls, source_summary, outreach_sequence, linkedin_message, outreach_edited_at, created_at"
    )
    .eq("run_id", runId)
    .order("created_at", { ascending: true });
  if (leadsError) throw new Error(`Loading leads failed: ${leadsError.message}`);

  const toolCosts = await costForRuns([runId]);

  const icp = RefinedIcpSchema.safeParse(run.refined_icp);
  const continueCheck: ContinueCheck | null = run.status === "failed" ? await checkContinue(runId) : null;
  const allLeads = leads ?? [];
  const funnel = await funnelFor(
    runId,
    Number(run.candidates_used ?? 0),
    allLeads.length,
    allLeads.filter((l) => l.qualification_status === "qualified").length,
    run.status === "pending" || run.status === "running"
  );

  return {
    run: { ...run, totalCostUsd: (run.claude_cost_usd ?? 0) + (toolCosts[runId] ?? 0) },
    icp: icp.success ? icp.data : null,
    continueCheck,
    funnel,
    leads: leads ?? [],
  };
}

export async function getLead(leadId: string) {
  const db = supabaseService();
  const { data: lead, error } = await db
    .from("leads")
    .select("*, runs!inner(created_by, created_by_email)")
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw new Error(`Loading lead failed: ${error.message}`);
  if (!lead) return null;

  const run = (Array.isArray(lead.runs) ? lead.runs[0] : lead.runs) as { created_by: string; created_by_email: string };
  return {
    lead,
    owner: { id: run.created_by, email: run.created_by_email },
    toolCalls: await leadActivity(lead.id, lead.run_id, lead.company_domain),
  };
}

const ACTIVITY_COLUMNS = "id, tool_name, purpose, status, error_message, cost_usd, created_at";

/**
 * The steps behind one lead, oldest first. Only save_lead (and later
 * rewrites) carry a lead_id: the LinkedIn search and the website read
 * happen before the lead row exists. So the website reads are matched on
 * the domain they logged, and the search on the pass that saved this
 * company as a candidate (the first successful one logged after it).
 * Skipped reads are left out; nothing was read.
 */
async function leadActivity(leadId: string, runId: string, domain: string) {
  const db = supabaseService();
  const [linked, scrapes, candidate] = await Promise.all([
    db.from("tool_calls").select(ACTIVITY_COLUMNS).eq("lead_id", leadId),
    db
      .from("tool_calls")
      .select(`${ACTIVITY_COLUMNS}, result_summary`)
      .eq("run_id", runId)
      .eq("tool_name", "scrape_website")
      .eq("input_summary->>companyDomain", domain),
    db.from("candidates").select("discovered_at").eq("run_id", runId).eq("domain", domain).maybeSingle(),
  ]);
  for (const res of [linked, scrapes, candidate]) {
    if (res.error) throw new Error(`Loading lead activity failed: ${res.error.message}`);
  }

  let discovery: typeof linked.data = [];
  if (candidate.data) {
    const found = await db
      .from("tool_calls")
      .select(ACTIVITY_COLUMNS)
      .eq("run_id", runId)
      .eq("tool_name", "discover_companies")
      .eq("status", "success")
      .gte("created_at", candidate.data.discovered_at)
      .order("created_at", { ascending: true })
      .limit(1);
    if (found.error) throw new Error(`Loading lead activity failed: ${found.error.message}`);
    discovery = found.data;
  }

  const reads = (scrapes.data ?? [])
    .filter((c) => !(c.result_summary as { skipped?: boolean } | null)?.skipped)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ result_summary, ...call }) => call);

  const byId = new Map([...(discovery ?? []), ...reads, ...(linked.data ?? [])].map((c) => [c.id, c]));
  return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}
