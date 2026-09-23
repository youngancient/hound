import { countryName } from "@/lib/countries";
import { formatHeadcount } from "@/lib/labels";
import type { RefinedIcp } from "@/lib/schemas";

/**
 * What Hound understood from the free-text request, in the user's terms —
 * so a misread ("100 employees" taken as 50–200) is visible and the user
 * can rephrase, instead of results just looking inexplicably off.
 */
export function IcpSummary({ icp }: { icp: RefinedIcp }) {
  const where =
    icp.geography.length > 0
      ? icp.geography.join(", ")
      : icp.country_codes.length > 0
        ? icp.country_codes.map(countryName).join(", ")
        : "Anywhere";

  const rows: Array<{ label: string; value: string }> = [
    { label: "Companies", value: icp.target_company_type },
    { label: "Size", value: formatHeadcount(icp.headcount_min, icp.headcount_max) },
    { label: "Where", value: where },
    ...(icp.disqualifiers.length > 0 ? [{ label: "Leaving out", value: icp.disqualifiers.join("; ") }] : []),
  ];

  return (
    <section className="flex flex-col gap-3 rounded-sm border border-rule px-4 py-3 text-sm">
      <h2 className="text-xs text-ash">How Hound read your request</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-ash">{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      {icp.assumptions.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-rule pt-3">
          <p className="text-ash">Hound assumed</p>
          <ul className="flex list-outside list-disc flex-col gap-1 pl-5">
            {icp.assumptions.map((assumption, i) => (
              <li key={i}>{assumption}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
