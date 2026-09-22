import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/supabase/auth";
import { supabaseService } from "@/lib/supabase/service";
import { LeadEditSchema } from "@/lib/schemas";

/**
 * Human edit of outreach copy. Design.md Section 1/11: the client's own
 * key never writes to `leads` — this route is the one narrow, validated
 * door, using the same Zod schema shape the agent's own output goes
 * through (char limits included).
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const parsed = LeadEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid edit" }, { status: 400 });
  }

  const db = supabaseService();
  const { error } = await db
    .from("leads")
    .update({
      ...(parsed.data.outreach_sequence ? { outreach_sequence: parsed.data.outreach_sequence } : {}),
      ...(parsed.data.linkedin_message ? { linkedin_message: parsed.data.linkedin_message } : {}),
      outreach_edited_at: new Date().toISOString(),
      outreach_edited_by: user.id,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Couldn't save that edit — try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
