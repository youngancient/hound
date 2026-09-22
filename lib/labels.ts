/**
 * The language-mapping table from artifact/frontend-design.md, centralized
 * so no page has to remember to translate an internal term itself.
 * Nothing here — or anywhere in the UI — should ever say "run", "Apify",
 * "Firecrawl", "tool_calls", or a raw confidence decimal.
 */

export type RunStatus = "pending" | "running" | "completed" | "failed";
export type QualificationStatus = "qualified" | "not_qualified" | "needs_review";

export const SEARCH_STATUS_LABEL: Record<RunStatus, string> = {
  pending: "Getting started",
  running: "Searching",
  completed: "Done",
  failed: "Didn't finish",
};

export const QUALIFICATION_LABEL: Record<QualificationStatus, string> = {
  qualified: "Good fit",
  not_qualified: "Not a fit",
  needs_review: "Needs a look",
};

export const QUALIFICATION_COLOR_VAR: Record<QualificationStatus, string> = {
  qualified: "var(--moss)",
  not_qualified: "var(--oxblood)",
  needs_review: "var(--accent)",
};

/** "82% · High confidence" — never the bare 0.0–1.0 decimal. */
export function formatConfidence(confidence: number): string {
  const pct = Math.round(confidence * 100);
  const tier = confidence >= 0.75 ? "High confidence" : confidence >= 0.5 ? "Some uncertainty" : "Low confidence";
  return `${pct}% · ${tier}`;
}

export const PIPELINE_STAGES = [
  "Understanding the request",
  "Finding companies",
  "Checking websites",
  "Finding good fits",
  "Writing outreach",
  "Done",
] as const;
