---
name: icp-refinement
description: Use when you have a user's qualification objective and need to turn it into concrete ICP criteria before searching for companies — including when the objective is vague and you need to make and document reasonable assumptions rather than asking for clarification.
---

# ICP Refinement

Use this skill to turn a qualification objective into concrete ICP criteria before spending any discovery or scraping tool calls.

## Goal

Understand who counts as a good-fit company before searching. There is no human in the loop once a search starts — if the objective is vague, make reasonable, documented assumptions instead of stopping to ask. Record those assumptions in the ICP object itself so they're visible in the run record.

## Minimum criteria to clarify

- Target company type
- Industry or niche
- Geography
- Company size or headcount range
- Relevant buyer or operator persona
- Business problem the company may have
- Hard disqualifiers
- Soft preferences

## Hard filters vs. soft preferences

Hard filters must be true for a lead to qualify (e.g. country must be United States, company must be B2B, headcount must be between 10 and 100). Soft preferences improve fit but should not automatically disqualify a company (e.g. recently hiring operations roles, uses tools that may connect to automation workflows).

## Output format

Produce this object and save it with the `save_icp` tool before searching — discovery refuses to run until it's saved, and it's locked once discovery starts:

```json
{
  "target_company_type": "",
  "industries": [],
  "geography": [],
  "headcount_min": null,
  "headcount_max": null,
  "country_codes": [],
  "buyer_persona": "",
  "business_problem": "",
  "hard_filters": [],
  "soft_preferences": [],
  "disqualifiers": [],
  "assumptions": []
}
```

`geography` is the plain-language description ("Boston area", "United States"); `country_codes` is its structured form, which discovery filtering and pre-scrape checks are computed from. Code does all of that computation — your job is only to read the user's words correctly.

## Reading headcount

Set `headcount_min` / `headcount_max` as whole numbers of employees; leave both `null` if the objective doesn't mention size.

- A range ("10 to 100 employees", "10–100 staff") → `10` / `100`.
- A single number ("100 employees", "companies with about 40 people") means *roughly that size*, not exactly it — use half to double: `50` / `200`, `20` / `80`.
- "Up to 100", "under 100", "fewer than 100" → `null` / `100`.
- "100+", "at least 100", "over 100" → `100` / `null`.
- Words count too: "small teams", "mid-size", "startups" — pick a sane range and say what you picked.

Every reading that isn't a literal range goes in `assumptions`, e.g. `"'100 employees' read as roughly 100 — searching 50–200"`.

## Reading geography

`country_codes` holds ISO 3166-1 alpha-2 codes, uppercase.

- Normalize any spelling or typo: "US", "USA", "U.S.", "America", "united states of amer" → `"US"`.
- The United Kingdom is `"GB"`, never `"UK"` ("UK", "Britain", "England", "Scotland" → `"GB"`).
- A region expands to its countries: "North America" → `["US", "CA"]`, "DACH" → `["DE", "AT", "CH"]`. Record the expansion in `assumptions`.
- A city or state keeps its country's code ("Boston" → `["US"]`) and stays in `geography` as written — qualification checks the city.
- Genuinely ambiguous names ("Georgia" — the country or the US state?) — decide from context and record the choice in `assumptions`.
- No location mentioned → `[]` (search everywhere).

`assumptions` is Hound-specific, not in the original guide: when the objective was vague and you filled a gap with a reasonable default (e.g. a broad but sane headcount range), record what you assumed and why, in plain language. These are shown to the user on the search page under "How Hound read your request" — write them for a marketer or salesperson, not as internal notes.

## Rules

- Do not treat every user preference as a hard filter.
- Never pause or ask a human to clarify — reason through ambiguity yourself and document it in `assumptions`.
- Preserve specific constraints the user gives, verbatim in spirit — a stated hard number (e.g. "10 to 100 employees") is a hard filter, not something to loosen.
- Keep the ICP narrow enough to search, but not so narrow that discovery can't find candidates within the run's limits.
