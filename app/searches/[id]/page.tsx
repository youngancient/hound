import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/auth";
import { getSearch } from "@/lib/data/searches";
import { AppHeader } from "@/components/AppHeader";
import { PipelineTrail } from "@/components/PipelineTrail";
import { IcpSummary } from "@/components/IcpSummary";
import { LeadGroups } from "@/components/LeadGroups";
import { AutoRefresh } from "@/components/AutoRefresh";
import { SEARCH_STATUS_LABEL } from "@/lib/labels";
import { NewSearchForm } from "@/components/NewSearchForm";

export default async function SearchDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getSessionUser();
  const data = await getSearch(id);
  if (!data) notFound();

  const { run, icp, leads } = data;
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

          <div className="flex flex-col gap-6">
            {icp && <IcpSummary icp={icp} />}
            {isActive && leads.length === 0 ? (
              <p className="text-sm text-ash">Hound is still looking — leads will appear here as they&apos;re found.</p>
            ) : (
              <LeadGroups runId={run.id} leads={leads} isActive={isActive} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
