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
export function LeadGroups({
  runId,
  leads,
  isActive,
  selectedId = null,
}: {
  runId: string;
  leads: Lead[];
  isActive: boolean;
  /** The company open in the detail panel (desktop), highlighted in the list. */
  selectedId?: string | null;
}) {
  const row = (lead: Lead, reason?: string | null) => (
    <ReviewRow
      key={lead.id}
      name={lead.company_name}
      status={lead.qualification_status as QualificationStatus}
      confidence={lead.confidence}
      reason={reason}
      panelHref={`/searches/${runId}?lead=${lead.id}`}
      pageHref={`/searches/${runId}/leads/${lead.id}`}
      selected={lead.id === selectedId}
    />
  );
  const goodFits = leads.filter((l) => l.qualification_status === "qualified").sort(byConfidence);
  const needsLook = leads.filter((l) => l.qualification_status === "needs_review").sort(byConfidence);
  const notFits = leads.filter((l) => l.qualification_status === "not_qualified");

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Leads ({goodFits.length})</h2>
        {goodFits.length === 0 ? (
          <p className="text-sm text-ash">
            {isActive ? "No leads yet. Hound is still checking companies." : "Hound didn't find any leads for this search."}
          </p>
        ) : (
          goodFits.map((lead) => row(lead))
        )}
      </section>

      {needsLook.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Needs a look ({needsLook.length})</h2>
          {needsLook.map((lead) => row(lead, firstConcern(lead)))}
        </section>
      )}

      {notFits.length > 0 && (
        <details className="flex flex-col gap-3" open={notFits.some((l) => l.id === selectedId)}>
          <summary className="cursor-pointer text-sm text-ash">
            {notFits.length} {notFits.length === 1 ? "company" : "companies"} checked that {notFits.length === 1 ? "wasn't" : "weren't"} a fit
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            {notFits.map((lead) => row(lead, firstConcern(lead)))}
          </div>
        </details>
      )}
    </div>
  );
}

/**
 * One company in a review list. On desktop it opens in the detail panel
 * beside the list (same page); on phones, where there's no room, it opens
 * the company's own page.
 */
export function ReviewRow({
  name,
  status,
  confidence,
  reason,
  context,
  panelHref,
  pageHref,
  selected,
}: {
  name: string;
  status: QualificationStatus;
  confidence: number;
  reason?: string | null;
  /** Extra line, e.g. which search a lead came from. */
  context?: string | null;
  panelHref: string;
  pageHref: string;
  selected: boolean;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-sm font-medium">{name}</span>
        <QualificationBadge status={status} />
      </div>
      {context && <span className="truncate text-xs text-ash">{context}</span>}
      {reason && <span className="line-clamp-2 text-sm text-ash">{reason}</span>}
      <span className="font-mono text-xs text-ash">{formatConfidence(confidence, status)}</span>
    </>
  );
  const base = "flex-col gap-1.5 rounded-sm border px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <>
      <Link
        href={panelHref}
        scroll={false}
        aria-current={selected ? "true" : undefined}
        className={`hidden lg:flex ${base} ${selected ? "border-accent bg-rule/40" : "border-rule hover:border-accent"}`}
      >
        {body}
      </Link>
      <Link href={pageHref} className={`flex lg:hidden ${base} border-rule hover:border-accent`}>
        {body}
      </Link>
    </>
  );
}
