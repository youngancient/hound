"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CopyButton } from "./CopyButton";
import { Spinner } from "./Spinner";

type EmailStep = { subject: string; body: string; personalization_note: string };
type RegenerateTarget = "email_1" | "email_2" | "email_3" | "linkedin_message";

const TARGET_TITLE: Record<RegenerateTarget, string> = {
  email_1: "Email 1",
  email_2: "Email 2",
  email_3: "Email 3",
  linkedin_message: "LinkedIn message",
};

/**
 * Editable, not just copy-ready (design.md Section 1/frontend-design.md
 * screen 5). Autosaves each field on blur via PATCH /api/leads/:id — the
 * client never writes to `leads` directly, this goes through that one
 * validated route. Regenerate has no click cap (design.md Section 1, the
 * Flow-precedent decision) and protects the existing draft on failure.
 */
export function OutreachEditor({
  leadId,
  initialSequence,
  initialLinkedinMessage,
  editedBy,
}: {
  leadId: string;
  initialSequence: [EmailStep, EmailStep, EmailStep] | null;
  initialLinkedinMessage: string | null;
  editedBy: string | null;
}) {
  const [sequence, setSequence] = useState<[EmailStep, EmailStep, EmailStep]>(
    initialSequence ?? [
      { subject: "", body: "", personalization_note: "" },
      { subject: "", body: "", personalization_note: "" },
      { subject: "", body: "", personalization_note: "" },
    ]
  );
  const [linkedinMessage, setLinkedinMessage] = useState(initialLinkedinMessage ?? "");

  async function saveAll(nextSequence: typeof sequence, nextLinkedin: string) {
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outreach_sequence: nextSequence, linkedin_message: nextLinkedin }),
    });
    if (res.ok) toast.success("Saved.");
    else toast.error("Couldn't save that edit — try again.");
  }

  function updateEmailField(index: 0 | 1 | 2, field: "subject" | "body", value: string) {
    setSequence((prev) => {
      const next = [...prev] as typeof prev;
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {editedBy && <p className="text-xs text-ash">Edited by a teammate</p>}

      {([0, 1, 2] as const).map((index) => (
        <OutreachSection
          key={index}
          title={TARGET_TITLE[`email_${(index + 1) as 1 | 2 | 3}`]}
          leadId={leadId}
          target={`email_${(index + 1) as 1 | 2 | 3}`}
          copyText={`${sequence[index].subject}\n\n${sequence[index].body}`}
          onRegenerated={(content) => {
            const parsed = content as EmailStep;
            setSequence((prev) => {
              const next = [...prev] as typeof prev;
              next[index] = parsed;
              return next;
            });
          }}
        >
          <input
            value={sequence[index].subject}
            onChange={(e) => updateEmailField(index, "subject", e.target.value)}
            onBlur={() => saveAll(sequence, linkedinMessage)}
            placeholder="Subject"
            className="rounded-sm border border-rule bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-accent"
          />
          <textarea
            value={sequence[index].body}
            onChange={(e) => updateEmailField(index, "body", e.target.value)}
            onBlur={() => saveAll(sequence, linkedinMessage)}
            rows={5}
            className="rounded-sm border border-rule bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-accent"
          />
          {sequence[index].personalization_note && (
            <p className="text-xs text-ash">Why this angle: {sequence[index].personalization_note}</p>
          )}
        </OutreachSection>
      ))}

      <OutreachSection
        title="LinkedIn message"
        leadId={leadId}
        target="linkedin_message"
        copyText={linkedinMessage}
        onRegenerated={(content) => setLinkedinMessage(content as string)}
      >
        <textarea
          value={linkedinMessage}
          onChange={(e) => setLinkedinMessage(e.target.value)}
          onBlur={() => saveAll(sequence, linkedinMessage)}
          rows={3}
          className="rounded-sm border border-rule bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-accent"
        />
      </OutreachSection>
    </div>
  );
}

function OutreachSection({
  title,
  leadId,
  target,
  copyText,
  onRegenerated,
  children,
}: {
  title: string;
  leadId: string;
  target: RegenerateTarget;
  copyText: string;
  onRegenerated: (content: unknown) => void;
  children: React.ReactNode;
}) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [regenerating, setRegenerating] = useState(false);

  async function handleRegenerate() {
    if (!feedback.trim()) return;
    setRegenerating(true);
    const res = await fetch(`/api/leads/${leadId}/regenerate-outreach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, feedback }),
    });
    setRegenerating(false);

    if (!res.ok) {
      toast.error("Couldn't regenerate that — try again.");
      return;
    }

    const { content } = await res.json();
    onRegenerated(content);
    toast.success("Draft updated.");
    setShowFeedback(false);
    setFeedback("");
  }

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-rule p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <div className="flex items-center gap-3">
          <CopyButton text={copyText} />
          <button
            type="button"
            onClick={() => setShowFeedback((v) => !v)}
            className="cursor-pointer text-xs text-ash hover:text-ink"
          >
            Regenerate
          </button>
        </div>
      </div>

      {children}

      {showFeedback && (
        <div className="flex flex-col gap-2 border-t border-rule pt-3">
          <label className="text-xs text-ash">What should change?</label>
          <input
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="shorter, mention their recent Series A…"
            className="rounded-sm border border-rule bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-accent"
          />
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={regenerating || !feedback.trim()}
            className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-sm bg-accent px-3 py-1.5 text-xs font-medium text-paper disabled:cursor-not-allowed disabled:opacity-50"
          >
            {regenerating && <Spinner className="h-3 w-3" />}
            {regenerating ? "Regenerating" : "Regenerate"}
          </button>
        </div>
      )}
    </div>
  );
}
