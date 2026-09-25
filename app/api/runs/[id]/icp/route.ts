import { NextResponse, after } from "next/server";
import { postSearchFailure } from "@/lib/discord";
import { requireSessionUser } from "@/lib/supabase/auth";
import { supabaseService } from "@/lib/supabase/service";
import { inngest } from "@/lib/inngest/client";
import { ApproveIcpSchema, RefinedIcpSchema } from "@/lib/schemas";
import { applyIcpEdit, changedIcpFields } from "@/lib/icp-edit";
import { logToolCall } from "@/lib/tools/log-tool-call";

/**
 * Approves a waiting search's ICP, with the owner's edits or as Hound
 * wrote it, and starts the rest of the search (design.md Section 4).
 * Only the person who started it; only while it's waiting for review.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = ApproveIcpSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const { id } = await ctx.params;
  const db = supabaseService();

  const { data: run } = await db
    .from("runs")
    .select("created_by, objective, status, refined_icp")
    .eq("id", id)
    .maybeSingle();
  if (!run) return NextResponse.json({ error: "We couldn't find this search." }, { status: 404 });
  if (run.created_by !== user.id) {
    return NextResponse.json({ error: "Only the person who started this search can check it." }, { status: 403 });
  }
  if (run.status !== "awaiting_review") {
    return NextResponse.json({ error: "This search isn't waiting for you anymore. Refresh to see where it is." }, { status: 409 });
  }

  const original = RefinedIcpSchema.safeParse(run.refined_icp);
  if (!original.success) {
    return NextResponse.json({ error: "This search's ICP couldn't be read. Start a new search instead." }, { status: 409 });
  }

  const edit = parsed.data.icp;
  const changed = edit ? changedIcpFields(original.data, edit) : [];
  const approvedIcp = edit && changed.length > 0 ? applyIcpEdit(original.data, edit) : null;

  // Atomic: only the owner, only while waiting, only before discovery, so
  // a double-click can't start the search twice.
  const { data: approved, error } = await db.rpc("approve_icp", {
    p_run_id: id,
    p_user_id: user.id,
    p_icp: approvedIcp,
  });
  if (error || !approved) {
    return NextResponse.json({ error: "This search can't be started right now. Refresh and try again." }, { status: 409 });
  }

  // Part of the search's record: what the person changed, next to what
  // Hound had written.
  await logToolCall({
    runId: id,
    toolName: "review_icp",
    purpose: changed.length > 0 ? "The user edited the ICP before searching" : "The user approved the ICP as Hound wrote it",
    inputSummary: { changed },
    resultSummary: changed.length > 0 ? { before: original.data, after: approvedIcp } : null,
    status: "success",
  });

  try {
    await inngest.send({ name: "hound/search.requested", data: { runId: id } });
  } catch (err) {
    console.error("inngest.send failed after ICP approval", id, err);
    after(() =>
      postSearchFailure({
        runId: id,
        objective: run.objective,
        error: `Couldn't hand the approved search to Inngest: ${err instanceof Error ? err.message : String(err)}`,
      })
    );
    // Approved already, so Continue picks it up from here.
    await db
      .from("runs")
      .update({
        status: "failed",
        status_note: "Hound couldn't start this search. Please try again.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", id);
    return NextResponse.json({ error: "We couldn't start your search. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
