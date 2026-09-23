import "server-only";
import { supabaseService } from "../supabase/service";
import type { QualificationResult, OutreachSequence } from "../schemas";

/**
 * Upsert on (run_id, company_domain) — writing the same lead twice is a
 * no-op change, not a duplicate row or an error. This is what makes lead
 * writes idempotent (design.md Section 4) and structurally de-duplicated
 * (Section 2's UNIQUE constraint).
 */
export async function saveLead(
  runId: string,
  result: QualificationResult,
  outreach?: { sequence: OutreachSequence; linkedinMessage: string }
): Promise<{ id: string }> {
  const { data, error } = await supabaseService()
    .from("leads")
    .upsert(
      {
        run_id: runId,
        company_name: result.company_name,
        company_domain: result.company_domain,
        qualification_status: result.qualification_status,
        confidence: result.confidence,
        fit_reasons: result.fit_reasons,
        concerns: result.concerns,
        source_urls: result.source_urls,
        source_summary: result.source_summary,
        ...(outreach
          ? {
              outreach_sequence: outreach.sequence,
              linkedin_message: outreach.linkedinMessage,
            }
          : {}),
      },
      { onConflict: "run_id,company_domain" }
    )
    .select("id")
    .single();

  if (error) throw new Error(`saveLead failed: ${error.message}`);
  return { id: data.id };
}

/** Idempotency check per design.md Section 4 — has this candidate already been scraped/saved for this run? */
export async function leadExists(runId: string, companyDomain: string): Promise<boolean> {
  const { count, error } = await supabaseService()
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId)
    .eq("company_domain", companyDomain);

  if (error) throw new Error(`leadExists check failed: ${error.message}`);
  return (count ?? 0) > 0;
}

export async function qualifiedLeadCountForRun(runId: string): Promise<number> {
  const { count, error } = await supabaseService()
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("run_id", runId)
    .eq("qualification_status", "qualified");

  if (error) throw new Error(`qualifiedLeadCountForRun failed: ${error.message}`);
  return count ?? 0;
}
