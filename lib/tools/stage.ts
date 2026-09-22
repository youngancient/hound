import "server-only";
import { supabaseService } from "../supabase/service";

/**
 * Not in design.md's original schema — added while building because
 * frontend-design.md's plain-language pipeline trail needs something to
 * render against beyond the 4-value `status` enum. Best-effort: a failed
 * write here must never break the tool call it's attached to.
 */
export async function setCurrentStage(runId: string, stage: string): Promise<void> {
  try {
    await supabaseService().from("runs").update({ current_stage: stage }).eq("id", runId);
  } catch (err) {
    console.error("setCurrentStage failed:", err);
  }
}
