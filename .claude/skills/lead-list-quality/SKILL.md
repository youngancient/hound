---
name: lead-list-quality
description: Use when deciding whether the search has found enough qualified leads to stop, or needs another discovery pass — and when writing the plain-language explanation for a shortfall.
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

The goal is the run's configured number of qualified companies passing the checks above. If the candidate pool from the first discovery pass doesn't reach that number, search again once more within the run's remaining discovery budget. If it still falls short after that, stop and return what you have — do not loop indefinitely, and do not pad the list with weak `needs_review`-quality leads just to hit the number.

When you stop short, write a plain-language explanation of why (e.g. "found 7 qualified leads — searched again but ran out of new companies matching the criteria within the discovery budget"). This is what a non-technical user sees on the search's status, so write it as you would explain it to them directly, not as an internal log line.
