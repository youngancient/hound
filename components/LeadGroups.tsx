import Link from "next/link";
import { QualificationBadge } from "./QualificationBadge";
import { formatConfidence, type QualificationStatus } from "@/lib/labels";

type Lead = {
  id: string;
  company_name: string;
  qualification_status: string;
  confidence: number;
  concerns: unknown;
};

function firstConcern(lead: Lead): string | null {
  return Array.isArray(lead.concerns) && typeof lead.concerns[0] === "string" ? lead.concerns[0] : null;
}

const byConfidence = (a: Lead, b: Lead) => b.confidence - a.confidence;

/**
 * Ordered for the people using it — marketers and salespeople who came
 * for the good fits: those first (strongest on top), then the ones worth
 * a human look, and the rejects collapsed under a count so they show
 * Hound's work without burying the leads.
 */
export function LeadGroups({ runId, leads, isActive }: { runId: string; leads: Lead[]; isActive: boolean }) {
  const goodFits = leads.filter((l) => l.qualification_status === "qualified").sort(byConfidence);
  const needsLook = leads.filter((l) => l.qualification_status === "needs_review").sort(byConfidence);
  const notFits = leads.filter((l) => l.qualification_status === "not_qualified");

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Good fits ({goodFits.length})</h2>
        {goodFits.length === 0 ? (
          <p className="text-sm text-ash">
            {isActive ? "No good fits yet — Hound is still checking companies." : "Hound didn't find any good fits for this search."}
          </p>
        ) : (
          goodFits.map((lead) => <LeadRow key={lead.id} runId={runId} lead={lead} />)
        )}
      </section>

      {needsLook.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Needs a look ({needsLook.length})</h2>
          {needsLook.map((lead) => (
            <LeadRow key={lead.id} runId={runId} lead={lead} reason={firstConcern(lead)} />
          ))}
        </section>
      )}

      {notFits.length > 0 && (
        <details className="flex flex-col gap-3">
          <summary className="cursor-pointer text-sm text-ash">
            {notFits.length} {notFits.length === 1 ? "company" : "companies"} checked that {notFits.length === 1 ? "wasn't" : "weren't"} a fit
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {notFits.map((lead) => (
              <LeadRow key={lead.id} runId={runId} lead={lead} reason={firstConcern(lead)} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function LeadRow({ runId, lead, reason }: { runId: string; lead: Lead; reason?: string | null }) {
  return (
    <Link
      href={`/searches/${runId}/leads/${lead.id}`}
      className="flex flex-col gap-1.5 rounded-sm border border-rule px-4 py-3 hover:border-accent"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{lead.company_name}</span>
        <QualificationBadge status={lead.qualification_status as QualificationStatus} />
      </div>
      {reason && <span className="text-sm text-ash">{reason}</span>}
      <span className="font-mono text-xs text-ash">{formatConfidence(lead.confidence)}</span>
    </Link>
  );
}
