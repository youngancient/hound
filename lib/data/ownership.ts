import "server-only";
import { supabaseService } from "../supabase/service";

/**
 * Everyone in the workspace can read every search, but only the person
 * who started a search may change it (its leads' outreach). The API
 * routes are the only write path to `leads`, so checking here is the
 * enforcement; the UI mirrors it so nobody meets a button that fails.
 */
export type LeadOwner = { runId: string; ownerId: string; ownerEmail: string };

export async function getLeadOwner(leadId: string): Promise<LeadOwner | null> {
  const { data, error } = await supabaseService()
    .from("leads")
    .select("run_id, runs!inner(created_by, created_by_email)")
    .eq("id", leadId)
    .maybeSingle();

  if (error) throw new Error(`Loading lead owner failed: ${error.message}`);
  if (!data) return null;

  const run = (Array.isArray(data.runs) ? data.runs[0] : data.runs) as { created_by: string; created_by_email: string };
  return { runId: data.run_id, ownerId: run.created_by, ownerEmail: run.created_by_email };
}

export const NOT_OWNER_MESSAGE = "Only the person who started this search can change its outreach.";
