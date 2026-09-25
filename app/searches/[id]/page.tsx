import Link from "next/link";
import { notFound } from "next/navigation";
import { getSearch } from "@/lib/data/searches";
import { getSessionUser } from "@/lib/supabase/auth";
import { AppHeader } from "@/components/AppHeader";
import { PipelineTrail } from "@/components/PipelineTrail";
import { IcpSummary } from "@/components/IcpSummary";
import { LeadGroups } from "@/components/LeadGroups";
import { AutoRefresh } from "@/components/AutoRefresh";
import type { RunStatus } from "@/lib/labels";
import { SearchStatusBadge } from "@/components/SearchStatusBadge";
import { SearchFunnel } from "@/components/SearchFunnel";
import { NewSearchForm } from "@/components/NewSearchForm";
import { Elapsed } from "@/components/Elapsed";
import { LocalTime } from "@/components/LocalTime";
import { ContinueSearchButton } from "@/components/ContinueSearchButton";
import { LeadDetail } from "@/components/LeadDetail";
import { PrevNext } from "@/components/PrevNext";
import { LeadKeyboardNav } from "@/components/LeadKeyboardNav";
import { CompaniesList } from "@/components/CompaniesList";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import { getCompanies } from "@/lib/data/companies";
import { orderLeads } from "@/lib/lead-order";

/** A normal search takes a few minutes; past this, say so rather than let the timer just climb. */
const LONGER_THAN_USUAL_MS = 15 * 60_000;

export default async function SearchDetailPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ id }, query] = await Promise.all([props.params, props.searchParams]);
  const data = await getSearch(id);
  if (!data) notFound();
  const tab = query.tab === "companies" ? "companies" : "leads";

  const { run, icp, leads, continueCheck, funnel } = data;
  const serverNow = new Date();
  const attemptStartedAt = (run.attempt_started_at as string | null) ?? (run.created_at as string);
  const user = await getSessionUser();
  const startedBy = run.created_by === user?.id ? null : (run.created_by_email as string);
  const isActive = run.status === "pending" || run.status === "running";
  const isOwner = !startedBy;
  const attempt = (run.attempt as number | null) ?? 1;
  const timeLabel = isActive ? "Running for" : run.status === "failed" ? "Stopped after" : "Took";
  // Review order, and which company is open in the desktop detail panel.
  const ordered = orderLeads(leads);
  const requested = typeof query.lead === "string" ? query.lead : null;
  const selectedIndex = Math.max(0, requested ? ordered.findIndex((l) => l.id === requested) : 0);
  const selected = ordered[selectedIndex] ?? null;
  const panelHref = (i: number) =>
    i >= 0 && i < ordered.length ? `/searches/${id}?lead=${ordered[i].id}${tab === "companies" ? "&tab=companies" : ""}` : null;
  const companies = tab === "companies" ? await getCompanies(id) : null;
  const takingLong = isActive && serverNow.getTime() - new Date(attemptStartedAt).getTime() > LONGER_THAN_USUAL_MS;

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <AutoRefresh active={isActive} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6">
        <header className="flex flex-col gap-4 border-b border-rule pb-6">
          <Link href="/" className="w-fit text-xs text-ash hover:text-ink">
            ← Your searches
          </Link>
          <div className="flex items-start justify-between gap-6">
            <div className="flex min-w-0 flex-col gap-3">
              <h1 className="max-w-3xl text-xl font-semibold leading-snug tracking-[-0.01em]">{run.objective}</h1>
              {run.status !== "declined" && (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                  <span className="inline-flex items-center gap-1.5" title={timeLabel}>
                    <ClockIcon />
                    <span className="sr-only">{timeLabel} </span>
                    <Elapsed
                      status={run.status}
                      attemptStartedAt={attemptStartedAt}
                      priorAttemptsMs={Number(run.prior_attempts_ms ?? 0)}
                      completedAt={run.completed_at}
                      serverNow={serverNow.toISOString()}
                    />
                    {attempt > 1 && (
                      <span className="text-ash">
                        {isActive || run.status === "failed" ? `attempt ${attempt}` : `${attempt} attempts`}
                      </span>
                    )}
                  </span>
                  <span className="inline-flex items-center gap-1.5" title="Cost">
                    <CostIcon />
                    <span className="sr-only">Cost </span>
                    <span className="font-mono">${run.totalCostUsd.toFixed(2)}</span>
                  </span>
                </div>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5 pt-1 text-xs text-ash">
              <SearchStatusBadge status={run.status as RunStatus} />
              <LocalTime iso={run.created_at} />
              {startedBy && <span className="max-w-[12rem] truncate">by {startedBy}</span>}
            </div>
          </div>
        </header>

        {run.status === "failed" && (
          <div className="flex flex-col gap-3 rounded-sm border border-oxblood px-4 py-3">
            <p className="text-sm text-oxblood">{run.status_note ?? "Something went wrong."}</p>
            {isOwner && continueCheck?.ok && (
              <div className="flex flex-col gap-1">
                <ContinueSearchButton runId={run.id} />
                <p className="text-xs text-ash">
                  Picks up where it stopped. It keeps the leads found so far and uses what&apos;s left of this
                  search&apos;s budget.
                </p>
              </div>
            )}
            {isOwner && continueCheck && !continueCheck.ok && <p className="text-sm text-ash">{continueCheck.reason}</p>}
            <details className="text-sm">
              <summary className="cursor-pointer text-ash">Start over with a new search</summary>
              <div className="mt-3">
                <NewSearchForm prefill={run.objective} allowRepeat />
              </div>
            </details>
          </div>
        )}

        {takingLong && (
          <div className="flex flex-col gap-3 rounded-sm border border-rule px-4 py-3 text-sm">
            <p>
              This is taking longer than usual. It may still finish, so give it a few more minutes. If it seems stuck,
              you can start a new search with the same request.
            </p>
            <details>
              <summary className="cursor-pointer text-ash">Start a new search</summary>
              <div className="mt-3">
                <NewSearchForm prefill={run.objective} allowRepeat />
              </div>
            </details>
          </div>
        )}

        {run.status === "declined" && (
          <div className="flex flex-col gap-4 rounded-sm border border-accent px-4 py-3">
            <p className="text-sm">{run.status_note ?? "Hound couldn't turn this into a company search."}</p>
            <NewSearchForm prefill={run.objective} allowRepeat />
          </div>
        )}

        {run.status === "completed" && run.status_note && (
          <p className="rounded-sm border border-rule px-4 py-3 text-sm text-ash">{run.status_note}</p>
        )}

        {run.status !== "declined" && (
          <>
            {/* Progress only matters while it's moving or where it stopped; a finished search goes straight to results. */}
            {run.status !== "completed" && (
              <PipelineTrail
                orientation="horizontal"
                currentStage={run.current_stage ?? "Understanding the request"}
                stopped={run.status === "failed"}
              />
            )}

            {icp && <IcpSummary icp={icp} />}
            {funnel.found > 0 && <SearchFunnel counts={funnel} isActive={isActive} />}

            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-rule">
                <nav aria-label="Results" className="-mb-px flex gap-6 text-sm">
                  {[
                    { key: "leads", label: `Leads (${funnel.leads})`, href: `/searches/${id}` },
                    { key: "companies", label: `All companies (${funnel.found})`, href: `/searches/${id}?tab=companies` },
                  ].map((t) => (
                    <Link
                      key={t.key}
                      href={t.href}
                      scroll={false}
                      aria-current={tab === t.key ? "page" : undefined}
                      className={`border-b-2 pb-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                        tab === t.key ? "border-ink font-medium text-ink" : "border-transparent text-ash hover:text-ink"
                      }`}
                    >
                      {t.label}
                    </Link>
                  ))}
                </nav>
                {funnel.leads > 0 && (
                  <div className="pb-2">
                    <ExportCsvButton
                      baseHref={`/api/runs/${id}/export`}
                      leadCount={funnel.leads}
                      reviewCount={leads.filter((l) => l.qualification_status === "needs_review").length}
                    />
                  </div>
                )}
              </div>

              {tab === "companies" && companies ? (
                <CompaniesList runId={id} rows={companies.rows} complete={companies.complete} isActive={isActive} />
              ) : isActive && leads.length === 0 ? (
                <p className="text-sm text-ash">Hound is still looking. Companies will show up here as it checks them.</p>
              ) : (
                <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
                  <LeadGroups runId={id} leads={leads} isActive={isActive} selectedId={selected?.id ?? null} />
                  {selected && (
                    <aside
                      aria-label="Company details"
                      className="hidden lg:sticky lg:top-6 lg:flex lg:h-[calc(100dvh-3rem)] lg:flex-col lg:gap-5 lg:overflow-y-auto lg:self-start lg:border-l lg:border-rule lg:pl-8 lg:pr-5 lg:[scrollbar-gutter:stable]"
                    >
                      <LeadKeyboardNav prevHref={panelHref(selectedIndex - 1)} nextHref={panelHref(selectedIndex + 1)} />
                      <PrevNext
                        prevHref={panelHref(selectedIndex - 1)}
                        nextHref={panelHref(selectedIndex + 1)}
                        position={selectedIndex + 1}
                        total={ordered.length}
                        replace
                      />
                      <LeadDetail leadId={selected.id} headingLevel="h2" />
                    </aside>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-ash" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.75V8l2.25 1.5" />
    </svg>
  );
}

function CostIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-ash" aria-hidden="true">
      <path d="M3.25 1.75h9.5v12.5l-2.4-1.5-2.35 1.5-2.35-1.5-2.4 1.5z" />
      <path d="M5.75 5.5h4.5M5.75 8.5h4.5" />
    </svg>
  );
}
