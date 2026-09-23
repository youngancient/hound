"use client";

import { useEffect, useId, useState } from "react";
import { toast } from "sonner";
import { CopyButton } from "./CopyButton";
import { Spinner } from "./Spinner";
import { SESSION_ENDED_MESSAGE, loginUrlFor } from "@/lib/session";
import { EMAIL_BODY_MAX_CHARS, EMAIL_SUBJECT_MAX_CHARS, LINKEDIN_MESSAGE_MAX_CHARS } from "@/lib/agent-config";

type EmailStep = { subject: string; body: string; personalization_note: string };
type Sequence = [EmailStep, EmailStep, EmailStep];
type SectionKey = "email_1" | "email_2" | "email_3" | "linkedin_message";
type SaveStatus = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

const SECTION_TITLE: Record<SectionKey, string> = {
  email_1: "Email 1",
  email_2: "Email 2",
  email_3: "Email 3",
  linkedin_message: "LinkedIn message",
};

const EMAIL_KEYS = ["email_1", "email_2", "email_3"] as const;

/**
 * Editable outreach drafts. Autosaves (the standard pattern for draft text,
 * as in Gmail drafts) via PATCH /api/leads/:id, but only when a field
 * actually changed, and shows the save state next to each section instead
 * of a toast: "Saving…", "Saved", or what went wrong with a retry. The
 * client never writes to `leads` directly. Rewriting with feedback has no
 * click cap (design.md Section 1) and keeps the existing draft on failure.
 */
export function OutreachEditor({
  leadId,
  initialSequence,
  initialLinkedinMessage,
  initialEditedLabel,
  readOnly,
  ownerEmail,
}: {
  leadId: string;
  initialSequence: Sequence;
  initialLinkedinMessage: string;
  /** "Edited by you" / "Edited by {email}", or null if never edited. */
  initialEditedLabel: string | null;
  /** Viewing someone else's search: read and copy only. */
  readOnly: boolean;
  ownerEmail: string;
}) {
  const [editedLabel, setEditedLabel] = useState(initialEditedLabel);
  const [sequence, setSequence] = useState<Sequence>(initialSequence);
  const [linkedinMessage, setLinkedinMessage] = useState(initialLinkedinMessage);
  const [status, setStatus] = useState<Record<SectionKey, SaveStatus>>({
    email_1: { kind: "idle" },
    email_2: { kind: "idle" },
    email_3: { kind: "idle" },
    linkedin_message: { kind: "idle" },
  });
  // What the server has now: the baseline for "did anything change?".
  const [saved, setSaved] = useState<{ sequence: Sequence; linkedinMessage: string }>({
    sequence: initialSequence,
    linkedinMessage: initialLinkedinMessage,
  });

  const isDirty =
    JSON.stringify(sequence) !== JSON.stringify(saved.sequence) ||
    linkedinMessage !== saved.linkedinMessage;
  const isSaving = Object.values(status).some((s) => s.kind === "saving");

  // Closing or reloading the tab with an edit that hasn't saved yet.
  useEffect(() => {
    if (!isDirty && !isSaving) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty, isSaving]);

  function changedSections(nextSequence: Sequence, nextLinkedin: string): SectionKey[] {
    const changed: SectionKey[] = EMAIL_KEYS.filter(
      (_, i) => JSON.stringify(nextSequence[i]) !== JSON.stringify(saved.sequence[i])
    );
    if (nextLinkedin !== saved.linkedinMessage) changed.push("linkedin_message");
    return changed;
  }

  function setSections(keys: SectionKey[], value: SaveStatus) {
    setStatus((prev) => {
      const next = { ...prev };
      for (const key of keys) next[key] = value;
      return next;
    });
  }

  async function save() {
    const snapshot = { sequence, linkedinMessage };
    const changed = changedSections(snapshot.sequence, snapshot.linkedinMessage);
    if (changed.length === 0) return;

    // Every changed section is sent together, so all of them must be valid.
    const problems = changed
      .map((key) => [key, validate(key, snapshot.sequence, snapshot.linkedinMessage)] as const)
      .filter((entry): entry is readonly [SectionKey, string] => entry[1] !== null);
    if (problems.length > 0) {
      const blocked = changed.filter((key) => !problems.some(([p]) => p === key));
      setSections(blocked, { kind: "error", message: "Not saved yet. Fix the section marked in red first." });
      for (const [key, message] of problems) setSections([key], { kind: "error", message });
      return;
    }

    setSections(changed, { kind: "saving" });
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outreach_sequence: snapshot.sequence, linkedin_message: snapshot.linkedinMessage }),
        // Lets the save finish if the blur came from clicking a link away.
        keepalive: true,
      });
      if (res.status === 403) {
        setSections(changed, { kind: "error", message: "Only the person who started this search can edit it." });
        return;
      }
      if (res.status === 401) {
        // Not redirected automatically: that would throw away the edit.
        setSections(changed, { kind: "error", message: "Not saved. You've been logged out, so log in again in another tab, then try again." });
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setSaved(snapshot);
      setSections(changed, { kind: "saved" });
      setEditedLabel("Edited by you");
    } catch {
      setSections(changed, { kind: "error", message: "Not saved." });
    }
  }

  function updateEmailField(index: 0 | 1 | 2, field: "subject" | "body", value: string) {
    setSequence((prev) => {
      const next = [...prev] as Sequence;
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  if (readOnly) {
    return (
      <ReadOnlyOutreach sequence={sequence} linkedinMessage={linkedinMessage} editedLabel={editedLabel} ownerEmail={ownerEmail} />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {editedLabel && <p className="text-xs text-ash">{editedLabel}</p>}

      {EMAIL_KEYS.map((key, index) => (
        <OutreachSection
          key={key}
          section={key}
          leadId={leadId}
          status={status[key]}
          onRetry={save}
          copyText={`${sequence[index].subject}\n\n${sequence[index].body}`}
          onRegenerated={(content) => {
            const step = content as EmailStep;
            // The rewrite is already saved on the server.
            setSaved((prev) => ({
              ...prev,
              sequence: prev.sequence.map((s, i) => (i === index ? step : s)) as Sequence,
            }));
            setSequence((prev) => prev.map((s, i) => (i === index ? step : s)) as Sequence);
            setSections([key], { kind: "saved" });
            setEditedLabel("Edited by you");
          }}
        >
          <input
            value={sequence[index].subject}
            onChange={(e) => updateEmailField(index as 0 | 1 | 2, "subject", e.target.value)}
            onBlur={save}
            placeholder="Subject"
            aria-label={`${SECTION_TITLE[key]} subject line`}
            className="rounded-sm border border-rule bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-accent"
          />
          <textarea
            value={sequence[index].body}
            onChange={(e) => updateEmailField(index as 0 | 1 | 2, "body", e.target.value)}
            onBlur={save}
            rows={5}
            aria-label={`${SECTION_TITLE[key]} text`}
            className="rounded-sm border border-rule bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-accent"
          />
          {sequence[index].personalization_note && (
            <p className="text-xs text-ash">Why this angle: {sequence[index].personalization_note}</p>
          )}
        </OutreachSection>
      ))}

      <OutreachSection
        section="linkedin_message"
        leadId={leadId}
        status={status.linkedin_message}
        onRetry={save}
        copyText={linkedinMessage}
        onRegenerated={(content) => {
          setSaved((prev) => ({ ...prev, linkedinMessage: content as string }));
          setLinkedinMessage(content as string);
          setSections(["linkedin_message"], { kind: "saved" });
          setEditedLabel("Edited by you");
        }}
      >
        <textarea
          value={linkedinMessage}
          onChange={(e) => setLinkedinMessage(e.target.value)}
          onBlur={save}
          rows={4}
          aria-label="LinkedIn message text"
          className="rounded-sm border border-rule bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-accent"
        />
      </OutreachSection>
    </div>
  );
}

/** Someone else's search: the drafts as text, with Copy, and who can change them. */
function ReadOnlyOutreach({
  sequence,
  linkedinMessage,
  editedLabel,
  ownerEmail,
}: {
  sequence: Sequence;
  linkedinMessage: string;
  editedLabel: string | null;
  ownerEmail: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ash">
        {ownerEmail} created this search. You can read and copy the outreach, but only they can edit it.
        {editedLabel ? ` ${editedLabel}.` : ""}
      </p>
      {EMAIL_KEYS.map((key, index) => (
        <div key={key} className="flex flex-col gap-2 rounded-sm border border-rule p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium">{SECTION_TITLE[key]}</h3>
            <CopyButton text={`${sequence[index].subject}\n\n${sequence[index].body}`} />
          </div>
          <p className="text-sm font-medium">{sequence[index].subject}</p>
          <p className="whitespace-pre-line text-sm">{sequence[index].body}</p>
          {sequence[index].personalization_note && (
            <p className="text-xs text-ash">Why this angle: {sequence[index].personalization_note}</p>
          )}
        </div>
      ))}
      <div className="flex flex-col gap-2 rounded-sm border border-rule p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium">{SECTION_TITLE.linkedin_message}</h3>
          <CopyButton text={linkedinMessage} />
        </div>
        <p className="whitespace-pre-line text-sm">{linkedinMessage}</p>
      </div>
    </div>
  );
}

/** The same limits the server enforces, checked first so the message can say what to fix. */
function validate(section: SectionKey, sequence: Sequence, linkedinMessage: string): string | null {
  if (section === "linkedin_message") {
    if (!linkedinMessage.trim()) return "The message can't be empty.";
    if (linkedinMessage.length > LINKEDIN_MESSAGE_MAX_CHARS)
      return `Keep it to ${LINKEDIN_MESSAGE_MAX_CHARS} characters. It's ${linkedinMessage.length} now.`;
    return null;
  }
  const step = sequence[EMAIL_KEYS.indexOf(section)];
  if (!step.subject.trim()) return "The subject line can't be empty.";
  if (!step.body.trim()) return "The email can't be empty.";
  if (step.subject.length > EMAIL_SUBJECT_MAX_CHARS)
    return `Keep the subject line to ${EMAIL_SUBJECT_MAX_CHARS} characters. It's ${step.subject.length} now.`;
  if (step.body.length > EMAIL_BODY_MAX_CHARS)
    return `Keep the email to ${EMAIL_BODY_MAX_CHARS.toLocaleString()} characters. It's ${step.body.length.toLocaleString()} now.`;
  return null;
}

function SaveIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status.kind === "idle") return null;
  if (status.kind === "saving") return <span className="text-xs text-ash">Saving…</span>;
  if (status.kind === "saved") return <span className="text-xs text-moss">Saved</span>;
  return (
    <span className="text-xs text-oxblood" role="alert">
      {status.message}{" "}
      {status.message.startsWith("Not saved.") && (
        <button type="button" onClick={onRetry} className="cursor-pointer underline">
          Try again
        </button>
      )}
    </span>
  );
}

function OutreachSection({
  section,
  leadId,
  status,
  onRetry,
  copyText,
  onRegenerated,
  children,
}: {
  section: SectionKey;
  leadId: string;
  status: SaveStatus;
  onRetry: () => void;
  copyText: string;
  onRegenerated: (content: unknown) => void;
  children: React.ReactNode;
}) {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const feedbackId = useId();

  async function handleRegenerate() {
    if (!feedback.trim()) return;
    setRegenerating(true);
    let content: unknown;
    try {
      const res = await fetch(`/api/leads/${leadId}/regenerate-outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: section, feedback }),
      });
      if (res.status === 401) {
        toast.error(SESSION_ENDED_MESSAGE, {
          action: { label: "Log in", onClick: () => window.location.assign(loginUrlFor(window.location.pathname)) },
        });
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      ({ content } = (await res.json()) as { content: unknown });
    } catch {
      toast.error("We couldn't rewrite that. Please try again.");
      return;
    } finally {
      setRegenerating(false);
    }

    onRegenerated(content);
    toast.success("Rewritten. Take a look.");
    setShowFeedback(false);
    setFeedback("");
  }

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-rule p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h3 className="text-sm font-medium">{SECTION_TITLE[section]}</h3>
          <span aria-live="polite">
            <SaveIndicator status={status} onRetry={onRetry} />
          </span>
        </div>
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
          <label htmlFor={feedbackId} className="text-xs text-ash">
            What should change?
          </label>
          <input
            id={feedbackId}
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
