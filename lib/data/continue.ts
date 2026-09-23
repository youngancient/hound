import "server-only";
import { supabaseService } from "../supabase/service";
import { ToolLimitsSchema } from "../schemas";
import { uncheckedCandidateCount } from "../tools/progress";

export type ContinueCheck = { ok: true } | { ok: false; reason: string };

/**
 * Whether a failed search has anything left to continue with: companies
 * already found but not yet checked, or discovery budget to find more,
 * and scrapes left to check them. If not, continuing would just end
 * again, so the UI offers Start over instead and says why.
 */
export async function checkContinue(runId: string): Promise<ContinueCheck> {
  const db = supabaseService();
  const [{ data: run, error }, unchecked] = await Promise.all([
    db
      .from("runs")
      .select("status, tool_limits, candidates_used, scrapes_used, discovery_passes_used")
      .eq("id", runId)
      .single(),
    uncheckedCandidateCount(runId),
  ]);

  if (error || !run) return { ok: false, reason: "We couldn't find this search." };
  if (run.status !== "failed") return { ok: false, reason: "Only a search that didn't finish can be continued." };

  const limits = ToolLimitsSchema.safeParse(run.tool_limits);
  if (!limits.success) return { ok: false, reason: "This search can't be continued. Start over to search again." };

  const canDiscover =
    run.discovery_passes_used < limits.data.max_discovery_passes && run.candidates_used < limits.data.max_candidates;
  const canScrape = run.scrapes_used < limits.data.max_scrapes;

  if (canScrape && (unchecked > 0 || canDiscover)) return { ok: true };
  return {
    ok: false,
    reason: "This search has used its whole budget, so there's nothing left to continue. Start over to search again.",
  };
}
