import { QUALIFICATION_LABEL, QUALIFICATION_COLOR_VAR, type QualificationStatus } from "@/lib/labels";

/**
 * A plain color pill with a real word in it — never color alone (matters
 * for colorblind users, frontend-design.md's accessibility floor).
 */
export function QualificationBadge({ status }: { status: QualificationStatus }) {
  const color = QUALIFICATION_COLOR_VAR[status];
  return (
    <span
      className="inline-flex w-fit items-center rounded-sm border px-2 py-0.5 text-xs font-medium"
      style={{ color, borderColor: color }}
    >
      {QUALIFICATION_LABEL[status]}
    </span>
  );
}
