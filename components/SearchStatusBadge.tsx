import { SEARCH_STATUS_COLOR_VAR, SEARCH_STATUS_LABEL, type RunStatus } from "@/lib/labels";

/** Same shape as the lead verdict tags; the colour always comes with the word. */
export function SearchStatusBadge({ status }: { status: RunStatus }) {
  const color = SEARCH_STATUS_COLOR_VAR[status];
  return (
    <span
      className="inline-flex w-fit shrink-0 items-center rounded-sm border px-2 py-0.5 text-xs font-medium"
      style={{ color, borderColor: color }}
    >
      {SEARCH_STATUS_LABEL[status]}
    </span>
  );
}
