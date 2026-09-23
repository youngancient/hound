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

  return (
    <section className="flex flex-col gap-3 rounded-sm border border-rule px-4 py-3 text-sm">
      <h2 className="text-xs text-ash">How Hound read your request</h2>
      <p>
        {icp.target_company_type} · {formatHeadcount(icp.headcount_min, icp.headcount_max)} · {where}
      </p>
      {icp.disqualifiers.length > 0 && (
        <p className="text-ash">
          <span className="text-ink">Leaving out:</span> {icp.disqualifiers.join("; ")}
        </p>
      )}
      {icp.assumptions.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-ink">Hound assumed:</p>
          <ul className="flex list-disc flex-col gap-0.5 pl-5 text-ash">
            {icp.assumptions.map((assumption, i) => (
              <li key={i}>{assumption}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
