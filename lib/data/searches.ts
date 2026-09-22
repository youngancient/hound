import "server-only";
import { supabaseService } from "../supabase/service";

/**
 * Run cost = runs.claude_cost_usd + SUM(tool_calls.cost_usd) — computed at
 * read time, not a maintained running total, so it can't drift from the
 * tool_calls log that's the actual source of truth (design.md Section 7).
 */
async function costForRuns(runIds: string[]): Promise<Record<string, number>> {
  if (runIds.length === 0) return {};
  const { data } = await supabaseService().from("tool_calls").select("run_id, cost_usd").in("run_id", runIds);

  const totals: Record<string, number> = {};
  for (const row of data ?? []) {
    totals[row.run_id] = (totals[row.run_id] ?? 0) + (row.cost_usd ?? 0);
  }
  return totals;
}

export async function listSearches() {
  const db = supabaseService();
  const { data: runs } = await db
    .from("runs")
    .select("id, objective, status, status_note, current_stage, claude_cost_usd, created_at")
    .order("created_at", { ascending: false });

  if (!runs) return [];

  const runIds = runs.map((r) => r.id);
  const toolCosts = await costForRuns(runIds);

  const { data: leadCounts } = await db.from("leads").select("run_id, qualification_status").in("run_id", runIds);

  const qualifiedByRun: Record<string, number> = {};
  for (const lead of leadCounts ?? []) {
    if (lead.qualification_status === "qualified") {
      qualifiedByRun[lead.run_id] = (qualifiedByRun[lead.run_id] ?? 0) + 1;
    }
  }

  return runs.map((run) => ({
    ...run,
    qualifiedCount: qualifiedByRun[run.id] ?? 0,
    totalCostUsd: (run.claude_cost_usd ?? 0) + (toolCosts[run.id] ?? 0),
  }));
}

export async function getSearch(runId: string) {
  const db = supabaseService();
  const { data: run } = await db.from("runs").select("*").eq("id", runId).single();
  if (!run) return null;

  const { data: leads } = await db
    .from("leads")
    .select(
      "id, company_name, company_domain, qualification_status, confidence, fit_reasons, concerns, source_urls, source_summary, outreach_sequence, linkedin_message, outreach_edited_at, created_at"
    )
    .eq("run_id", runId)
    .order("created_at", { ascending: true });

  const toolCosts = await costForRuns([runId]);

  return {
    run: { ...run, totalCostUsd: (run.claude_cost_usd ?? 0) + (toolCosts[runId] ?? 0) },
    leads: leads ?? [],
  };
}

export async function getLead(leadId: string) {
  const db = supabaseService();
  const { data: lead } = await db.from("leads").select("*").eq("id", leadId).single();
  if (!lead) return null;

  const { data: toolCalls } = await db
    .from("tool_calls")
    .select("id, tool_name, purpose, status, error_message, cost_usd, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: true });

  return { lead, toolCalls: toolCalls ?? [] };
}
