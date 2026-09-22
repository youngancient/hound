import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/supabase/auth";
import { supabaseService } from "@/lib/supabase/service";
import { inngest } from "@/lib/inngest/client";
import { CreateRunSchema } from "@/lib/schemas";
import { MAX_CANDIDATES, MAX_SCRAPES, MAX_QUALIFIED_LEADS, MAX_AGENT_TURNS } from "@/lib/agent-config";

/**
 * Creates a search. Idempotent on `idempotency_key` (design.md Section 10)
 * — a double-click or a network retry sends the same key twice; the
 * second insert is a no-op and returns the first run's id instead of
 * creating a duplicate.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateRunSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const db = supabaseService();

  const { data: existing } = await db
    .from("runs")
    .select("id")
    .eq("idempotency_key", parsed.data.idempotency_key)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ id: existing.id });
  }

  const { data: run, error } = await db
    .from("runs")
    .insert({
      objective: parsed.data.objective,
      status: "pending",
      created_by: user.id,
      created_by_email: user.email,
      idempotency_key: parsed.data.idempotency_key,
      tool_limits: {
        max_candidates: MAX_CANDIDATES,
        max_scrapes: MAX_SCRAPES,
        max_qualified_leads: MAX_QUALIFIED_LEADS,
        max_agent_turns: MAX_AGENT_TURNS,
      },
    })
    .select("id")
    .single();

  if (error || !run) {
    return NextResponse.json({ error: "Couldn't start your search — try again." }, { status: 500 });
  }

  await inngest.send({ name: "hound/search.requested", data: { runId: run.id } });

  return NextResponse.json({ id: run.id });
}
