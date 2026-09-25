"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Spinner } from "./Spinner";
import { LocalTime } from "./LocalTime";
import { SESSION_ENDED_MESSAGE, loginUrlFor } from "@/lib/session";
import type { PreviousSearch } from "@/lib/schemas";
import { normalizeQuery } from "@/lib/discovery";

const EXAMPLE = "Find 10 US B2B SaaS companies with 10 to 100 employees that may need AI automation support";

/**
 * idempotency_key is generated once, when the form renders — not per
 * keystroke, not per click — so a double-click or a network retry sends
 * the same key twice and the server treats it as one search
 * (design.md Section 10).
 *
 * If the same request was searched before, the server says so instead of
 * starting a search, and a dialog offers that search or a new one.
 * `allowRepeat` skips the check on a search's own page, where the user has
 * already chosen to search again, but only while the text is still that
 * search's request (`prefill`): a reworded one is checked like any other.
 */
export function NewSearchForm({
  prefill,
  examples,
  allowRepeat = false,
}: {
  prefill?: string;
  examples?: string[];
  allowRepeat?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const [objective, setObjective] = useState(prefill ?? "");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [loading, setLoading] = useState(false);
  const [reviewIcp, setReviewIcp] = useState(false);
  const reviewId = useId();
  const [repeat, setRepeat] = useState<(PreviousSearch & { mine: boolean }) | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (repeat) dialogRef.current?.showModal();
  }, [repeat]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const unchanged = prefill !== undefined && normalizeQuery(objective) === normalizeQuery(prefill);
    await startSearch(allowRepeat && unchanged);
  }

  async function startSearch(rerun: boolean) {
    setLoading(true);

    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective, idempotency_key: idempotencyKey, rerun, review_icp: reviewIcp }),
      });

      if (res.status === 401) {
        setLoading(false);
        toast.error(SESSION_ENDED_MESSAGE, {
          action: { label: "Log in", onClick: () => router.push(loginUrlFor(window.location.pathname)) },
        });
        return;
      }
      if (res.status === 409) {
        const body = (await res.json()) as { repeat: PreviousSearch & { mine: boolean } };
        setLoading(false);
        setRepeat(body.repeat);
        return;
      }
      if (!res.ok) throw new Error(String(res.status));

      const { id } = (await res.json()) as { id: string };
      router.push(`/searches/${id}`);
    } catch {
      // Network failure or an unexpected response: the button must come back.
      setLoading(false);
      toast.error("We couldn't start your search. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        {/* On the home page the heading already asks this, so the label is for screen readers only. */}
        <label htmlFor="objective" className={examples ? "sr-only" : "text-sm text-ash"}>
          Who are you looking for?
        </label>
        <textarea
          id="objective"
          required
          minLength={10}
          ref={textareaRef}
          rows={4}
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder={EXAMPLE}
          className="rounded-sm border border-rule bg-transparent px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
        />
      </div>
      {examples && examples.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-ash">Or start from an example:</p>
          <ul className="flex flex-wrap gap-2">
            {examples.map((example) => (
              <li key={example}>
                <button
                  type="button"
                  onClick={() => {
                    setObjective(example);
                    textareaRef.current?.focus();
                  }}
                  className="cursor-pointer rounded-sm border border-rule px-2.5 py-1 text-left text-xs text-ash hover:border-accent hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <label htmlFor={reviewId} className="flex w-fit cursor-pointer items-start gap-2.5 text-sm">
        <input
          id={reviewId}
          type="checkbox"
          checked={reviewIcp}
          onChange={(e) => setReviewIcp(e.target.checked)}
          className="mt-0.5 accent-[var(--accent)]"
        />
        <span className="flex flex-col gap-0.5">
          <span>Let me check how Hound reads my request before it searches</span>
          <span className="text-xs text-ash">Hound waits for you, then searches with your version. It emails you when it&apos;s ready.</span>
        </span>
      </label>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-fit cursor-pointer items-center justify-center gap-1.5 rounded-sm bg-accent px-4 py-2 text-sm font-medium text-paper disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading && <Spinner />}
        {loading ? "Starting search" : "Start search"}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={() => setRepeat(null)}
        onClick={(e) => {
          // A click on the backdrop (the dialog element itself) closes it.
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-sm border border-rule bg-paper p-0 text-ink backdrop:bg-ink/40"
      >
        {repeat && (
          <div className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-1">
              <h2 id={titleId} className="text-base font-medium">
                {repeat.mine ? "You've searched this before" : "This has been searched before"}
              </h2>
              <p className="text-sm text-ash">
                {repeat.mine ? "You" : (repeat.created_by_email ?? "A teammate")} searched for this exact request{" "}
                <LocalTime iso={repeat.created_at} mode="relative" />. {describeOutcome(repeat)}
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  dialogRef.current?.close();
                  void startSearch(true);
                }}
                className="cursor-pointer rounded-sm px-3 py-1.5 text-sm text-ash hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Search again
              </button>
              <button
                type="button"
                onClick={() => {
                  dialogRef.current?.close();
                  router.push(`/searches/${repeat.id}`);
                }}
                className="cursor-pointer rounded-sm bg-accent px-4 py-1.5 text-sm font-medium text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                View that search
              </button>
            </div>
          </div>
        )}
      </dialog>
    </form>
  );
}

function describeOutcome(search: PreviousSearch): string {
  const leads = `${search.qualified_leads} lead${search.qualified_leads === 1 ? "" : "s"}`;
  switch (search.status) {
    case "pending":
    case "running":
      return "It's still searching.";
    case "awaiting_review":
      return "It's waiting for its request to be checked.";
    case "completed":
      return `It found ${leads}.`;
    case "failed":
      return search.qualified_leads > 0 ? `It didn't finish, but found ${leads} first.` : "It didn't finish.";
    case "declined":
      return "Hound asked for a clearer request.";
  }
}
