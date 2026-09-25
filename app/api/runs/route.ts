import { NextResponse, after } from "next/server";
import { postSearchFailure } from "@/lib/discord";
import { requireSessionUser } from "@/lib/supabase/auth";
import { supabaseService } from "@/lib/supabase/service";
import { inngest } from "@/lib/inngest/client";
import { CreateRunSchema } from "@/lib/schemas";
import {
  MAX_CANDIDATES,
  FIRST_PASS_CANDIDATES,
  MAX_DISCOVERY_PASSES,
  MAX_SCRAPES,
  MAX_QUALIFIED_LEADS,
  MAX_AGENT_TURNS,
} from "@/lib/agent-config";
import type { PreviousSearch, ToolLimits } from "@/lib/schemas";
import type { RunStatus } from "@/lib/labels";
import { normalizeQuery } from "@/lib/discovery";

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

  // Before anything is created or spent: if this exact request has been
  // searched before, hand back that search so the user can open it
  // instead of paying for the same search twice.
  if (!parsed.data.rerun) {
    const repeat = await findPreviousSearch(db, parsed.data.objective);
    if (repeat) {
      return NextResponse.json({ repeat: { ...repeat, mine: repeat.created_by === user.id } }, { status: 409 });
    }
  }

  const { data: run, error } = await db
    .from("runs")
    .insert({
      objective: parsed.data.objective,
      status: "pending",
      created_by: user.id,
      created_by_email: user.email,
      idempotency_key: parsed.data.idempotency_key,
      review_icp: parsed.data.review_icp ?? false,
      tool_limits: {
        max_candidates: MAX_CANDIDATES,
        first_pass_candidates: FIRST_PASS_CANDIDATES,
        max_discovery_passes: MAX_DISCOVERY_PASSES,
        max_scrapes: MAX_SCRAPES,
        max_qualified_leads: MAX_QUALIFIED_LEADS,
        max_agent_turns: MAX_AGENT_TURNS,
      } satisfies ToolLimits,
    })
    .select("id")
    .single();

  if (error || !run) {
    return NextResponse.json({ error: "We couldn't start your search. Please try again." }, { status: 500 });
  }

  // The row already exists, so a failed handoff must not leave it sitting
  // at "Getting started" forever: mark it failed so the search page shows
  // the reason and its Try again form.
  try {
    await inngest.send({ name: "hound/search.requested", data: { runId: run.id } });
  } catch (err) {
    console.error("inngest.send failed for run", run.id, err);
    // The team hears about it too: this is exactly when the background
    // job never ran, so its own failure alert can't fire. Sent after the
    // response so the user isn't kept waiting.
    after(() =>
      postSearchFailure({
        runId: run.id,
        objective: parsed.data.objective,
        error: `Couldn't hand the search to Inngest: ${err instanceof Error ? err.message : String(err)}`,
      })
    );
    await db
      .from("runs")
      .update({
        status: "failed",
        status_note: "Hound couldn't start this search. Please try again.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id);
    return NextResponse.json({ error: "We couldn't start your search. Please try again." }, { status: 502 });
  }

  return NextResponse.json({ id: run.id });
}

/**
 * The most recent search with the same request, ignoring case and
 * spacing (the same rule as `normalizeQuery`): a case-insensitive regex
 * over the whole objective, so the database does the exact match.
 */
async function findPreviousSearch(
  db: ReturnType<typeof supabaseService>,
  objective: string
): Promise<PreviousSearch | null> {
  const words = normalizeQuery(objective)
    .split(" ")
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = `^\\s*${words.join("\\s+")}\\s*$`;

  const { data: match } = await db
    .from("runs")
    .select("id, created_at, status, created_by, created_by_email")
    .filter("objective", "imatch", pattern)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!match) return null;

  const { count } = await db
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("run_id", match.id)
    .eq("qualification_status", "qualified");

  return {
    id: match.id,
    created_at: match.created_at,
    status: match.status as RunStatus,
    created_by: match.created_by,
    created_by_email: match.created_by_email,
    qualified_leads: count ?? 0,
  };
}
