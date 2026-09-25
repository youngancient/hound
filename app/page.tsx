import Link from "next/link";
import { listSearches } from "@/lib/data/searches";
import { getSessionUser } from "@/lib/supabase/auth";
import { AppHeader } from "@/components/AppHeader";
import { NewSearchForm } from "@/components/NewSearchForm";
import { AutoRefresh } from "@/components/AutoRefresh";
import { LocalTime } from "@/components/LocalTime";
import type { RunStatus } from "@/lib/labels";
import { SearchStatusBadge } from "@/components/SearchStatusBadge";

/**
 * Starting a search is the product's main action, so the request box is
 * the top of the home page rather than a separate page. Past searches sit
 * underneath, with a plain one-line summary of what they've found and cost.
 */
const EXAMPLES = [
  "US B2B SaaS companies with 10 to 100 employees that may need AI automation support",
  "Marketing agencies in the US with 5 to 50 people that handle a lot of repetitive client work",
  "Fintech startups in the UK with 20 to 200 people",
  "E-commerce brands in Canada with 10 to 50 staff",
];

export default async function HomePage() {
  const [searches, user] = await Promise.all([listSearches(), getSessionUser()]);
  const goodFits = searches.reduce((sum, s) => sum + s.qualifiedCount, 0);
  const checked = searches.reduce((sum, s) => sum + s.checkedCount, 0);
  const spent = searches.reduce((sum, s) => sum + s.totalCostUsd, 0);
  const anyRunning = searches.some((s) => s.status === "pending" || s.status === "running");

  const stats = [
    { label: "Searches", value: String(searches.length) },
    { label: "Companies checked", value: String(checked) },
    {
      label: "Leads",
      value: String(goodFits),
      note: checked > 0 ? `${Math.round((goodFits / checked) * 100)}% of companies checked` : null,
    },
    {
      label: "Spent",
      value: `$${spent.toFixed(2)}`,
      note: goodFits > 0 ? `About $${(spent / goodFits).toFixed(2)} per lead` : null,
      mono: true,
    },
  ];

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      {/* Keeps statuses and totals current if someone comes back here mid-search. */}
      <AutoRefresh active={anyRunning} intervalMs={5000} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 py-10 sm:px-6">
        {/* Shown from the first visit, at zero, so it's clear what gets tracked. */}
        <dl aria-label="Your results so far" className="grid grid-cols-2 gap-x-8 gap-y-5 border-b border-rule pb-6 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1">
              <dt className="text-xs text-ash">{stat.label}</dt>
              <dd className={`text-2xl font-medium tracking-[-0.01em] text-ink ${stat.mono ? "font-mono" : ""}`}>
                {stat.value}
              </dd>
              {stat.note && <dd className="text-xs text-ash">{stat.note}</dd>}
            </div>
          ))}
        </dl>

        <section aria-labelledby="new-search" className="max-w-2xl">
          <h1 id="new-search" className="mb-4 text-xl font-semibold tracking-[-0.01em]">
            Who are you looking for?
          </h1>
          <NewSearchForm examples={EXAMPLES} />
        </section>

        <section aria-labelledby="your-searches" className="flex flex-col gap-4">
          <h2 id="your-searches" className="text-base font-medium">
            Your searches
          </h2>

          {searches.length === 0 ? (
            <div className="rounded-sm border border-dashed border-rule px-5 py-8 text-sm text-ash">
              <p className="text-ink">No searches yet.</p>
              <p className="mt-1 max-w-prose">
                Describe the companies you want above, or pick an example. Each search checks up to 30 companies and
                lists the leads it finds, with ready-to-edit outreach for each one.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-rule border-y border-rule">
              {searches.map((search) => {
                const active = search.status === "pending" || search.status === "running";
                return (
                  <li key={search.id}>
                    <Link
                      href={`/searches/${search.id}`}
                      className="grid gap-x-6 gap-y-1 px-1 py-3 hover:bg-rule/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-center"
                    >
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm text-ink" title={search.objective}>
                          {search.objective}
                        </span>
                        {search.created_by !== user?.id && (
                          <span className="truncate text-xs text-ash">Created by {search.created_by_email}</span>
                        )}
                      </span>
                      <SearchStatusBadge status={search.status as RunStatus} />
                      <span className="text-sm text-ash">
                        {search.status === "declined"
                          ? "Nothing searched"
                          : search.status === "awaiting_review"
                            ? "Waiting for review"
                            : `${search.qualifiedCount} ${search.qualifiedCount === 1 ? "lead" : "leads"}${active ? " so far" : ""}`}
                      </span>
                      <span className="text-sm text-ash">
                        <LocalTime iso={search.created_at} mode="relative" />
                      </span>
                      <span className="font-mono text-sm text-ash sm:text-right">${search.totalCostUsd.toFixed(2)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
