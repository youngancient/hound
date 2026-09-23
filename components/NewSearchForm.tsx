"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Spinner } from "./Spinner";

const EXAMPLE = "Find 10 US B2B SaaS companies with 10 to 100 employees that may need AI automation support";

/**
 * idempotency_key is generated once, when the form renders — not per
 * keystroke, not per click — so a double-click or a network retry sends
 * the same key twice and the server treats it as one search
 * (design.md Section 10).
 */
export function NewSearchForm({ prefill }: { prefill?: string }) {
  const router = useRouter();
  const [objective, setObjective] = useState(prefill ?? "");
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective, idempotency_key: idempotencyKey }),
    });

    if (!res.ok) {
      setLoading(false);
      toast.error("We couldn't start your search. Please try again.");
      return;
    }

    const { id } = await res.json();
    router.push(`/searches/${id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="objective" className="text-sm text-ash">
          Who are you looking for?
        </label>
        <textarea
          id="objective"
          required
          minLength={10}
          rows={4}
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder={EXAMPLE}
          className="rounded-sm border border-rule bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-fit cursor-pointer items-center justify-center gap-1.5 rounded-sm bg-accent px-4 py-2 text-sm font-medium text-paper disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading && <Spinner />}
        {loading ? "Starting" : "Start a new search"}
      </button>
    </form>
  );
}
