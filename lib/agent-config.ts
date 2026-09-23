/**
 * Every tunable in one place — a one-line, auditable edit instead of a
 * magic number buried in tool code. See artifact/design.md Section 7.
 */

export const MODEL = "claude-sonnet-5";

/**
 * Defaults snapshotted into each run's `tool_limits` at creation. The
 * tools and the budget functions in 0001_init.sql enforce the run's own
 * snapshot, never these constants directly, so changing a value here only
 * affects new searches.
 *
 * Discovery is two fixed passes: the first pulls up to
 * FIRST_PASS_CANDIDATES, the single re-search gets whatever remains of
 * MAX_CANDIDATES (see the lead-list-quality skill).
 */
export const MAX_CANDIDATES = 30;
export const FIRST_PASS_CANDIDATES = 20;
export const MAX_DISCOVERY_PASSES = 2;
export const MAX_SCRAPES = 30;
export const MAX_QUALIFIED_LEADS = 10;
export const MAX_AGENT_TURNS = 50;

/**
 * harvestapi's LinkedIn company search, in "full" scraper mode — "short"
 * mode doesn't return the company website, which Firecrawl needs. Chosen
 * over automation-lab/linkedin-company-search-scraper for reliability
 * (100% vs 84% run success rate at evaluation time); see
 * artifact/design.md Section 1 and artifact/result.md / result2.md.
 */
export const APIFY_ACTOR_ID = "harvestapi/linkedin-company-search";

export const FIRECRAWL_RETRY_LIMIT = 1;
export const APIFY_RETRY_LIMIT = 1;
export const MAX_FORMAT_RETRY_ATTEMPTS = 3;

/**
 * Real platform/quality constraints, not stylistic guesses — see the
 * outbound-copywriting skill and artifact/design.md Section 5's retry
 * table. LinkedIn's connection-note cap is a hard platform limit; the
 * email limits are soft ceilings enforcing "short and direct."
 */
export const LINKEDIN_MESSAGE_MAX_CHARS = 300;
export const EMAIL_SUBJECT_MAX_CHARS = 60;
export const EMAIL_BODY_MAX_CHARS = 1500;

/**
 * harvestapi pay-per-result pricing, full mode: $4 per 1,000 companies
 * (short mode is $2/1,000 but lacks `website`). A small per-run start fee
 * (~$0.001) isn't modelled — it's noise next to the per-result cost.
 * A capped search pulls at most MAX_CANDIDATES, so ~$0.12.
 */
export const APIFY_COST_PER_LINKEDIN_RESULT = 0.004;

/**
 * Firecrawl is on the free plan right now — the column still gets
 * written (as 0), so moving to a paid tier later is a one-line flip, not
 * a schema or code change. See artifact/design.md Section 7.
 */
export const FIRECRAWL_COST_PER_SCRAPE = 0;

export const AGENT_SKILLS = [
  "icp-refinement",
  "lead-qualification",
  "outbound-copywriting",
  "lead-list-quality",
  "outreach-safety",
] as const;
