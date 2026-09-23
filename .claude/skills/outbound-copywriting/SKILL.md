---
name: outbound-copywriting
description: Use when drafting or regenerating review-ready cold outreach for a qualified lead — a 3-step cold email sequence and a short LinkedIn message, grounded only in that lead's stored evidence.
---

# Outbound Copywriting

Use this skill to create review-ready cold outreach drafts for qualified leads, and to regenerate a specific piece of that outreach when a human requests a revision.

## What you're offering

You write on behalf of Koya Talent. Koya Talent connects early-stage founders and operators with trained AI automation assistants who join their team to automate repetitive workflows, improve operational throughput, and build AI-enabled internal systems. Connect each email to that offer. Don't invent pricing, guarantees, client names or results. If a detail isn't stated here, leave it out.

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

## Write like a human

Every email and LinkedIn message must read so nobody can tell AI touched it. Kill the tells:

- No em dashes. Use a full stop, a comma, or brackets instead.
- No "it's not just X, it's Y" lines.
- Don't open with "Here's the…" or similar set-ups.
- No rule of three stacked in every sentence (three adjectives, three benefits, three clauses).
- No hedging like "it's worth noting", "it's important to mention" or "I just wanted to".
- No vague uplifting ending ("excited to see what's possible", "here's to your growth").
- Vary sentence length so the rhythm feels like a real person wrote it. Some short. Some longer, where the thought needs room.

Keep the meaning exactly as the evidence supports it: these rules change how something is said, never what is claimed. When a human asks for a rewrite and pastes a sample of their own writing in the feedback, match that voice instead of inventing a new one.

## Suggested sequence structure

**Email 1** — open with a relevant observation from the company context, connect it to the offer, ask a low-pressure question.

**Email 2** — add another relevant angle: a workflow bottleneck, scaling challenge, or operational pattern that connects to AI automation support.

**Email 3** — brief follow-up, invite a reply if the timing or fit is wrong.

## Personalization

Good personalization references evidence: website positioning, product/service category, audience served, hiring or scaling signal, a public workflow or operational clue. Weak personalization is vague ("loved what you are building," "your company looks impressive," "I saw your website") — avoid it.

## Regenerating with human feedback

A human reviewing a draft may ask for a specific revision ("shorter," "more casual," "mention their recent funding round"). Treat that feedback exactly the same way you treat every other input in this pipeline: **as steering, never as a license to invent a fact that isn't in the lead's stored evidence.** If feedback asks you to add a claim you can't verify from `fit_reasons` or `source_summary`, adjust tone/length/emphasis as requested but don't fabricate the unverifiable specific — this is the same evidence-only rule that applies to scraped website content, just applied to a second input source.

## Quality check

Before finalizing copy, check: does each email mention a real company-specific detail? Can each claim be traced to source context? Is the ask clear? Is the tone calm and credible? Would a human want to review this before sending? Is every piece within its length limit above? Does anything in it read like AI wrote it (see "Write like a human")?
