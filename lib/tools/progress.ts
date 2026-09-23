import "server-only";
import { supabaseService } from "../supabase/service";
import { RefinedIcpSchema, type ToolLimits } from "../schemas";

/**
 * Everything a fresh agent session needs to pick up where the search is,
 * read from the database. Every session calls this first: on a first
 * attempt it's all empty, and after an automatic retry or a user's
 * "Continue search" it lists the saved ICP, what's been checked, and the
 * companies found but not yet checked (design.md Section 4).
 */
export async function getProgress(runId: string, limits: ToolLimits) {
  const db = supabaseService();

  const [{ data: run, error: runError }, { data: leads, error: leadsError }, { data: candidates, error: candError }] =
    await Promise.all([
      db
        .from("runs")
        .select("refined_icp, attempt, candidates_used, scrapes_used, discovery_passes_used")
        .eq("id", runId)
        .single(),
      db.from("leads").select("company_domain, qualification_status").eq("run_id", runId),
      db
        .from("candidates")
        .select("domain, data")
        .eq("run_id", runId)
        .is("ruled_out_reason", null)
        .order("discovered_at", { ascending: true }),
    ]);

  if (runError || !run) throw new Error(`getProgress failed: ${runError?.message ?? "run not found"}`);
  if (leadsError) throw new Error(`getProgress failed: ${leadsError.message}`);
  if (candError) throw new Error(`getProgress failed: ${candError.message}`);

  const checked = await checkedDomains(runId);
  const unchecked = (candidates ?? []).filter((c) => !checked.has(c.domain)).map((c) => c.data);
  const icp = RefinedIcpSchema.safeParse(run.refined_icp);
  const qualified = (leads ?? []).filter((l) => l.qualification_status === "qualified").length;

  return {
    attempt: run.attempt,
    icp_saved: icp.success,
    icp: icp.success ? icp.data : null,
    qualified_leads: qualified,
    qualified_target: limits.max_qualified_leads,
    companies_checked: (leads ?? []).length,
    unchecked_companies: unchecked,
    discovery_passes_left: Math.max(0, limits.max_discovery_passes - run.discovery_passes_used),
    companies_budget_left: Math.max(0, limits.max_candidates - run.candidates_used),
    scrapes_left: Math.max(0, limits.max_scrapes - run.scrapes_used),
  };
}

/**
 * Domains Hound has dealt with: saved as a lead, or scraped (even if the
 * page was blocked or empty and no lead was saved). Otherwise one
 * unscrapable site would count as "unchecked" forever.
 */
export async function checkedDomains(runId: string): Promise<Set<string>> {
  const db = supabaseService();
  const [{ data: leads, error: leadsError }, { data: scrapes, error: scrapesError }] = await Promise.all([
    db.from("leads").select("company_domain").eq("run_id", runId),
    db
      .from("tool_calls")
      .select("input_summary, result_summary")
      .eq("run_id", runId)
      .eq("tool_name", "scrape_website"),
  ]);
  if (leadsError) throw new Error(`checkedDomains failed: ${leadsError.message}`);
  if (scrapesError) throw new Error(`checkedDomains failed: ${scrapesError.message}`);

  const domains = new Set((leads ?? []).map((l) => l.company_domain));
  for (const s of scrapes ?? []) {
    const domain = (s.input_summary as { companyDomain?: string } | null)?.companyDomain;
    const skipped = (s.result_summary as { skipped?: boolean } | null)?.skipped === true;
    if (domain && !skipped) domains.add(domain);
  }
  return domains;
}

/** Companies discovered for this search that haven't been dealt with yet. */
export async function uncheckedCandidateCount(runId: string): Promise<number> {
  const [checked, { data: candidates, error }] = await Promise.all([
    checkedDomains(runId),
    supabaseService().from("candidates").select("domain").eq("run_id", runId).is("ruled_out_reason", null),
  ]);
  if (error) throw new Error(`uncheckedCandidateCount failed: ${error.message}`);
  return (candidates ?? []).filter((c) => !checked.has(c.domain)).length;
}
