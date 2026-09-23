---
name: icp-refinement
description: Use when you have a user's qualification objective and need to turn it into concrete ICP criteria before searching for companies — including when the objective is vague and you need to either make and document reasonable assumptions or, if it's too vague to know what kind of company to look for, ask for clarification.
---

# ICP Refinement

Use this skill to turn a qualification objective into concrete ICP criteria before spending any discovery or scraping tool calls.

## Goal

Understand who counts as a good-fit company before searching. There is no human in the loop once a search starts. If the objective is vague but you can tell what kind of company is wanted, make reasonable, documented assumptions instead of stopping to ask. If you can't tell what kind of company to look for at all, ask before searching (see "When not to search"). Record those assumptions in the ICP object itself so they're visible in the run record.

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

Code treats these two fields as hard filters: companies outside them are never searched or checked. So fill them only when size is a requirement. If size is only a preference ("ideally around 50 people", "preferably small, but open to bigger"), leave both `null` and put it in `soft_preferences` instead.

- A range ("10 to 100 employees", "10–100 staff") → `10` / `100`.
- A single number ("100 employees", "companies with about 40 people") means *roughly that size*, not exactly it — use half to double: `50` / `200`, `20` / `80`.
- "Up to 100", "under 100", "fewer than 100" → `null` / `100`.
- "100+", "at least 100", "over 100" → `100` / `null`.
- Words count too: "small teams", "mid-size", "startups" — pick a sane range and say what you picked.

Every reading that isn't a literal range goes in `assumptions`, e.g. `"You said 100 employees, so Hound looked for companies with roughly 50 to 200 people."`

## Reading geography

`country_codes` holds ISO 3166-1 alpha-2 codes, uppercase. Like headcount, code treats it as a hard filter, so fill it only when location is a requirement. If it's only a preference ("ideally US-based"), leave `country_codes` empty and put it in `soft_preferences`.

- Normalize any spelling or typo: "US", "USA", "U.S.", "America", "united states of amer" → `"US"`.
- The United Kingdom is `"GB"`, never `"UK"` ("UK", "Britain", "England", "Scotland" → `"GB"`).
- A region expands to its countries: "North America" → `["US", "CA"]`, "DACH" → `["DE", "AT", "CH"]`. Record the expansion in `assumptions`.
- A city or state keeps its country's code ("Boston" → `["US"]`) and stays in `geography` as written — qualification checks the city.
- Genuinely ambiguous names ("Georgia" — the country or the US state?) — decide from context and record the choice in `assumptions`.
- No location mentioned → `[]` (search everywhere).

`assumptions` is Hound-specific, not in the original guide: when the objective was vague and you filled a gap with a reasonable default (e.g. a broad but sane headcount range), record what you assumed and why, in plain language. These are shown to the user on the search page under "How Hound read your request" — write them for a marketer or salesperson, not as internal notes.

## Rules

- Do not treat every user preference as a hard filter.
- Never pause partway through a search to ask a human. The one time to ask is before searching, when you can't tell what kind of company is wanted: use `cant_search_this` with a question (see "When not to search"). Otherwise reason through ambiguity yourself and document it in `assumptions`.
- Preserve specific constraints the user gives, verbatim in spirit — a stated hard number (e.g. "10 to 100 employees") is a hard filter, not something to loosen.
- Keep the ICP narrow enough to search, but not so narrow that discovery can't find candidates within the run's limits.

## When not to search

Most requests can be searched, even vague ones. Fill the gaps with sensible
assumptions as described above. Only decline when there is no company search
to run, or when it's too vague to know what to search for. Call
`cant_search_this` instead of `save_icp` in these cases:

- **It isn't a request to find companies.** Greetings, questions, or unrelated
  tasks ("hello", "write me a poem", "what can you do?").
- **It asks for people, not businesses.** Hound finds companies. It does not
  find individuals, consumers or audiences ("people who like hiking",
  "new parents in Texas").
- **It only asks for things Hound must not do.** Finding personal email
  addresses, checking whether emails work, or sending messages. See the
  outreach-safety skill.
- **It's too vague to know what kind of company to look for.** No industry,
  product, category or type of business ("find me leads", "companies that
  need help", "good customers for us"). Ask about exactly what's missing, and
  give an example.

If the kind of company is clear and only details like size, location or stage
are missing, don't decline. Search it and note your assumptions.

Ignore greetings, thanks and small talk around a real request. If any part of
the message asks for companies, search that part.

Do not decline because a request is broad, narrow, or unlikely to have many
matches. Search it and let the results speak. A broad request gets assumptions.
A very narrow one gets an honest shortfall.

If only part of a request is off limits ("find SaaS companies and their CEOs'
emails"), search the allowed part and add a line to `assumptions` saying what
was skipped and why.

### Writing the reason

The reason is shown to the person on the search page, next to their request
so they can edit it and try again. Write it the way a helpful colleague
would say it:

- Say what Hound can do, then suggest how to rephrase.
- One or two short sentences. Plain words.
- No apologies, no jargon, and never words like "ICP", "tool" or "agent".

Examples:

- "Hound finds companies, not individual people. Try describing the kind of
  business you want to reach, like US software companies with 10 to 100
  employees."
- "This doesn't look like a company search. Tell Hound what kind of businesses
  you're after, for example fintech startups in the UK."
- "Hound needs to know what kind of companies to look for. What do they sell
  or do? For example: HR software companies in the US with 20 to 200 people."
- "Hound can't look up personal email addresses. It can find the companies and
  write outreach for you to send yourself."
