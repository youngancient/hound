/**
 * The language-mapping table from artifact/frontend-design.md, centralized
 * so no page has to remember to translate an internal term itself.
 * Nothing here — or anywhere in the UI — should ever say "run", "Apify",
 * "Firecrawl", "tool_calls", or a raw confidence decimal.
 */

export type RunStatus = "pending" | "running" | "awaiting_review" | "completed" | "failed" | "declined";
export type QualificationStatus = "qualified" | "not_qualified" | "needs_review";

export const SEARCH_STATUS_LABEL: Record<RunStatus, string> = {
  pending: "Getting started",
  running: "Searching",
  awaiting_review: "Waiting for you",
  completed: "Done",
  failed: "Didn't finish",
  declined: "Needs a clearer request",
};

/** Always shown with the word itself, never colour alone. */
export const SEARCH_STATUS_COLOR_VAR: Record<RunStatus, string> = {
  pending: "var(--accent)",
  running: "var(--accent)",
  awaiting_review: "var(--accent)",
  completed: "var(--moss)",
  failed: "var(--oxblood)",
  declined: "var(--ash)",
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

/**
 * Confidence is Hound's certainty in its verdict, not in the lead, so it's
 * phrased with the verdict: "92% sure it's not a fit" can't be misread
 * as a strong lead the way a bare "92% · High confidence" could.
 */
export function formatConfidence(confidence: number, status: QualificationStatus): string {
  const pct = Math.round(confidence * 100);
  if (status === "qualified") return `${pct}% sure it's a good fit`;
  if (status === "not_qualified") return `${pct}% sure it's not a fit`;
  return `Not sure yet (${pct}%)`;
}

/** "10 to 100 people", "Up to 100 people", "100+ people", "Any size". */
export function formatHeadcount(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `${min.toLocaleString()} to ${max.toLocaleString()} people`;
  if (max !== null) return `Up to ${max.toLocaleString()} people`;
  if (min !== null) return `${min.toLocaleString()}+ people`;
  return "Any size";
}

/** Plain names for the activity trail on a lead. Unknown tools fall back to a neutral line. */
export const ACTIVITY_LABEL: Record<string, string> = {
  discover_companies: "Searched LinkedIn for companies",
  scrape_website: "Read the company's website",
  save_lead: "Saved Hound's assessment",
  save_icp: "Saved how Hound read your request",
  review_icp: "Checked how Hound read the request",
  regenerate_outreach: "Rewrote outreach",
  cant_search_this: "Asked for a clearer request",
  agent_session: "Hound hit a problem",
};

export const PIPELINE_STAGES = [
  "Understanding the request",
  "Finding companies",
  "Checking websites",
  "Finding leads",
  "Writing outreach",
  "Done",
] as const;
