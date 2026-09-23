import "server-only";
import { supabaseService } from "../supabase/service";
import { RefinedIcpSchema, type RefinedIcp } from "../schemas";

/**
 * The refined ICP lives on the run (design.md Section 2) so the search
 * record shows what Hound understood — and so discovery filters are
 * computed from one validated, saved object rather than whatever the
 * agent passes on a given call.
 */
export async function saveRefinedIcp(
  runId: string,
  icp: RefinedIcp
): Promise<{ ok: true } | { ok: false; reason: string }> {
  // Locked once discovery starts: the saved ICP must be the one the
  // search actually ran with, not a later revision.
  const { data, error } = await supabaseService()
    .from("runs")
    .update({ refined_icp: icp })
    .eq("id", runId)
    .eq("discovery_passes_used", 0)
    .select("id");

  if (error) throw new Error(`saveRefinedIcp failed: ${error.message}`);
  if (!data || data.length === 0) {
    return { ok: false, reason: "discovery has already started — the ICP can no longer be changed for this search" };
  }
  return { ok: true };
}

export async function getRefinedIcp(runId: string): Promise<RefinedIcp | null> {
  const { data, error } = await supabaseService().from("runs").select("refined_icp").eq("id", runId).single();
  if (error) throw new Error(`getRefinedIcp failed: ${error.message}`);
  const parsed = RefinedIcpSchema.safeParse(data?.refined_icp);
  return parsed.success ? parsed.data : null;
}
