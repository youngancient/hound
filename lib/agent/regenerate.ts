import "server-only";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { MODEL, MAX_FORMAT_RETRY_ATTEMPTS, LINKEDIN_MESSAGE_MAX_CHARS, EMAIL_SUBJECT_MAX_CHARS, EMAIL_BODY_MAX_CHARS } from "../agent-config";
import type { RegenerateTarget } from "../schemas";

type LeadEvidence = {
  companyName: string;
  fitReasons: string[];
  sourceSummary: string | null;
};

export type RegenerateOutcome =
  | { ok: true; content: unknown; costUsd: number }
  | { ok: false; reason: string; costUsd: number };

/**
 * Loading each skill takes turns of its own before the answer; a real test
 * run used 5 (reported num_turns). 8 leaves headroom without letting a
 * single rewrite run away (each attempt is still capped by this).
 */
const REGENERATE_MAX_TURNS = 8;

const TARGET_LABEL: Record<RegenerateTarget, string> = {
  email_1: "the first cold email in the sequence (subject, body, personalization_note)",
  email_2: "the second cold email in the sequence (subject, body, personalization_note)",
  email_3: "the third/final cold email in the sequence (subject, body, personalization_note)",
  linkedin_message: "the short LinkedIn message",
};

function maxCharsFor(target: RegenerateTarget) {
  return target === "linkedin_message" ? LINKEDIN_MESSAGE_MAX_CHARS : null; // email length checked per-field below
}

/**
 * A single, fast Agent SDK session per regenerate request — no Apify/
 * Firecrawl, no Inngest, just one short query() grounded in the lead's
 * already-stored evidence (design.md Section 1). Feedback steers tone/
 * length/emphasis only; the outbound-copywriting and outreach-safety
 * skills constrain it against inventing facts outside that evidence.
 * Bounded format-retry (Section 5) protects existing content on failure —
 * never overwrite a good draft with a failed attempt.
 */
export async function regenerateOutreachTarget(
  target: RegenerateTarget,
  feedback: string,
  evidence: LeadEvidence
): Promise<RegenerateOutcome> {
  let costUsd = 0;
  let lastIssue: string | null = null;

  for (let attempt = 1; attempt <= MAX_FORMAT_RETRY_ATTEMPTS; attempt++) {
    const isEmail = target !== "linkedin_message";
    const prompt = [
      `Regenerate ${TARGET_LABEL[target]} for this lead.`,
      `Company: ${evidence.companyName}`,
      `Fit reasons (evidence): ${evidence.fitReasons.join("; ")}`,
      evidence.sourceSummary ? `Source summary (evidence): ${evidence.sourceSummary}` : "",
      `Human feedback for this revision: ${feedback}`,
      lastIssue ? `Your previous attempt was rejected: ${lastIssue}` : "",
      isEmail
        ? `Respond with ONLY a JSON object: {"subject": "...", "body": "...", "personalization_note": "..."}. Subject must be ${EMAIL_SUBJECT_MAX_CHARS} characters or fewer, body ${EMAIL_BODY_MAX_CHARS} characters or fewer.`
        : `Respond with ONLY the LinkedIn message text, ${LINKEDIN_MESSAGE_MAX_CHARS} characters or fewer — nothing else.`,
    ]
      .filter(Boolean)
      .join("\n");

    let resultText = "";

    // The SDK throws after an error result (e.g. hitting maxTurns), so the
    // loop is guarded: a failed attempt becomes a retry, never a crash.
    try {
      for await (const message of query({
        prompt,
        options: {
          cwd: process.cwd(),
          settingSources: ["project"],
          skills: ["outbound-copywriting", "outreach-safety"],
          allowedTools: ["Skill"],
          model: MODEL,
          // Loading each skill is a turn of its own before the answer, so
          // 1 turn was never enough: Claude spent it loading the skill.
          maxTurns: REGENERATE_MAX_TURNS,
        },
      })) {
        if (message.type === "result") {
          // Cost counts whether or not the attempt produced usable text.
          costUsd += message.total_cost_usd ?? 0;
          if (message.subtype === "success" && !message.is_error) resultText = message.result;
        }
      }
    } catch (err) {
      if (!resultText) {
        lastIssue = `Claude's session ended early: ${err instanceof Error ? err.message : String(err)}`;
        continue;
      }
    }

    if (!resultText) {
      lastIssue = "Claude returned no content.";
      continue;
    }

    if (!isEmail) {
      const text = resultText.trim();
      const max = maxCharsFor(target)!;
      if (text.length <= max) {
        return { ok: true, content: text, costUsd };
      }
      lastIssue = `Message is ${text.length - max} characters over the ${max}-character limit.`;
      continue;
    }

    try {
      const parsed = JSON.parse(resultText.trim());
      const subjectOk = typeof parsed.subject === "string" && parsed.subject.length <= EMAIL_SUBJECT_MAX_CHARS;
      const bodyOk = typeof parsed.body === "string" && parsed.body.length <= EMAIL_BODY_MAX_CHARS;
      const noteOk = typeof parsed.personalization_note === "string" && parsed.personalization_note.length > 0;

      if (subjectOk && bodyOk && noteOk) {
        return { ok: true, content: parsed, costUsd };
      }
      lastIssue = !subjectOk
        ? `Subject exceeds ${EMAIL_SUBJECT_MAX_CHARS} characters.`
        : !bodyOk
          ? `Body exceeds ${EMAIL_BODY_MAX_CHARS} characters.`
          : "Missing personalization_note.";
    } catch {
      lastIssue = "Response wasn't valid JSON.";
    }
  }

  return { ok: false, reason: lastIssue ?? "Regeneration failed after retries.", costUsd };
}
