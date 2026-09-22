import {
  EMAIL_BODY_MAX_CHARS,
  EMAIL_SUBJECT_MAX_CHARS,
  LINKEDIN_MESSAGE_MAX_CHARS,
  MAX_FORMAT_RETRY_ATTEMPTS,
} from "../agent-config";

/**
 * Bounded automatic retry for char-limit violations, distinct from a
 * structural schema failure (design.md Section 5's retry table + the
 * "borrowed from Flow's MAX_CHANNEL_ADAPT_ATTEMPTS" note). Scoped to one
 * pipeline run via the caller's closure — a fresh Map per `buildHoundTools`
 * call, so attempt counts never leak across runs.
 */
export function createFormatRetryTracker() {
  const attempts = new Map<string, number>();

  function keyFor(companyDomain: string, field: string) {
    return `${companyDomain}:${field}`;
  }

  return {
    /**
     * Checks one field's length. Returns `null` when it's within limits.
     * Otherwise returns either a retryable violation (ask Claude to
     * shorten and call save_lead again) or a final one (attempts
     * exhausted — caller should accept the content anyway and flag a
     * concern, per design.md's main-pipeline fallback).
     */
    check(
      companyDomain: string,
      field: "email_1_subject" | "email_1_body" | "email_2_subject" | "email_2_body" | "email_3_subject" | "email_3_body" | "linkedin_message",
      value: string
    ): { violation: false } | { violation: true; final: boolean; message: string } {
      const max = field === "linkedin_message" ? LINKEDIN_MESSAGE_MAX_CHARS : field.endsWith("subject") ? EMAIL_SUBJECT_MAX_CHARS : EMAIL_BODY_MAX_CHARS;

      if (value.length <= max) return { violation: false };

      const key = keyFor(companyDomain, field);
      const count = (attempts.get(key) ?? 0) + 1;
      attempts.set(key, count);

      const over = value.length - max;
      if (count < MAX_FORMAT_RETRY_ATTEMPTS) {
        return {
          violation: true,
          final: false,
          message: `${field} is ${over} characters over the ${max}-character limit — shorten it and call save_lead again.`,
        };
      }

      return {
        violation: true,
        final: true,
        message: `${field} is still over the ${max}-character limit after ${MAX_FORMAT_RETRY_ATTEMPTS} attempts — saved anyway, flagged for manual shortening.`,
      };
    },
  };
}

export type FormatRetryTracker = ReturnType<typeof createFormatRetryTracker>;
