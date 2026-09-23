import { NextResponse } from "next/server";
import { requireSessionUser } from "@/lib/supabase/auth";
import { listLeads, leadCsvColumns } from "@/lib/data/leads";
import { toCsv } from "@/lib/csv";

/** The Leads page's current view (same filters) as a CSV. */
export async function GET(request: Request) {
  let user;
  try {
    user = await requireSessionUser();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const rows = await listLeads({
    userId: user.id,
    scope: params.get("scope") === "all" ? "all" : "mine",
    q: params.get("q"),
    sort: params.get("sort") === "date" ? "date" : "confidence",
    includeReview: params.get("include") === "needs_review",
  });

  return new NextResponse(toCsv(rows, leadCsvColumns(params.get("outreach") === "1")), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="hound-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
