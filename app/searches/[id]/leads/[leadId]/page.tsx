import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/auth";
import { getLead } from "@/lib/data/searches";
import { AppHeader } from "@/components/AppHeader";
import { QualificationBadge } from "@/components/QualificationBadge";
import { EvidenceDisclosure } from "@/components/EvidenceDisclosure";
import { OutreachEditor } from "@/components/OutreachEditor";
import { formatConfidence, type QualificationStatus } from "@/lib/labels";

export default async function LeadReviewPage(props: { params: Promise<{ id: string; leadId: string }> }) {
  const { id, leadId } = await props.params;
  const user = await getSessionUser();
  const data = await getLead(leadId);
  if (!data) notFound();

  const { lead, toolCalls } = data;

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader email={user?.email ?? ""} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
        <Link href={`/searches/${id}`} className="text-xs text-ash hover:text-ink">
          ← Back to search
        </Link>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-medium">{lead.company_name}</h1>
            <QualificationBadge status={lead.qualification_status as QualificationStatus} />
          </div>
          <p className="font-mono text-xs text-ash">{formatConfidence(lead.confidence)}</p>
        </div>

        {(lead.fit_reasons as string[])?.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-ash">Why it&apos;s a good fit</p>
            <ul className="list-inside list-disc text-sm">
              {(lead.fit_reasons as string[]).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
        )}

        {(lead.concerns as string[])?.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-xs text-ash">Worth noting</p>
            <ul className="list-inside list-disc text-sm">
              {(lead.concerns as string[]).map((concern) => (
                <li key={concern}>{concern}</li>
              ))}
            </ul>
          </div>
        )}

        <EvidenceDisclosure sourceUrls={(lead.source_urls as string[]) ?? []} toolCalls={toolCalls} />

        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Outreach</h2>
          <OutreachEditor
            leadId={lead.id}
            initialSequence={lead.outreach_sequence}
            initialLinkedinMessage={lead.linkedin_message}
            editedBy={lead.outreach_edited_by}
          />
        </div>
      </main>
    </div>
  );
}
