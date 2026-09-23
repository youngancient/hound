import "server-only";
import { supabaseService } from "../supabase/service";

/**
 * Thin wrappers over the budget functions in supabase/migrations/0001_init.sql
 * (design.md Section 3/4). Reservation happens *before* the paid call, in
 * the database, against the run's own `tool_limits` — so the caps hold
 * across parallel tool calls, retried Inngest steps, and companies that are
 * discovered or scraped but never saved as leads.
 */

export type DiscoveryReservation = {
  granted: number;
  passNumber: number;
  reason: string;
};

export async function reserveDiscovery(runId: string): Promise<DiscoveryReservation> {
  const { data, error } = await supabaseService()
    .rpc("reserve_discovery", { p_run_id: runId })
    .single<{ granted: number; pass_number: number; reason: string }>();

  if (error || !data) throw new Error(`reserveDiscovery failed: ${error?.message ?? "no row"}`);
  return { granted: data.granted, passNumber: data.pass_number, reason: data.reason };
}

/** Best-effort: a failed refund only makes the run more conservative, never over budget. */
export async function releaseCandidates(runId: string, count: number): Promise<void> {
  if (count <= 0) return;
  const { error } = await supabaseService().rpc("release_candidates", { p_run_id: runId, p_count: count });
  if (error) console.error("releaseCandidates failed:", error.message);
}

export async function reserveScrape(runId: string): Promise<boolean> {
  const { data, error } = await supabaseService().rpc("reserve_scrape", { p_run_id: runId });
  if (error) throw new Error(`reserveScrape failed: ${error.message}`);
  return data === true;
}
