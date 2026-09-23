import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/auth";
import { getLead } from "@/lib/data/searches";
import { AppHeader } from "@/components/AppHeader";
import { QualificationBadge } from "@/components/QualificationBadge";
import { EvidenceDisclosure } from "@/components/EvidenceDisclosure";
import { OutreachEditor } from "@/components/OutreachEditor";
import { formatConfidence, type QualificationStatus } from "@/lib/labels";

/** Headings follow the verdict: "Why it's a good fit" on a rejected lead would contradict its badge. */
const SECTION_HEADINGS: Record<QualificationStatus, { reasons: string; concerns: string }> = {
  qualified: { reasons: "Why it's a good fit", concerns: "Worth noting" },
  needs_review: { reasons: "What matches", concerns: "What needs a closer look" },
  not_qualified: { reasons: "What matches", concerns: "Why it's not a fit" },
};

export default async function LeadReviewPage(props: { params: Promise<{ id: string; leadId: string }> }) {
  const { id, leadId } = await props.params;
  const user = await getSessionUser();
  const data = await getLead(leadId);
  if (!data) notFound();

  const { lead, toolCalls } = data;
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

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader email={user?.email ?? ""} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
        <Link href={`/searches/${id}`} className="text-xs text-ash hover:text-ink">
          ← Back to search
        </Link>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-medium">{lead.company_name}</h1>
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
          <h2 className="text-sm font-medium">Outreach</h2>
          {hasOutreach ? (
            <OutreachEditor
              leadId={lead.id}
              initialSequence={lead.outreach_sequence}
              initialLinkedinMessage={lead.linkedin_message}
              editedBy={lead.outreach_edited_by}
            />
          ) : (
            <p className="text-sm text-ash">Hound only writes outreach for companies that are a good fit.</p>
          )}
        </div>
      </main>
    </div>
  );
}
