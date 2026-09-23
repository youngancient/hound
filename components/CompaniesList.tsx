import Link from "next/link";
import { QualificationBadge } from "./QualificationBadge";
import type { CompanyRow } from "@/lib/data/companies";
import type { QualificationStatus } from "@/lib/labels";

const OTHER_OUTCOME: Record<string, { label: string; activeLabel?: string }> = {
  unreadable: { label: "Couldn't check" },
  unchecked: { label: "Not checked", activeLabel: "Waiting" },
  ruled_out: { label: "Ruled out" },
};

/**
 * Every company the search paid for, with what happened to it, so nothing
 * found is invisible. Assessed ones open in the detail panel; the rest link
 * out to their website and LinkedIn page for a look by hand.
 */
export function CompaniesList({
  runId,
  rows,
  complete,
  isActive,
}: {
  runId: string;
  rows: CompanyRow[];
  complete: boolean;
  isActive: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {!complete && (
        <p className="text-sm text-ash">
          This search ran before Hound saved every company it found, so only the companies it checked are listed.
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-ash">{isActive ? "No companies found yet." : "This search didn't find any companies."}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-rule border-y border-rule">
          {rows.map((row) => {
            const other = OTHER_OUTCOME[row.outcome];
            return (
              <li key={row.key} className="grid gap-x-6 gap-y-1 px-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div className="flex min-w-0 flex-col gap-1">
                  {row.leadId ? (
                    <>
                      <Link
                        href={`/searches/${runId}?lead=${row.leadId}`}
                        scroll={false}
                        className="hidden w-fit truncate text-sm font-medium hover:text-accent lg:block"
                      >
                        {row.name}
                      </Link>
                      <Link
                        href={`/searches/${runId}/leads/${row.leadId}`}
                        className="w-fit truncate text-sm font-medium hover:text-accent lg:hidden"
                      >
                        {row.name}
                      </Link>
                    </>
                  ) : (
                    <span className="truncate text-sm font-medium">{row.name}</span>
                  )}
                  {row.reason && <span className="text-sm text-ash">{row.reason}</span>}
                  <span className="flex flex-wrap gap-x-4 text-xs">
                    {row.website && (
                      <a href={row.website} target="_blank" rel="noreferrer" className="text-accent underline">
                        Website
                      </a>
                    )}
                    {row.linkedinUrl && /^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(row.linkedinUrl) && (
                      <a href={row.linkedinUrl} target="_blank" rel="noreferrer" className="text-accent underline">
                        LinkedIn page
                      </a>
                    )}
                  </span>
                </div>
                {other ? (
                  <span className="inline-flex w-fit shrink-0 items-center rounded-sm border border-rule px-2 py-0.5 text-xs font-medium text-ash">
                    {isActive && other.activeLabel ? other.activeLabel : other.label}
                  </span>
                ) : (
                  <QualificationBadge status={row.outcome as QualificationStatus} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
