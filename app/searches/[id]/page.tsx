import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/auth";
import { getSearch } from "@/lib/data/searches";
import { AppHeader } from "@/components/AppHeader";
import { PipelineTrail } from "@/components/PipelineTrail";
import { QualificationBadge } from "@/components/QualificationBadge";
import { AutoRefresh } from "@/components/AutoRefresh";
import { formatConfidence, SEARCH_STATUS_LABEL, type QualificationStatus } from "@/lib/labels";
import { NewSearchForm } from "@/components/NewSearchForm";

export default async function SearchDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getSessionUser();
  const data = await getSearch(id);
  if (!data) notFound();

  const { run, leads } = data;
  const isActive = run.status === "pending" || run.status === "running";

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader email={user?.email ?? ""} />
      <AutoRefresh active={isActive} />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-10">
        <div className="flex flex-col gap-1">
          <Link href="/" className="text-xs text-ash hover:text-ink">
            ← Your searches
          </Link>
          <h1 className="text-lg font-medium">{run.objective}</h1>
          <p className="font-mono text-xs text-ash">
            {SEARCH_STATUS_LABEL[run.status as keyof typeof SEARCH_STATUS_LABEL]} · ${run.totalCostUsd.toFixed(2)}
          </p>
        </div>

        {run.status === "failed" && (
          <div className="flex flex-col gap-3 rounded-sm border border-oxblood px-4 py-3">
            <p className="text-sm text-oxblood">{run.status_note ?? "Something went wrong."}</p>
            <details className="text-sm">
              <summary className="cursor-pointer text-ash">Try again</summary>
              <div className="mt-3">
                <NewSearchForm prefill={run.objective} />
              </div>
            </details>
          </div>
        )}

        {run.status === "completed" && run.status_note && (
          <p className="rounded-sm border border-rule px-4 py-3 text-sm text-ash">{run.status_note}</p>
        )}

        <div className="grid gap-8 sm:grid-cols-[200px_1fr]">
          <PipelineTrail currentStage={isActive ? run.current_stage : run.status === "completed" ? "Done" : null} />

          <div className="flex flex-col gap-3">
            {leads.length === 0 ? (
              <p className="text-sm text-ash">Hound is still looking — leads will appear here as they&apos;re found.</p>
            ) : (
              leads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/searches/${run.id}/leads/${lead.id}`}
                  className="flex flex-col gap-1.5 rounded-sm border border-rule px-4 py-3 hover:border-accent"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium">{lead.company_name}</span>
                    <QualificationBadge status={lead.qualification_status as QualificationStatus} />
                  </div>
                  <span className="font-mono text-xs text-ash">{formatConfidence(lead.confidence)}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
