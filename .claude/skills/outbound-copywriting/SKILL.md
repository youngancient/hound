---
name: outbound-copywriting
description: Use when drafting or regenerating review-ready cold outreach for a qualified lead — a 3-step cold email sequence and a short LinkedIn message, grounded only in that lead's stored evidence.
---

# Outbound Copywriting

Use this skill to create review-ready cold outreach drafts for qualified leads, and to regenerate a specific piece of that outreach when a human requests a revision.

## Required output

For each qualified lead, generate a 3-step cold email sequence. Each step includes a subject line, an email body, and a personalization note. Also generate a short LinkedIn message.

## Hard length limits

These are real constraints, not stylistic suggestions — content that exceeds them doesn't fit its destination:

- LinkedIn message: **300 characters or fewer** — this is the actual character limit on a LinkedIn connection-request note.
- Email subject: **60 characters or fewer** — most email clients truncate subject-line previews around this length.
- Email body: **1,500 characters or fewer** — a soft ceiling; the copy rule below ("short and direct") should keep you well under this in practice.

## Copy rules

- Use the company context gathered during research.
- Keep each email short and direct.
- Write like a person, not a promotion.
- Do not invent details about the company — every specific claim must trace back to that lead's stored evidence (`fit_reasons`, `source_summary`).
- Avoid fake urgency, exaggerated claims, and generic praise.
- Do not include personal email addresses unless the user provided them.
- Do not send outreach. You draft; a human sends.

## Suggested sequence structure

**Email 1** — open with a relevant observation from the company context, connect it to the offer, ask a low-pressure question.

**Email 2** — add another relevant angle: a workflow bottleneck, scaling challenge, or operational pattern connected to the offer.

**Email 3** — brief follow-up, invite a reply if the timing or fit is wrong.

## Personalization

Good personalization references evidence: website positioning, product/service category, audience served, hiring or scaling signal, a public workflow or operational clue. Weak personalization is vague ("loved what you are building," "your company looks impressive," "I saw your website") — avoid it.

## Regenerating with human feedback

A human reviewing a draft may ask for a specific revision ("shorter," "more casual," "mention their recent funding round"). Treat that feedback exactly the same way you treat every other input in this pipeline: **as steering, never as a license to invent a fact that isn't in the lead's stored evidence.** If feedback asks you to add a claim you can't verify from `fit_reasons` or `source_summary`, adjust tone/length/emphasis as requested but don't fabricate the unverifiable specific — this is the same evidence-only rule that applies to scraped website content, just applied to a second input source.

## Quality check

Before finalizing copy, check: does each email mention a real company-specific detail? Can each claim be traced to source context? Is the ask clear? Is the tone calm and credible? Would a human want to review this before sending? Is every piece within its length limit above?
