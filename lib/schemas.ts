import { z } from "zod";
import {
  EMAIL_BODY_MAX_CHARS,
  EMAIL_SUBJECT_MAX_CHARS,
  LINKEDIN_MESSAGE_MAX_CHARS,
} from "./agent-config";
import { isIsoCountryCode } from "./countries";

/**
 * Every structured object the agent produces is validated against one of
 * these before it's written to Supabase — never trusted from the model's
 * output alone. See artifact/design.md Section 2 (Principle 1/2).
 */

/**
 * Claude interprets the free-text objective; everything downstream of
 * this object is deterministic code. Headcount and countries are
 * structured (not prose) because discovery filters and the pre-scrape
 * checks are computed from them — see the icp-refinement skill.
 */
export const RefinedIcpSchema = z
  .object({
    target_company_type: z.string().min(1),
    industries: z.array(z.string()),
    geography: z.array(z.string()),
    headcount_min: z.number().int().nonnegative().nullable(),
    headcount_max: z.number().int().positive().nullable(),
    country_codes: z.array(
      z
        .string()
        .trim()
        .toUpperCase()
        .refine(isIsoCountryCode, {
          message: 'must be an ISO 3166-1 alpha-2 country code (e.g. "US", and "GB" — not "UK" — for the United Kingdom)',
        })
    ),
    buyer_persona: z.string(),
    business_problem: z.string(),
    hard_filters: z.array(z.string()),
    soft_preferences: z.array(z.string()),
    disqualifiers: z.array(z.string()),
    assumptions: z.array(z.string()).default([]),
  })
  .refine((icp) => icp.headcount_min === null || icp.headcount_max === null || icp.headcount_min <= icp.headcount_max, {
    message: "headcount_min must not exceed headcount_max",
    path: ["headcount_min"],
  });
export type RefinedIcp = z.infer<typeof RefinedIcpSchema>;

export const ToolLimitsSchema = z.object({
  max_candidates: z.number().int().positive(),
  first_pass_candidates: z.number().int().positive(),
  max_discovery_passes: z.number().int().positive(),
  max_scrapes: z.number().int().positive(),
  max_qualified_leads: z.number().int().positive(),
  max_agent_turns: z.number().int().positive(),
});
export type ToolLimits = z.infer<typeof ToolLimitsSchema>;

export const QualificationResultSchema = z.object({
  company_name: z.string().min(1),
  company_domain: z.string().min(1),
  linkedin_url: z
    .string()
    .url()
    .refine((u) => /^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(u), "must be a linkedin.com URL")
    .nullable()
    .optional(),
  qualification_status: z.enum(["qualified", "not_qualified", "needs_review"]),
  confidence: z.number().min(0).max(1),
  fit_reasons: z.array(z.string()),
  concerns: z.array(z.string()),
  source_urls: z.array(z.string()),
  source_summary: z.string(),
});
export type QualificationResult = z.infer<typeof QualificationResultSchema>;

export const EmailStepSchema = z.object({
  subject: z.string().min(1).max(EMAIL_SUBJECT_MAX_CHARS),
  body: z.string().min(1).max(EMAIL_BODY_MAX_CHARS),
  personalization_note: z.string().min(1),
});
export type EmailStep = z.infer<typeof EmailStepSchema>;

export const OutreachSequenceSchema = z
  .array(EmailStepSchema)
  .length(3, "Outreach sequence must have exactly 3 email steps");
export type OutreachSequence = z.infer<typeof OutreachSequenceSchema>;

export const LinkedinMessageSchema = z.string().min(1).max(LINKEDIN_MESSAGE_MAX_CHARS);

/** The four independently-regeneratable pieces of a lead's outreach. */
export const RegenerateTargetSchema = z.enum([
  "email_1",
  "email_2",
  "email_3",
  "linkedin_message",
]);
export type RegenerateTarget = z.infer<typeof RegenerateTargetSchema>;

/** Body shape for PATCH /api/leads/:id — a human edit. */
export const LeadEditSchema = z.object({
  outreach_sequence: OutreachSequenceSchema.optional(),
  linkedin_message: LinkedinMessageSchema.optional(),
});
export type LeadEdit = z.infer<typeof LeadEditSchema>;

/** Body shape for POST /api/leads/:id/regenerate-outreach. */
export const RegenerateRequestSchema = z.object({
  target: RegenerateTargetSchema,
  feedback: z.string().min(1).max(500),
});
export type RegenerateRequest = z.infer<typeof RegenerateRequestSchema>;

/** Body shape for POST /api/runs. */
export const CreateRunSchema = z.object({
  objective: z.string().min(10, "Tell Hound a bit more about who you're looking for."),
  idempotency_key: z.string().uuid(),
});
export type CreateRunInput = z.infer<typeof CreateRunSchema>;
