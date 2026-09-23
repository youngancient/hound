import Link from "next/link";
import { getSessionUser } from "@/lib/supabase/auth";
import { listLeads } from "@/lib/data/leads";
import { AppHeader } from "@/components/AppHeader";
import { ReviewRow } from "@/components/LeadGroups";
import { LeadDetail } from "@/components/LeadDetail";
import { PrevNext } from "@/components/PrevNext";
import { LeadKeyboardNav } from "@/components/LeadKeyboardNav";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import type { QualificationStatus } from "@/lib/labels";

/**
 * Every lead from every search in one place: find one by name, see the
 * strongest first, export a whole campaign at once. Reviewing works like a
 * search page: the list on the left, the company beside it.
 */
export default async function LeadsPage(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const query = await props.searchParams;
  const user = await getSessionUser();
  const scope = query.scope === "all" ? "all" : "mine";
  const sort = query.sort === "date" ? "date" : "confidence";
  const q = typeof query.q === "string" ? query.q : "";

  const leads = user ? await listLeads({ userId: user.id, scope, q, sort }) : [];

  const params = (extra: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const merged = { scope, sort, q: q || null, ...extra };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    if (merged.scope === "mine") p.delete("scope");
    if (merged.sort === "confidence") p.delete("sort");
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  const requested = typeof query.lead === "string" ? query.lead : null;
  const selectedIndex = Math.max(0, requested ? leads.findIndex((l) => l.id === requested) : 0);
  const selected = leads[selectedIndex] ?? null;
  const hrefAt = (i: number) => (i >= 0 && i < leads.length ? `/leads${params({ lead: leads[i].id })}` : null);

  const toggleClass = (active: boolean) =>
    `rounded-sm px-2.5 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
      active ? "bg-ink text-paper" : "text-ash hover:text-ink"
    }`;

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-[-0.01em]">Leads</h1>
            <p className="text-sm text-ash">
              {leads.length} {leads.length === 1 ? "lead" : "leads"}
              {scope === "mine" ? " from your searches" : " from everyone's searches"}
              {q ? ` matching "${q}"` : ""}.
            </p>
          </div>
          {leads.length > 0 && <ExportCsvButton baseHref={`/api/leads/export${params({})}`} leadCount={leads.length} />}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-rule pb-4 text-sm">
          <form action="/leads" className="flex items-center gap-2">
            {scope === "all" && <input type="hidden" name="scope" value="all" />}
            {sort === "date" && <input type="hidden" name="sort" value="date" />}
            <label htmlFor="lead-search" className="sr-only">
              Find a company
            </label>
            <input
              id="lead-search"
              name="q"
              defaultValue={q}
              placeholder="Find a company"
              className="w-56 rounded-sm border border-rule bg-transparent px-3 py-1.5 outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
            />
          </form>
          <div role="group" aria-label="Whose leads" className="flex items-center gap-1 rounded-sm border border-rule p-0.5">
            <Link href={`/leads${params({ scope: "mine", lead: null })}`} className={toggleClass(scope === "mine")}>
              Mine
            </Link>
            <Link href={`/leads${params({ scope: "all", lead: null })}`} className={toggleClass(scope === "all")}>
              Everyone&apos;s
            </Link>
          </div>
          <div role="group" aria-label="Sort" className="flex items-center gap-1 rounded-sm border border-rule p-0.5">
            <Link href={`/leads${params({ sort: "confidence", lead: null })}`} className={toggleClass(sort === "confidence")}>
              Strongest first
            </Link>
            <Link href={`/leads${params({ sort: "date", lead: null })}`} className={toggleClass(sort === "date")}>
              Newest first
            </Link>
          </div>
        </div>

        {leads.length === 0 ? (
          <div className="rounded-sm border border-dashed border-rule px-5 py-8 text-sm text-ash">
            <p className="text-ink">{q ? "No leads match that name." : "No leads yet."}</p>
            <p className="mt-1">
              {q ? "Try a shorter name, or clear the search." : "Leads from your searches will collect here. "}
              {!q && (
                <Link href="/" className="text-accent underline">
                  Start a search
                </Link>
              )}
            </p>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <div className="flex flex-col gap-3">
              {leads.map((lead) => (
                <ReviewRow
                  key={lead.id}
                  name={lead.company_name}
                  status={lead.qualification_status as QualificationStatus}
                  confidence={lead.confidence}
                  context={
                    lead.runs.created_by === user?.id
                      ? lead.runs.objective
                      : `${lead.runs.objective} (by ${lead.runs.created_by_email})`
                  }
                  panelHref={`/leads${params({ lead: lead.id })}`}
                  pageHref={`/searches/${lead.run_id}/leads/${lead.id}`}
                  selected={lead.id === selected?.id}
                />
              ))}
            </div>
            {selected && (
              <aside
                aria-label="Company details"
                className="hidden lg:sticky lg:top-6 lg:flex lg:h-[calc(100dvh-3rem)] lg:flex-col lg:gap-5 lg:overflow-y-auto lg:self-start lg:border-l lg:border-rule lg:pl-8 lg:pr-5 lg:[scrollbar-gutter:stable]"
              >
                <LeadKeyboardNav prevHref={hrefAt(selectedIndex - 1)} nextHref={hrefAt(selectedIndex + 1)} />
                <PrevNext
                  prevHref={hrefAt(selectedIndex - 1)}
                  nextHref={hrefAt(selectedIndex + 1)}
                  position={selectedIndex + 1}
                  total={leads.length}
                  replace
                />
                <Link href={`/searches/${selected.run_id}`} className="w-fit text-xs text-ash hover:text-ink">
                  From: {selected.runs.objective}
                </Link>
                <LeadDetail leadId={selected.id} headingLevel="h2" />
              </aside>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
