import Link from "next/link";
import { notFound } from "next/navigation";
import { getSearch } from "@/lib/data/searches";
import { AppHeader } from "@/components/AppHeader";
import { LeadDetail } from "@/components/LeadDetail";
import { PrevNext } from "@/components/PrevNext";
import { LeadKeyboardNav } from "@/components/LeadKeyboardNav";
import { orderLeads } from "@/lib/lead-order";

/**
 * A single company on its own page: used on phones (no room for the side
 * panel) and for shared links. Previous/Next and the arrow keys move
 * through the search's companies in review order without going back.
 */
export default async function LeadPage(props: { params: Promise<{ id: string; leadId: string }> }) {
  const { id, leadId } = await props.params;
  const search = await getSearch(id);
  if (!search) notFound();

  const ordered = orderLeads(search.leads);
  const index = ordered.findIndex((l) => l.id === leadId);
  if (index === -1) notFound();
  const hrefAt = (i: number) => (i >= 0 && i < ordered.length ? `/searches/${id}/leads/${ordered[i].id}` : null);

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <LeadKeyboardNav prevHref={hrefAt(index - 1)} nextHref={hrefAt(index + 1)} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 *:max-w-2xl px-4 py-10 sm:px-6">
        <Link href={`/searches/${id}?lead=${leadId}`} className="text-xs text-ash hover:text-ink">
          ← Back to search
        </Link>
        <PrevNext prevHref={hrefAt(index - 1)} nextHref={hrefAt(index + 1)} position={index + 1} total={ordered.length} />
        <LeadDetail leadId={leadId} />
      </main>
    </div>
  );
}
