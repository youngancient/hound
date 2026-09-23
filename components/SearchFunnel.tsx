import type { SearchFunnelCounts } from "@/lib/data/searches";

/**
 * The search as a funnel: companies found, checked, and leads. The bar
 * shows those proportions (it's the data, not decoration); the numbers
 * carry it for screen readers. The lines underneath account for the rest
 * honestly: companies ruled out on purpose are not "missed" ones.
 */
export function SearchFunnel({ counts, isActive }: { counts: SearchFunnelCounts; isActive: boolean }) {
  const { found, ruledOut, checked, beingAssessed, unchecked, leads } = counts;
  const pct = (n: number) => (found > 0 ? `${Math.min(100, (n / found) * 100)}%` : "0%");

  const steps = [
    { value: found, label: found === 1 ? "company found" : "companies found" },
    { value: checked, label: "checked" },
    { value: leads, label: leads === 1 ? "lead" : "leads" },
  ];

  return (
    <section aria-label="What this search found" className="flex flex-col gap-4 rounded-sm border border-rule px-5 py-4">
      <dl className="grid grid-cols-3 gap-4">
        {steps.map((step) => (
          <div key={step.label} className="flex flex-col-reverse gap-0.5">
            <dt className="text-xs text-ash">{step.label}</dt>
            <dd className="text-2xl font-medium tabular-nums tracking-[-0.01em]">{step.value}</dd>
          </div>
        ))}
      </dl>

      {found > 0 && (
        <div className="relative h-1.5 overflow-hidden rounded-full bg-rule" aria-hidden="true">
          <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: pct(checked) }} />
          <div className="absolute inset-y-0 left-0 bg-moss" style={{ width: pct(leads) }} />
        </div>
      )}

      {(ruledOut > 0 || unchecked > 0 || beingAssessed > 0) && (
        <ul className="flex flex-col gap-1 text-xs text-ash">
          {beingAssessed > 0 && <li>{beingAssessed} read, being assessed now</li>}
          {ruledOut > 0 && (
            <li>
              {ruledOut} ruled out automatically (no usable website, or size or country outside your request)
            </li>
          )}
          {unchecked > 0 && (
            <li>
              {isActive
                ? `${unchecked} still to check`
                : `${unchecked} ${unchecked === 1 ? "wasn't" : "weren't"} checked before the search ended`}
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
