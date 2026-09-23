// Run with `npm test` (Node's built-in runner, TypeScript via type stripping).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildActorInputs,
  candidateKey,
  companySizeBuckets,
  mapCompany,
  normalizeQuery,
  normalizeWebsite,
  screenCandidates,
  type CompanyCandidate,
} from "../lib/discovery.ts";

test("companySizeBuckets: includes a bucket only when it overlaps by more than a boundary value", () => {
  assert.deepEqual(companySizeBuckets({ min: 10, max: 100 }), ["11-50", "51-200"]);
  assert.deepEqual(companySizeBuckets({ min: 50, max: 200 }), ["51-200"]);
  assert.deepEqual(companySizeBuckets({ min: 20, max: 80 }), ["11-50", "51-200"]);
  assert.deepEqual(companySizeBuckets({ min: null, max: 100 }), ["1-10", "11-50", "51-200"]);
  assert.deepEqual(companySizeBuckets({ min: 1000, max: null }), ["1001-5000", "5001-10000", "10001+"]);
});

test("companySizeBuckets: no filter when size is unknown or spans everything", () => {
  assert.deepEqual(companySizeBuckets({ min: null, max: null }), []);
  assert.deepEqual(companySizeBuckets({ min: 0, max: null }), []);
});

test("companySizeBuckets: a single exact number still yields a filter", () => {
  assert.deepEqual(companySizeBuckets({ min: 100, max: 100 }), ["51-200"]);
  assert.deepEqual(companySizeBuckets({ min: 50, max: 50 }), ["11-50"]);
});

test("buildActorInputs: tested countries become the locations filter, query stays niche-only", () => {
  const { filtered, fallback } = buildActorInputs("B2B SaaS platform", 20, {
    headcount: { min: 10, max: 100 },
    countryCodes: ["US"],
  });
  assert.deepEqual(filtered, {
    searchQuery: "B2B SaaS platform",
    maxItems: 20,
    startPage: 1,
    scraperMode: "full",
    companySize: ["11-50", "51-200"],
    locations: ["United States"],
  });
  assert.deepEqual(fallback, {
    searchQuery: "B2B SaaS platform United States",
    maxItems: 20,
    startPage: 1,
    scraperMode: "full",
  });
});

test("buildActorInputs: an untested country goes into the text, not the filter", () => {
  const { filtered } = buildActorInputs("fintech payments platform", 10, {
    headcount: { min: null, max: null },
    countryCodes: ["US", "BR"],
  });
  assert.equal(filtered.searchQuery, "fintech payments platform United States Brazil");
  assert.equal(filtered.locations, undefined);
  assert.equal(filtered.companySize, undefined);
});

test("buildActorInputs: no filters means no fallback", () => {
  const { fallback } = buildActorInputs("HR software platform", 20, {
    headcount: { min: null, max: null },
    countryCodes: [],
  });
  assert.equal(fallback, null);
});

test("normalizeQuery ignores case and spacing", () => {
  assert.equal(normalizeQuery("  B2B  SaaS\tPlatform "), "b2b saas platform");
});

test("normalizeWebsite: unwraps LinkedIn's redirect (artifact/result.md, B2B Centrum)", () => {
  assert.equal(
    normalizeWebsite("https://www.linkedin.com/redir/phishing-page?url=http%3A%2F%2Fwww%2eb2bcentrum%2ecz"),
    "http://www.b2bcentrum.cz/"
  );
});

test("normalizeWebsite: adds a missing scheme (Paydock) and keeps plain URLs", () => {
  assert.equal(normalizeWebsite("www.paydock.com"), "https://www.paydock.com/");
  assert.equal(normalizeWebsite("https://wlcm.studio/"), "https://wlcm.studio/");
});

test("normalizeWebsite: rejects non-company and unusable values", () => {
  assert.equal(normalizeWebsite(null), null);
  assert.equal(normalizeWebsite(""), null);
  assert.equal(normalizeWebsite("https://lnkd.in/eajx4rde"), null);
  assert.equal(normalizeWebsite("https://www.linkedin.com/company/foo/"), null);
  assert.equal(normalizeWebsite("not a url"), null);
});

test("mapCompany: slims a real actor item and keeps only signals", () => {
  const c = mapCompany({
    name: "WLCM \"Welcome\" App Studio",
    linkedinUrl: "https://www.linkedin.com/company/wlcm-app-studio/",
    tagline: "Top mobile & web app design + development agency.",
    website: "https://wlcm.studio/",
    employeeCount: 26,
    employeeCountRange: { start: 11, end: 50 },
    description: "x".repeat(1500),
    companyType: "Privately Held",
    locations: [
      { country: "us", headquarter: false, parsed: { text: "Elsewhere", countryCode: "US" } },
      { country: "US", headquarter: true, parsed: { text: "San Francisco, CA, United States", countryCode: "US" } },
    ],
    specialities: ["SaaS Development", 42],
    industries: [{ id: "4", name: "Software Development" }],
    similarOrganizations: [{ name: "should be dropped" }],
    peopleStats: [{ statTitle: "Locations", values: [] }],
  });
  assert.ok(c);
  assert.equal(c.domain, "wlcm.studio");
  assert.equal(c.headquarters, "San Francisco, CA, United States");
  assert.equal(c.headquartersCountryCode, "US");
  assert.deepEqual(c.industries, ["Software Development"]);
  assert.deepEqual(c.specialities, ["SaaS Development"]);
  assert.deepEqual(c.employeeCountRange, { start: 11, end: 50 });
  assert.equal(c.linkedinMemberCount, 26);
  assert.equal(c.foundedYear, null);
  assert.equal(c.description?.length, 1001);
  assert.ok(!("similarOrganizations" in c));
});

test("mapCompany: zero member count is dropped, missing name is rejected", () => {
  assert.equal(mapCompany({ name: "B2B Centrum", employeeCount: 0 })?.linkedinMemberCount, null);
  assert.equal(mapCompany({ website: "https://x.com" }), null);
});

function candidate(overrides: Partial<CompanyCandidate>): CompanyCandidate {
  return {
    name: "Acme",
    linkedinUrl: null,
    website: "https://acme.com/",
    domain: "acme.com",
    tagline: null,
    description: null,
    industries: [],
    specialities: [],
    employeeCountRange: { start: 11, end: 50 },
    linkedinMemberCount: null,
    headquarters: null,
    headquartersCountryCode: "US",
    foundedYear: null,
    companyType: null,
    ...overrides,
  };
}

test("screenCandidates: drops what code can rule out, leaves unknowns to qualification", () => {
  const icp = { headcount: { min: 10, max: 100 }, countryCodes: ["US"] };
  const { kept, dropped } = screenCandidates(
    [
      candidate({ name: "Good" }),
      candidate({ name: "No site", website: null, domain: null }),
      candidate({ name: "Too big", employeeCountRange: { start: 1001, end: 5000 } }),
      candidate({ name: "Czech", headquartersCountryCode: "CZ" }),
      candidate({ name: "Unknown size", employeeCountRange: null }),
      candidate({ name: "Unknown HQ", headquartersCountryCode: null }),
      candidate({ name: "Straddles", employeeCountRange: { start: 51, end: 200 } }),
    ],
    icp
  );
  assert.deepEqual(kept.map((c) => c.name), ["Good", "Unknown size", "Unknown HQ", "Straddles"]);
  assert.deepEqual(dropped.map(({ name, reason }) => ({ name, reason })), [
    { name: "No site", reason: "no usable website" },
    { name: "Too big", reason: "size outside the ICP" },
    { name: "Czech", reason: "headquarters outside the ICP's countries" },
  ]);
});

test("candidateKey: domain, else LinkedIn URL, else name", () => {
  assert.equal(candidateKey(candidate({ domain: "acme.com" })), "acme.com");
  assert.equal(
    candidateKey(candidate({ domain: null, website: null, linkedinUrl: "https://www.linkedin.com/company/Acme/" })),
    "linkedin:https://www.linkedin.com/company/acme"
  );
  assert.equal(candidateKey(candidate({ domain: null, website: null, linkedinUrl: null, name: " Acme Inc " })), "name:acme inc");
});
