import { PIPELINE_STAGES } from "@/lib/labels";

/**
 * Plain-language pipeline trail. The current step gets a pulsing dot — the
 * one deliberate motion in the whole UI (frontend-design.md) — instead of
 * a generic spinner; earlier steps get a plain filled dot, later ones a
 * hollow one.
 */
export function PipelineTrail({ currentStage }: { currentStage: string | null }) {
  const currentIndex = currentStage ? PIPELINE_STAGES.indexOf(currentStage as (typeof PIPELINE_STAGES)[number]) : -1;

  return (
    <ol className="flex flex-col gap-2">
      {PIPELINE_STAGES.map((stage, i) => {
        const isDone = currentIndex >= 0 && i < currentIndex;
        const isCurrent = i === currentIndex;
        return (
          <li key={stage} className="flex items-center gap-2 text-sm">
            <span
              className={`inline-block h-2 w-2 shrink-0 rounded-full ${isCurrent ? "trail-pulse bg-accent" : isDone ? "bg-moss" : "bg-rule"}`}
              aria-hidden="true"
            />
            <span className={isCurrent ? "text-ink" : isDone ? "text-ash" : "text-ash/60"}>{stage}</span>
          </li>
        );
      })}
    </ol>
  );
}
