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

Produce this object before searching:

```json
{
  "target_company_type": "",
  "industries": [],
  "geography": [],
  "headcount_range": "",
  "buyer_persona": "",
  "business_problem": "",
  "hard_filters": [],
  "soft_preferences": [],
  "disqualifiers": [],
  "assumptions": []
}
```

`assumptions` is Hound-specific, not in the original guide: when the objective was vague and you filled a gap with a reasonable default (e.g. a broad but sane headcount range), record what you assumed and why, in plain language. This is what lets the run record show your reasoning instead of a black box.

## Rules

- Do not treat every user preference as a hard filter.
- Never pause or ask a human to clarify — reason through ambiguity yourself and document it in `assumptions`.
- Preserve specific constraints the user gives, verbatim in spirit — a stated hard number (e.g. "10 to 100 employees") is a hard filter, not something to loosen.
- Keep the ICP narrow enough to search, but not so narrow that discovery can't find candidates within the run's limits.
