import Link from "next/link";
import { getSessionUser } from "@/lib/supabase/auth";
import { listSearches } from "@/lib/data/searches";
import { AppHeader } from "@/components/AppHeader";
import { SEARCH_STATUS_LABEL } from "@/lib/labels";

export default async function SearchesPage() {
  const user = await getSessionUser();
  const searches = await listSearches();

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader email={user?.email ?? ""} />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-medium">Your searches</h1>
          <Link
            href="/searches/new"
            className="rounded-sm bg-accent px-4 py-2 text-sm font-medium text-paper"
          >
            Start a new search
          </Link>
        </div>

        {searches.length === 0 ? (
          <p className="text-sm text-ash">
            No searches yet. Start one to find your first leads.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {searches.map((search) => (
              <li key={search.id}>
                <Link
                  href={`/searches/${search.id}`}
                  className="flex flex-col gap-1 rounded-sm border border-rule px-4 py-3 hover:border-accent"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="truncate text-sm">{search.objective}</span>
                    <span className="shrink-0 text-sm text-ash">{SEARCH_STATUS_LABEL[search.status as keyof typeof SEARCH_STATUS_LABEL]}</span>
                  </div>
                  <span className="font-mono text-xs text-ash">
                    {search.status === "declined" ? (
                      "Nothing searched"
                    ) : (
                      <>
                        {search.qualifiedCount} good fit{search.qualifiedCount === 1 ? "" : "s"}
                        {search.status === "pending" || search.status === "running" ? " so far" : ""}
                      </>
                    )}{" "}
                    · $
                    {search.totalCostUsd.toFixed(2)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
