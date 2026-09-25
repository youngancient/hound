import { inngest } from "./client";
import { supabaseService } from "../supabase/service";
import { runSearch, type SessionEnd } from "../agent/run-search";
import { postSearchFailure } from "../discord";
import { notifyReviewReady, notifySearchComplete } from "../notify";
import { RefinedIcpSchema, ToolLimitsSchema, type ToolLimits } from "../schemas";

/**
 * One function per search. See artifact/design.md Sections 4 & 5:
 * - step 1 atomically claims the run (pending -> running) so a duplicate
 *   Inngest delivery of the same event can't race a second instance
 *   through the same work.
 * - step 2 runs the whole Agent SDK session. A search that asked for an
 *   ICP review runs an ICP-only session instead, then waits for the
 *   person: the function ends there, and approving sends the same event
 *   again, which starts a new run that goes straight to the full session.
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
        .select("id, objective, created_by_email, tool_limits, review_icp, icp_approved_at, refined_icp")
        .single();

      if (error || !data) return null; // already claimed by another delivery — no-op
      return data as {
        id: string;
        objective: string;
        created_by_email: string;
        tool_limits: unknown;
        review_icp: boolean;
        icp_approved_at: string | null;
        refined_icp: unknown;
      };
    });

    if (!claimed) return { skipped: true };

    try {
      // Every cap for this search comes from the run's own snapshot — a
      // malformed one fails the run here, before anything is spent.
      const limits: ToolLimits = ToolLimitsSchema.parse(claimed.tool_limits);

      // Review asked for and not yet given: save the ICP (unless a Continue
      // brought back one that's already saved), then wait for the person.
      if (claimed.review_icp && !claimed.icp_approved_at) {
        let totalCostUsd = 0;
        if (!RefinedIcpSchema.safeParse(claimed.refined_icp).success) {
          const icpStep = await step.run("refine-icp", () => runSearch(runId, claimed.objective, limits, "icp_only"));
          totalCostUsd = icpStep.totalCostUsd;
          if (icpStep.end === "declined") return { declined: true, totalCostUsd };
        }

        const reviewStartedAt = await step.run("await-review", async () => {
          const startedAt = new Date().toISOString();
          const { error } = await db
            .from("runs")
            .update({ status: "awaiting_review", review_started_at: startedAt })
            .eq("id", runId)
            .eq("status", "running");
          if (error) throw new Error(`Couldn't mark the search as waiting for review: ${error.message}`);
          return startedAt;
        });

        await step.sendEvent("schedule-review-expiry", {
          name: "hound/review.started",
          data: { runId, reviewStartedAt },
        });

        await step.run("notify-review-ready", () =>
          notifyReviewReady({ toEmail: claimed.created_by_email, runId, objective: claimed.objective })
        );

        return { awaitingReview: true, totalCostUsd };
      }

      // Throws on a broken session (see runSearch), which Inngest retries
      // once as a fresh session before the catch below marks it failed.
      const { totalCostUsd, end, uncheckedLeft } = await step.run("run-agent", () =>
        runSearch(runId, claimed.objective, limits)
      );

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

      const shortfallNote = explainShortfall(qualifiedCount, limits.max_qualified_leads, end, uncheckedLeft);

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

/**
 * A search waiting for its ICP review gives up after 24 hours, so
 * nothing is spent on criteria nobody approved. Guarded on the wait it
 * was scheduled for: an approved search, or one continued into a new
 * wait since, is left alone. Not an error, so no Discord alert.
 */
export const reviewExpiry = inngest.createFunction(
  { id: "review-expiry", retries: 2, triggers: { event: "hound/review.started" } },
  async ({ event, step }) => {
    const { runId, reviewStartedAt } = event.data as { runId: string; reviewStartedAt: string };

    await step.sleep("wait-for-review", "24h");

    const expired = await step.run("expire-review", async () => {
      const { data, error } = await supabaseService()
        .from("runs")
        // completed_at is when Hound stopped working, so the search's time
        // doesn't count the wait.
        .update({ status: "failed", status_note: REVIEW_EXPIRED_NOTE, completed_at: reviewStartedAt })
        .eq("id", runId)
        .eq("status", "awaiting_review")
        .eq("review_started_at", reviewStartedAt)
        .select("id");
      if (error) throw new Error(`expire-review failed: ${error.message}`);
      return (data?.length ?? 0) > 0;
    });

    return { expired };
  }
);

const REVIEW_EXPIRED_NOTE =
  "Nobody checked how Hound read this request within 24 hours, so it didn't search and nothing was spent finding companies. Continue to check it now.";

const FAILURE_NOTE =
  "Something went wrong and Hound couldn't finish this search. Any leads it found are listed below, and you can run the search again.";

/**
 * The user-facing reason a completed search came up short. Must match
 * what actually happened — a search that hit its step limit didn't "run
 * out of companies", and a user deciding whether a market is worth
 * pursuing reads this literally.
 */
function explainShortfall(qualifiedCount: number, target: number, end: SessionEnd, uncheckedLeft: number): string | null {
  if (qualifiedCount >= target) return null;
  const found = `Found ${qualifiedCount} lead${qualifiedCount === 1 ? "" : "s"}`;
  if (uncheckedLeft > 0) {
    return `${found}. Hound stopped before checking every company it found (${uncheckedLeft} ${uncheckedLeft === 1 ? "wasn't" : "weren't"} checked).`;
  }
  if (end === "limit_reached") {
    return `${found}. Hound hit its limit for this search before it could check every company.`;
  }
  return `${found}. Hound ran out of new companies to check for this search.`;
}
