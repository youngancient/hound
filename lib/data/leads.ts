import "server-only";
import { supabaseService } from "../supabase/service";
import type { CsvColumn } from "../csv";

export type LeadListFilters = {
  userId: string;
  scope: "mine" | "all";
  q?: string | null;
  sort?: "confidence" | "date";
  includeReview?: boolean;
  runId?: string;
};

export type LeadListRow = {
  id: string;
  run_id: string;
  company_name: string;
  company_domain: string;
  linkedin_url: string | null;
  qualification_status: string;
  confidence: number;
  fit_reasons: unknown;
  concerns: unknown;
  source_urls: unknown;
  source_summary: string | null;
  outreach_sequence: unknown;
  linkedin_message: string | null;
  created_at: string;
  runs: { objective: string; created_by: string; created_by_email: string };
};

/**
 * Leads across searches (or one search), for the Leads page and exports.
 * Everyone can see every search, so "all" is allowed; "mine" is the default.
 */
export async function listLeads(filters: LeadListFilters): Promise<LeadListRow[]> {
  let query = supabaseService()
    .from("leads")
    .select(
      "id, run_id, company_name, company_domain, linkedin_url, qualification_status, confidence, fit_reasons, concerns, source_urls, source_summary, outreach_sequence, linkedin_message, created_at, runs!inner(objective, created_by, created_by_email)"
    )
    .in("qualification_status", filters.includeReview ? ["qualified", "needs_review"] : ["qualified"]);

  if (filters.runId) query = query.eq("run_id", filters.runId);
  if (filters.scope === "mine") query = query.eq("runs.created_by", filters.userId);
  const q = filters.q?.trim();
  if (q) query = query.ilike("company_name", `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  query =
    filters.sort === "date"
      ? query.order("created_at", { ascending: false })
      : query.order("confidence", { ascending: false }).order("created_at", { ascending: false });

  const { data, error } = await query.limit(1000);
  if (error) throw new Error(`Loading leads failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    ...row,
    runs: (Array.isArray(row.runs) ? row.runs[0] : row.runs) as LeadListRow["runs"],
  })) as LeadListRow[];
}

type Email = { subject?: string; body?: string };
const email = (row: LeadListRow, i: number) => (Array.isArray(row.outreach_sequence) ? (row.outreach_sequence[i] as Email) : undefined);
const list = (v: unknown) => (Array.isArray(v) ? (v as string[]).join("\n") : "");

/** The columns a spreadsheet or CRM import wants, in plain names. */
export const LEAD_CSV_COLUMNS: CsvColumn<LeadListRow>[] = [
  { header: "Company", value: (r) => r.company_name },
  { header: "Website", value: (r) => `https://${r.company_domain}` },
  { header: "LinkedIn page", value: (r) => r.linkedin_url },
  { header: "Verdict", value: (r) => (r.qualification_status === "qualified" ? "Good fit" : "Needs a look") },
  { header: "Confidence (%)", value: (r) => Math.round(r.confidence * 100) },
  { header: "Why it fits", value: (r) => list(r.fit_reasons) },
  { header: "Worth noting", value: (r) => list(r.concerns) },
  { header: "Sources", value: (r) => list(r.source_urls) },
  { header: "Source summary", value: (r) => r.source_summary },
  { header: "Email 1 subject", value: (r) => email(r, 0)?.subject },
  { header: "Email 1", value: (r) => email(r, 0)?.body },
  { header: "Email 2 subject", value: (r) => email(r, 1)?.subject },
  { header: "Email 2", value: (r) => email(r, 1)?.body },
  { header: "Email 3 subject", value: (r) => email(r, 2)?.subject },
  { header: "Email 3", value: (r) => email(r, 2)?.body },
  { header: "LinkedIn message", value: (r) => r.linkedin_message },
  { header: "Search", value: (r) => r.runs.objective },
  { header: "Found on", value: (r) => r.created_at.slice(0, 10) },
];
