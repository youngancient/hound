import { inngest } from "./client";
import { supabaseService } from "../supabase/service";
import { runSearch, type SessionEnd } from "../agent/run-search";
import { postSearchFailure } from "../discord";
import { notifySearchComplete } from "../notify";
import { ToolLimitsSchema, type ToolLimits } from "../schemas";

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
        .select("id, objective, created_by_email, tool_limits")
        .single();

      if (error || !data) return null; // already claimed by another delivery — no-op
      return data as { id: string; objective: string; created_by_email: string; tool_limits: unknown };
    });

    if (!claimed) return { skipped: true };

    try {
      // Every cap for this search comes from the run's own snapshot — a
      // malformed one fails the run here, before anything is spent.
      const limits: ToolLimits = ToolLimitsSchema.parse(claimed.tool_limits);

      // Throws on a broken session (see runSearch), which Inngest retries
      // once as a fresh session before the catch below marks it failed.
      const { totalCostUsd, end } = await step.run("run-agent", () => runSearch(runId, claimed.objective, limits));

      // Already marked declined (with its reason) by the cant_search_this
      // tool. Nothing was searched, so no completion email either.
      if (end === "declined") return { declined: true, totalCostUsd };

      const qualifiedCount = await step.run("count-qualified", async () => {
        const { count } = await db
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("run_id", runId)
          .eq("qualification_status", "qualified");
        return count ?? 0;
      });

      const shortfallNote = explainShortfall(qualifiedCount, limits.max_qualified_leads, end);

      await step.run("finalize-success", () =>
        db
          .from("runs")
          .update({
            status: "completed",
            current_stage: "Done",
            completed_at: new Date().toISOString(),
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
      // Technical detail goes to Discord; the search page shows the person
      // who ran it a plain explanation instead (frontend-design.md).
      const message = err instanceof Error ? err.message : String(err);

      // Best-effort — a failure writing the failure status must not
      // itself crash this function (design.md Section 5).
      await step
        .run("finalize-failure", () =>
          db
            .from("runs")
            .update({ status: "failed", status_note: FAILURE_NOTE, completed_at: new Date().toISOString() })
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

const FAILURE_NOTE =
  "Something went wrong and Hound couldn't finish this search. Any good fits it found are listed below, and you can run the search again.";

/**
 * The user-facing reason a completed search came up short. Must match
 * what actually happened — a search that hit its step limit didn't "run
 * out of companies", and a user deciding whether a market is worth
 * pursuing reads this literally.
 */
function explainShortfall(qualifiedCount: number, target: number, end: SessionEnd): string | null {
  if (qualifiedCount >= target) return null;
  const found = `Found ${qualifiedCount} good fit${qualifiedCount === 1 ? "" : "s"}`;
  if (end === "limit_reached") {
    return `${found}. Hound hit its limit for this search before it could check every company.`;
  }
  return `${found}. Hound ran out of new companies to check for this search.`;
}
