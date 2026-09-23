import Link from "next/link";

/** Previous / Next through the review list, with the position for orientation. */
export function PrevNext({
  prevHref,
  nextHref,
  position,
  total,
  replace = false,
}: {
  prevHref: string | null;
  nextHref: string | null;
  position: number;
  total: number;
  replace?: boolean;
}) {
  const linkClass =
    "rounded-sm border border-rule px-3 py-1.5 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
  const disabledClass = "rounded-sm border border-rule px-3 py-1.5 text-sm text-ash/60";

  return (
    <nav aria-label="Move through companies" className="flex items-center justify-between gap-3">
      {prevHref ? (
        <Link href={prevHref} replace={replace} scroll={false} className={linkClass}>
          Previous
        </Link>
      ) : (
        <span className={disabledClass}>Previous</span>
      )}
      <span className="text-xs text-ash tabular-nums">
        {position} of {total}
      </span>
      {nextHref ? (
        <Link href={nextHref} replace={replace} scroll={false} className={linkClass}>
          Next
        </Link>
      ) : (
        <span className={disabledClass}>Next</span>
      )}
    </nav>
  );
}
