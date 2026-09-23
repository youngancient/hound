---
name: lead-list-quality
description: Use when deciding whether the search has found enough qualified leads to stop, or needs another discovery pass.
---

# Lead-List Quality

Use this skill to check the quality of the lead list as the search progresses and to decide when to stop.

## Required checks

- The list contains up to the target number of qualified companies (the run's configured limit).
- Each company has a name and domain.
- Each company has qualification reasoning.
- Each company has source context.
- Each qualified company has outreach drafts.
- No personal email finding or email validation was attempted.
- Duplicate companies were removed (enforced structurally by the save-lead tool — you don't need to de-dupe yourself, but don't re-request a company you've already seen).
- Companies marked `needs_review` are not counted toward the qualified target.

## Scorecard

| Dimension | What to check |
| --- | --- |
| ICP fit | The lead matches the hard filters in the qualification objective. |
| Evidence quality | The qualification decision uses real source context. |
| Duplicate rate | The same company does not appear more than once. |
| Outreach relevance | The email sequence uses company-specific context. |
| Data completeness | Required fields are present. |
| Safety compliance | No email finding, no email validation, no outreach sending. |

## Pass standard, and what to do on a shortfall

The goal is the run's configured number of qualified companies passing the checks above.

Discovery is two fixed passes, and the tool — not you — decides how many companies each pass returns:

1. **First pass** — returns up to the run's first-pass size. Work through those candidates first.
2. **Re-search** — only if the first pass didn't reach the target. Use a genuinely different, rephrased query (a synonym for the niche, or the problem the product solves), not the same one again — repeating a query buys the same companies twice. It returns whatever remains of the discovery budget.

Once the target is reached, stop: don't scrape the remaining candidates and don't re-search — the tools will refuse anyway. If it still falls short after the re-search, stop and return what you have — there is no third pass, and do not pad the list with weak `needs_review`-quality leads just to hit the number.

When you stop short, just stop. You don't need to write an explanation: Hound writes the one the user sees from what actually happened (it ran out of new companies to check, or it hit its limit for the search).
