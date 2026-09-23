import { PIPELINE_STAGES } from "@/lib/labels";

/**
 * Plain-language pipeline trail. The current step gets a pulsing dot — the
 * one deliberate motion in the whole UI (frontend-design.md) — instead of
 * a generic spinner; earlier steps get a plain filled dot, later ones a
 * hollow one.
 */
export function PipelineTrail({
  currentStage,
  stopped = false,
  orientation = "vertical",
}: {
  currentStage: string | null;
  stopped?: boolean;
  /** Horizontal sits in a single row under the search header. */
  orientation?: "vertical" | "horizontal";
}) {
  const currentIndex = currentStage ? PIPELINE_STAGES.indexOf(currentStage as (typeof PIPELINE_STAGES)[number]) : -1;

  return (
    <ol
      aria-label="Search progress"
      className={orientation === "horizontal" ? "flex flex-wrap items-center gap-x-5 gap-y-2" : "flex flex-col gap-2"}
    >
      {PIPELINE_STAGES.map((stage, i) => {
        const isDone = currentIndex >= 0 && i < currentIndex;
        const isCurrent = i === currentIndex;
        const stoppedHere = stopped && isCurrent;
        return (
          <li key={stage} className="flex items-center gap-2 text-sm">
            <span
              className={`inline-block h-2 w-2 shrink-0 rounded-full ${
                stoppedHere ? "bg-oxblood" : isCurrent ? "trail-pulse bg-accent" : isDone ? "bg-moss" : "bg-rule"
              }`}
              aria-hidden="true"
            />
            <span className={isCurrent ? "text-ink" : isDone ? "text-ash" : "text-ash/60"}>
              {stage}
              {stoppedHere && <span className="text-oxblood"> (stopped here)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
