import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/supabase/auth";
import { listLeads, leadCsvColumns } from "@/lib/data/leads";
import { toCsv } from "@/lib/csv";

/** One search's leads as a CSV. Any signed-in teammate can export (searches are shared to read). */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const url = new URL(request.url);
  const rows = await listLeads({
    userId: user.id,
    scope: "all",
    runId: id,
    includeReview: url.searchParams.get("include") === "needs_review",
  });

  return new NextResponse(toCsv(rows, leadCsvColumns(url.searchParams.get("outreach") === "1")), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hound-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
