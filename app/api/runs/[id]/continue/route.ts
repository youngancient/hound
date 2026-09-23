import { NextResponse, after } from "next/server";
import { postSearchFailure } from "@/lib/discord";
import { requireSessionUser } from "@/lib/supabase/auth";
import { supabaseService } from "@/lib/supabase/service";
import { inngest } from "@/lib/inngest/client";
import { checkContinue } from "@/lib/data/continue";

/**
 * "Continue search": puts a failed search back in the queue as the same
 * search, keeping its leads, saved companies, ICP and remaining budget
 * (design.md Section 4). Only the person who started it can continue it.
 */
export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const db = supabaseService();

  const { data: run } = await db.from("runs").select("created_by, objective").eq("id", id).maybeSingle();
  if (!run) return NextResponse.json({ error: "We couldn't find this search." }, { status: 404 });
  if (run.created_by !== user.id) {
    return NextResponse.json({ error: "Only the person who started this search can continue it." }, { status: 403 });
  }

  const check = await checkContinue(id);
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 409 });

  // Atomic: only from 'failed', only by the owner, so a double-click can't
  // start two attempts.
  const { data: attempt, error } = await db.rpc("continue_run", { p_run_id: id, p_user_id: user.id });
  if (error || attempt === null) {
    return NextResponse.json({ error: "This search can't be continued right now. Refresh and try again." }, { status: 409 });
  }

  try {
    await inngest.send({ name: "hound/search.requested", data: { runId: id, attempt } });
  } catch (err) {
    console.error("inngest.send failed continuing run", id, err);
    after(() =>
      postSearchFailure({
        runId: id,
        objective: run.objective,
        error: `Couldn't hand the continued search to Inngest: ${err instanceof Error ? err.message : String(err)}`,
      })
    );
    await db
      .from("runs")
      .update({
        status: "failed",
        status_note: "Hound couldn't continue this search. Please try again.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);
    return NextResponse.json({ error: "We couldn't continue your search. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, attempt });
}
