"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Spinner } from "./Spinner";
import { SESSION_ENDED_MESSAGE, loginUrlFor } from "@/lib/session";

const EXAMPLE = "Find 10 US B2B SaaS companies with 10 to 100 employees that may need AI automation support";

/**
 * idempotency_key is generated once, when the form renders — not per
 * keystroke, not per click — so a double-click or a network retry sends
 * the same key twice and the server treats it as one search
 * (design.md Section 10).
 */
export function NewSearchForm({ prefill, examples }: { prefill?: string; examples?: string[] }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const [objective, setObjective] = useState(prefill ?? "");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective, idempotency_key: idempotencyKey }),
      });

      if (res.status === 401) {
        setLoading(false);
        toast.error(SESSION_ENDED_MESSAGE, {
          action: { label: "Log in", onClick: () => router.push(loginUrlFor(window.location.pathname)) },
        });
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
      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-fit cursor-pointer items-center justify-center gap-1.5 rounded-sm bg-accent px-4 py-2 text-sm font-medium text-paper disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading && <Spinner />}
        {loading ? "Starting search" : "Start search"}
      </button>
    </form>
  );
}
