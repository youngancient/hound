import "server-only";
import { supabaseService } from "../supabase/service";
import { checkedDomains } from "../tools/progress";

export type CompanyOutcome = "qualified" | "needs_review" | "not_qualified" | "unreadable" | "unchecked" | "ruled_out";

export type CompanyRow = {
  key: string;
  name: string;
  website: string | null;
  linkedinUrl: string | null;
  outcome: CompanyOutcome;
  reason: string | null;
  leadId: string | null;
};

/** Why code ruled a company out, in the user's words (lib/discovery.ts DropReason). */
const RULED_OUT_LABEL: Record<string, string> = {
  "no usable website": "No usable website",
  "size outside the ICP": "Size outside your request",
  "headquarters outside the ICP's countries": "Based outside the countries you asked for",
};

const ORDER: Record<CompanyOutcome, number> = {
  qualified: 0,
  needs_review: 1,
  not_qualified: 2,
  unreadable: 3,
  unchecked: 4,
  ruled_out: 5,
};

/**
 * Every company a search paid for, with what happened to it. `complete`
 * is false for searches from before every company was saved: those can
 * only list the ones Hound assessed.
 */
export async function getCompanies(runId: string): Promise<{ rows: CompanyRow[]; complete: boolean }> {
  const db = supabaseService();
  const [{ data: candidates, error: candError }, { data: leads, error: leadsError }, dealtWith] = await Promise.all([
    db.from("candidates").select("domain, name, data, ruled_out_reason").eq("run_id", runId),
    db
      .from("leads")
      .select("id, company_name, company_domain, linkedin_url, qualification_status, concerns, fit_reasons, confidence")
      .eq("run_id", runId),
    checkedDomains(runId),
  ]);
  if (candError) throw new Error(`Loading companies failed: ${candError.message}`);
  if (leadsError) throw new Error(`Loading companies failed: ${leadsError.message}`);

  const leadByDomain = new Map((leads ?? []).map((l) => [l.company_domain, l]));
  const rows: CompanyRow[] = [];

  for (const c of candidates ?? []) {
    const data = (c.data ?? {}) as { website?: string | null; linkedinUrl?: string | null };
    const lead = leadByDomain.get(c.domain);
    if (lead) continue; // listed from the lead below, with its verdict
    rows.push({
      key: c.domain,
      name: c.name,
      website: data.website ?? null,
      linkedinUrl: data.linkedinUrl ?? null,
      outcome: c.ruled_out_reason ? "ruled_out" : dealtWith.has(c.domain) ? "unreadable" : "unchecked",
      reason: c.ruled_out_reason
        ? (RULED_OUT_LABEL[c.ruled_out_reason] ?? c.ruled_out_reason)
        : dealtWith.has(c.domain)
          ? "Hound couldn't read the website"
          : null,
      leadId: null,
    });
  }

  for (const l of leads ?? []) {
    const concerns = Array.isArray(l.concerns) ? (l.concerns as string[]) : [];
    const reasons = Array.isArray(l.fit_reasons) ? (l.fit_reasons as string[]) : [];
    rows.push({
      key: l.company_domain,
      name: l.company_name,
      website: `https://${l.company_domain}`,
      linkedinUrl: l.linkedin_url ?? null,
      outcome: l.qualification_status as CompanyOutcome,
      reason: (l.qualification_status === "qualified" ? reasons[0] : concerns[0]) ?? null,
      leadId: l.id,
    });
  }

  rows.sort((a, b) => ORDER[a.outcome] - ORDER[b.outcome] || a.name.localeCompare(b.name));
  return { rows, complete: (candidates ?? []).length > 0 };
}
