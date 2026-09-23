import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/supabase/auth";
import { getLeadOwner, NOT_OWNER_MESSAGE } from "@/lib/data/ownership";
import { supabaseService } from "@/lib/supabase/service";
import { RegenerateRequestSchema } from "@/lib/schemas";
import { regenerateOutreachTarget } from "@/lib/agent/regenerate";

/**
 * No cap on how many times this can be called (design.md Section 1) —
 * matches the prior Flow project's precedent for regenerating a final,
 * format-specific output. Every call is still authenticated and logged
 * with its own real cost.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;

  // Checked before any Claude spend.
  const owner = await getLeadOwner(id);
  if (!owner) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  if (owner.ownerId !== user.id) return NextResponse.json({ error: NOT_OWNER_MESSAGE }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = RegenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "We couldn't rewrite that. Please try again." }, { status: 400 });
  }

  const db = supabaseService();
  const { data: lead } = await db
    .from("leads")
    .select("id, run_id, company_name, fit_reasons, source_summary, outreach_sequence, linkedin_message")
    .eq("id", id)
    .single();

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Anything unexpected is caught so it still gets logged below, instead
  // of crashing the route with nothing in tool_calls to explain it.
  let outcome: Awaited<ReturnType<typeof regenerateOutreachTarget>>;
  try {
    outcome = await regenerateOutreachTarget(parsed.data.target, parsed.data.feedback, {
      companyName: lead.company_name,
      fitReasons: (lead.fit_reasons as string[]) ?? [],
      sourceSummary: lead.source_summary,
    });
  } catch (err) {
    outcome = { ok: false, reason: err instanceof Error ? err.message : String(err), costUsd: 0 };
  }

  if (!outcome.ok) {
    await db.from("tool_calls").insert({
      run_id: lead.run_id,
      lead_id: lead.id,
      tool_name: "regenerate_outreach",
      purpose: `Regenerate ${parsed.data.target} on request`,
      input_summary: { target: parsed.data.target, feedback: parsed.data.feedback },
      result_summary: null,
      status: "error",
      error_message: outcome.reason,
      cost_usd: outcome.costUsd,
    });
    // Existing content is left untouched — never overwrite a good draft
    // with a failed attempt (design.md Section 5).
    return NextResponse.json({ error: "We couldn't rewrite that. Please try again." }, { status: 502 });
  }

  const sequence = Array.isArray(lead.outreach_sequence)
    ? [...(lead.outreach_sequence as unknown[])]
    : [null, null, null];

  // The write is checked: reporting success for a rewrite that wasn't
  // stored would show "Saved" and then lose it on reload.
  const edited = { outreach_edited_at: new Date().toISOString(), outreach_edited_by: user.id };
  let writeError;
  if (parsed.data.target === "linkedin_message") {
    ({ error: writeError } = await db
      .from("leads")
      .update({ linkedin_message: outcome.content as string, ...edited })
      .eq("id", id));
  } else {
    const index = { email_1: 0, email_2: 1, email_3: 2 }[parsed.data.target];
    sequence[index] = outcome.content;
    ({ error: writeError } = await db.from("leads").update({ outreach_sequence: sequence, ...edited }).eq("id", id));
  }

  if (writeError) {
    await db.from("tool_calls").insert({
      run_id: lead.run_id,
      lead_id: lead.id,
      tool_name: "regenerate_outreach",
      purpose: `Regenerate ${parsed.data.target} on request`,
      input_summary: { target: parsed.data.target, feedback: parsed.data.feedback },
      result_summary: null,
      status: "error",
      error_message: `Saving the rewrite failed: ${writeError.message}`,
      cost_usd: outcome.costUsd,
    });
    return NextResponse.json({ error: "We couldn't rewrite that. Please try again." }, { status: 500 });
  }

  await db.from("tool_calls").insert({
    run_id: lead.run_id,
    lead_id: lead.id,
    tool_name: "regenerate_outreach",
    purpose: `Regenerate ${parsed.data.target} on request`,
    input_summary: { target: parsed.data.target, feedback: parsed.data.feedback },
    result_summary: { ok: true },
    status: "success",
    cost_usd: outcome.costUsd,
  });

  return NextResponse.json({ ok: true, target: parsed.data.target, content: outcome.content });
}
