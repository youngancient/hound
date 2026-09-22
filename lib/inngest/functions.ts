import { inngest } from "./client";
import { supabaseService } from "../supabase/service";
import { runSearch } from "../agent/run-search";
import { postSearchFailure } from "../discord";
import { notifySearchComplete } from "../notify";

/**
 * One function per search. See artifact/design.md Sections 4 & 5:
 * - step 1 atomically claims the run (pending -> running) so a duplicate
 *   Inngest delivery of the same event can't race a second instance
 *   through the same work.
 * - step 2 runs the whole Agent SDK session.
 * - step 3 finalizes status/cost and fires the best-effort notifications.
 * A top-level catch is the backstop for anything unanticipated, including
 * a failure before a single tool call ran.
 */
export const searchPipeline = inngest.createFunction(
  { id: "search-pipeline", retries: 1, triggers: { event: "hound/search.requested" } },
  async ({ event, step }) => {
    const { runId } = event.data as { runId: string };
    const db = supabaseService();

    const claimed = await step.run("claim-run", async () => {
      const { data, error } = await db
        .from("runs")
        .update({ status: "running", current_stage: "Understanding the request" })
        .eq("id", runId)
        .eq("status", "pending")
        .select("id, objective, created_by_email")
        .single();

      if (error || !data) return null; // already claimed by another delivery — no-op
      return data as { id: string; objective: string; created_by_email: string };
    });

    if (!claimed) return { skipped: true };

    try {
      const { totalCostUsd } = await step.run("run-agent", () => runSearch(runId, claimed.objective));

      const qualifiedCount = await step.run("count-qualified", async () => {
        const { count } = await db
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("run_id", runId)
          .eq("qualification_status", "qualified");
        return count ?? 0;
      });

      const shortfallNote =
        qualifiedCount < 10
          ? `Found ${qualifiedCount} good fits — Hound searched again but ran out of new companies to check within the discovery budget.`
          : null;

      await step.run("finalize-success", () =>
        db
          .from("runs")
          .update({
            status: "completed",
            current_stage: "Done",
            completed_at: new Date().toISOString(),
            claude_cost_usd: totalCostUsd,
            status_note: shortfallNote,
          })
          .eq("id", runId)
      );

      await step.run("notify-success", () =>
        notifySearchComplete({
          toEmail: claimed.created_by_email,
          runId,
          objective: claimed.objective,
          qualifiedCount,
        })
      );

      return { qualifiedCount, totalCostUsd };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      // Best-effort — a failure writing the failure status must not
      // itself crash this function (design.md Section 5).
      await step
        .run("finalize-failure", () =>
          db
            .from("runs")
            .update({ status: "failed", status_note: message, completed_at: new Date().toISOString() })
            .eq("id", runId)
        )
        .catch((finalizeErr: unknown) => console.error("finalize-failure step failed:", finalizeErr));

      await step
        .run("notify-failure", () =>
          Promise.resolve(postSearchFailure({ runId, objective: claimed.objective, error: message }))
        )
        .catch((notifyErr: unknown) => console.error("notify-failure step failed:", notifyErr));

      throw err;
    }
  }
);
