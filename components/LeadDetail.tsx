import { getLead } from "@/lib/data/searches";
import { getSessionUser } from "@/lib/supabase/auth";
import { QualificationBadge } from "./QualificationBadge";
import { EvidenceDisclosure } from "./EvidenceDisclosure";
import { OutreachEditor } from "./OutreachEditor";
import { formatConfidence, type QualificationStatus } from "@/lib/labels";

/** Headings follow the verdict: "Why it's a good fit" on a rejected lead would contradict its badge. */
const SECTION_HEADINGS: Record<QualificationStatus, { reasons: string; concerns: string }> = {
  qualified: { reasons: "Why it's a good fit", concerns: "Worth noting" },
  needs_review: { reasons: "What matches", concerns: "What needs a closer look" },
  not_qualified: { reasons: "What matches", concerns: "Why it's not a fit" },
};

/**
 * Everything about one company: verdict, links, reasoning, evidence and
 * outreach. Shared by the lead page, the search page's detail panel and
 * the Leads page, so reviewing looks and works the same everywhere.
 */
export async function LeadDetail({ leadId, headingLevel = "h1" }: { leadId: string; headingLevel?: "h1" | "h2" }) {
  const [data, user] = await Promise.all([getLead(leadId), getSessionUser()]);
  if (!data) return <p className="text-sm text-ash">We couldn&apos;t find this company. It may have been removed.</p>;

  const { lead, owner, toolCalls } = data;
  const isOwner = user?.id === owner.id;
  // Only the owner can edit, so an edit is theirs; the last case covers
  // edits made before owner-only editing existed.
  const editedLabel = !lead.outreach_edited_at
    ? null
    : lead.outreach_edited_by === user?.id
      ? "Edited by you"
      : lead.outreach_edited_by === owner.id
        ? `Edited by ${owner.email}`
        : "Edited by a teammate";
  const status = lead.qualification_status as QualificationStatus;
  const copy = SECTION_HEADINGS[status];
  const fitReasons = Array.isArray(lead.fit_reasons) ? (lead.fit_reasons as string[]) : [];
  const concerns = Array.isArray(lead.concerns) ? (lead.concerns as string[]) : [];
  // Only ever a linkedin.com link, whatever ended up in the row.
  const linkedinUrl =
    typeof lead.linkedin_url === "string" && /^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(lead.linkedin_url)
      ? lead.linkedin_url
      : null;
  const hasOutreach = Array.isArray(lead.outreach_sequence) && lead.outreach_sequence.length === 3 && !!lead.linkedin_message;
  const Heading = headingLevel;

  return (
    <article className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <Heading className="text-lg font-medium">{lead.company_name}</Heading>
          <QualificationBadge status={status} />
        </div>
        <p className="font-mono text-xs text-ash">{formatConfidence(lead.confidence, status)}</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <a href={`https://${lead.company_domain}`} target="_blank" rel="noreferrer" className="text-accent underline">
            {lead.company_domain}
          </a>
          {linkedinUrl && (
            <a href={linkedinUrl} target="_blank" rel="noreferrer" className="text-accent underline">
              LinkedIn page
            </a>
          )}
        </div>
      </div>

      {fitReasons.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-ash">{copy.reasons}</p>
          <ul className="flex list-outside list-disc flex-col gap-1 pl-5 text-sm">
            {fitReasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {concerns.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-ash">{copy.concerns}</p>
          <ul className="flex list-outside list-disc flex-col gap-1 pl-5 text-sm">
            {concerns.map((concern, i) => (
              <li key={i}>{concern}</li>
            ))}
          </ul>
        </div>
      )}

      <EvidenceDisclosure sourceUrls={(lead.source_urls as string[]) ?? []} toolCalls={toolCalls} />

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Outreach</h3>
        {hasOutreach ? (
          <OutreachEditor
            key={lead.id}
            leadId={lead.id}
            initialSequence={lead.outreach_sequence}
            initialLinkedinMessage={lead.linkedin_message}
            initialEditedLabel={editedLabel}
            readOnly={!isOwner}
            ownerEmail={owner.email}
          />
        ) : (
          <p className="text-sm text-ash">Hound only writes outreach for companies that are a good fit.</p>
        )}
      </div>
    </article>
  );
}
