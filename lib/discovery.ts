/**
 * Pure, deterministic discovery logic for the LinkedIn company search
 * actor (harvestapi/linkedin-company-search) — no I/O, no imports, so it
 * can be unit-tested directly (lib/discovery.test.ts). Claude interprets
 * the user's words into the refined ICP; everything here that has one
 * right answer (size buckets, location values, URL cleanup, pre-scrape
 * checks) is code, never the model. See artifact/design.md Section 3 and
 * the test runs recorded in artifact/result.md / result2.md.
 */

export type HeadcountRange = { min: number | null; max: number | null };

// LinkedIn's fixed company-size buckets, as the actor's `companySize`
// input names them.
const COMPANY_SIZE_BUCKETS: Array<{ value: string; start: number; end: number }> = [
  { value: "1-10", start: 1, end: 10 },
  { value: "11-50", start: 11, end: 50 },
  { value: "51-200", start: 51, end: 200 },
  { value: "201-500", start: 201, end: 500 },
  { value: "501-1000", start: 501, end: 1000 },
  { value: "1001-5000", start: 1001, end: 5000 },
  { value: "5001-10000", start: 5001, end: 10000 },
  { value: "10001+", start: 10001, end: Infinity },
];

/**
 * ICP headcount → LinkedIn size buckets. A bucket is included only when
 * it overlaps the ICP range by more than a single boundary value, so
 * 10–100 gives 11-50 + 51-200 (not 1-10), and 50–200 gives only 51-200.
 * An empty array means "don't send the filter": no headcount given, or
 * the range spans every bucket anyway.
 */
export function companySizeBuckets({ min, max }: HeadcountRange): string[] {
  if (min === null && max === null) return [];
  const lo = min ?? 0;
  const hi = max ?? Infinity;
  const overlap = (b: { start: number; end: number }) => Math.min(b.end, hi) - Math.max(b.start, lo);

  let buckets = COMPANY_SIZE_BUCKETS.filter((b) => overlap(b) >= 1);
  // A degenerate range (e.g. exactly 100) touches buckets only at a
  // point — fall back to any overlap rather than silently dropping the filter.
  if (buckets.length === 0) buckets = COMPANY_SIZE_BUCKETS.filter((b) => overlap(b) >= 0);
  if (buckets.length === COMPANY_SIZE_BUCKETS.length) return [];
  return buckets.map((b) => b.value);
}

/**
 * Location values confirmed to work against the actor in real runs —
 * "United States of America", for instance, 404s. Add a country here
 * only after testing it.
 */
const TESTED_LINKEDIN_LOCATIONS: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
};

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

export type ActorInput = {
  searchQuery: string;
  maxItems: number;
  startPage: 1;
  scraperMode: "full";
  companySize?: string[];
  locations?: string[];
};

/**
 * Builds the filtered actor input and its unfiltered fallback. Countries
 * go to the `locations` filter only when every one is in the tested
 * table; otherwise (and always in the fallback) their names are appended
 * to the query text instead. Location in the text is redundant once the
 * filter is set — test runs A and C returned the same result set.
 */
export function buildActorInputs(
  searchQuery: string,
  maxItems: number,
  icp: { headcount: HeadcountRange; countryCodes: string[] }
): { filtered: ActorInput; fallback: ActorInput | null } {
  const base = { maxItems, startPage: 1 as const, scraperMode: "full" as const };
  const query = searchQuery.trim();
  const countryText = icp.countryCodes.map((c) => regionNames.of(c) ?? c).join(" ");
  const withCountryText = countryText ? `${query} ${countryText}` : query;

  const companySize = companySizeBuckets(icp.headcount);
  const allTested = icp.countryCodes.length > 0 && icp.countryCodes.every((c) => c in TESTED_LINKEDIN_LOCATIONS);
  const locations = allTested ? icp.countryCodes.map((c) => TESTED_LINKEDIN_LOCATIONS[c]) : [];

  const filtered: ActorInput = {
    ...base,
    searchQuery: allTested ? query : withCountryText,
    ...(companySize.length > 0 ? { companySize } : {}),
    ...(locations.length > 0 ? { locations } : {}),
  };

  const hasFilters = companySize.length > 0 || locations.length > 0;
  return { filtered, fallback: hasFilters ? { ...base, searchQuery: withCountryText } : null };
}

/** Lowercased, whitespace-collapsed — two queries that differ only in spacing or case are the same query. */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

const NON_COMPANY_HOSTS = ["linkedin.com", "lnkd.in"];

/**
 * The actor's `website` is sometimes wrapped in LinkedIn's outbound
 * redirect (…/redir/phishing-page?url=…) and sometimes missing its scheme
 * ("www.paydock.com"). Handing either to Firecrawl as-is would scrape
 * LinkedIn's warning page or fail outright. Returns a clean http(s) URL,
 * or null if there's no usable company website.
 */
export function normalizeWebsite(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  let candidate = raw.trim();

  const redirect = tryParseUrl(candidate);
  if (redirect && isHost(redirect.hostname, "linkedin.com") && redirect.pathname.startsWith("/redir")) {
    const target = redirect.searchParams.get("url");
    if (!target) return null;
    candidate = target.trim();
  }

  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) candidate = `https://${candidate}`;

  const url = tryParseUrl(candidate);
  if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) return null;
  if (!url.hostname.includes(".")) return null;
  if (NON_COMPANY_HOSTS.some((host) => isHost(url.hostname, host))) return null;
  return url.href;
}

/** "https://www.Example.com/about" → "example.com" — the (run_id, company_domain) de-dupe key. */
export function domainFromUrl(url: string): string {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}

function tryParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isHost(hostname: string, host: string): boolean {
  const h = hostname.toLowerCase();
  return h === host || h.endsWith(`.${host}`);
}

export type CompanyCandidate = {
  name: string;
  linkedinUrl: string | null;
  website: string | null;
  domain: string | null;
  tagline: string | null;
  description: string | null;
  industries: string[];
  specialities: string[];
  employeeCountRange: { start: number; end: number | null } | null;
  /** LinkedIn members linked to the company — often disagrees with the range; a signal, not a fact. */
  linkedinMemberCount: number | null;
  headquarters: string | null;
  headquartersCountryCode: string | null;
  foundedYear: number | null;
  companyType: string | null;
};

const DESCRIPTION_MAX_CHARS = 1000;

/**
 * One raw actor item → the slim shape the agent sees. Every field is
 * optional in the actor's output (tagline, foundedOn, etc. come and go),
 * and the bulk of each item — similarOrganizations, peopleStats, logos,
 * affiliatedPages — is dropped here so it never inflates the agent's
 * context. Returns null for an item without a name.
 */
export function mapCompany(raw: unknown): CompanyCandidate | null {
  const r = asRecord(raw);
  const name = str(r.name);
  if (!name) return null;

  const website = normalizeWebsite(r.website);
  const range = asRecord(r.employeeCountRange);
  const start = num(range.start);
  const locations = Array.isArray(r.locations) ? r.locations.map(asRecord) : [];
  const hq = locations.find((l) => l.headquarter === true) ?? locations[0];
  const hqParsed = asRecord(hq?.parsed);
  const hqCountry = str(hqParsed.countryCode) ?? str(hq?.country);
  const description = str(r.description);
  const memberCount = num(r.employeeCount);

  return {
    name,
    linkedinUrl: str(r.linkedinUrl),
    website,
    domain: website ? domainFromUrl(website) : null,
    tagline: str(r.tagline),
    description:
      description && description.length > DESCRIPTION_MAX_CHARS
        ? `${description.slice(0, DESCRIPTION_MAX_CHARS)}…`
        : description,
    industries: (Array.isArray(r.industries) ? r.industries : [])
      .map((i) => str(asRecord(i).name))
      .filter((v): v is string => v !== null),
    specialities: (Array.isArray(r.specialities) ? r.specialities : []).filter(
      (s): s is string => typeof s === "string"
    ),
    employeeCountRange: start !== null ? { start, end: num(range.end) } : null,
    linkedinMemberCount: memberCount !== null && memberCount > 0 ? memberCount : null,
    headquarters: str(hqParsed.text),
    headquartersCountryCode: hqCountry ? hqCountry.toUpperCase() : null,
    foundedYear: num(asRecord(r.foundedOn).year),
    companyType: str(r.companyType),
  };
}

export type DropReason = "no usable website" | "size outside the ICP" | "headquarters outside the ICP's countries";

/**
 * Deterministic pre-scrape checks — nothing reaches Firecrawl or Claude
 * that code can already rule out. Size uses LinkedIn's declared range
 * only (the member count disagreed with it in half the test results),
 * with any overlap allowed since the range is coarse; a missing range or
 * HQ country is left for qualification rather than dropped.
 */
export function screenCandidates(
  candidates: CompanyCandidate[],
  icp: { headcount: HeadcountRange; countryCodes: string[] }
): { kept: CompanyCandidate[]; dropped: Array<{ name: string; reason: DropReason; company: CompanyCandidate }> } {
  const kept: CompanyCandidate[] = [];
  const dropped: Array<{ name: string; reason: DropReason; company: CompanyCandidate }> = [];
  const lo = icp.headcount.min ?? 0;
  const hi = icp.headcount.max ?? Infinity;

  for (const c of candidates) {
    let reason: DropReason | null = null;
    if (!c.website) {
      reason = "no usable website";
    } else if (c.employeeCountRange && (c.employeeCountRange.start > hi || (c.employeeCountRange.end ?? Infinity) < lo)) {
      reason = "size outside the ICP";
    } else if (
      icp.countryCodes.length > 0 &&
      c.headquartersCountryCode &&
      !icp.countryCodes.includes(c.headquartersCountryCode)
    ) {
      reason = "headquarters outside the ICP's countries";
    }

    if (reason) dropped.push({ name: c.name, reason, company: c });
    else kept.push(c);
  }
  return { kept, dropped };
}

/**
 * A stable per-search key for a company: its domain, or for companies with
 * no usable website (ruled out, but still worth listing) its LinkedIn URL,
 * falling back to its name.
 */
export function candidateKey(c: CompanyCandidate): string {
  if (c.domain) return c.domain;
  if (c.linkedinUrl) return `linkedin:${c.linkedinUrl.toLowerCase().replace(/\/+$/, "")}`;
  return `name:${c.name.toLowerCase().trim()}`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
