"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Spinner } from "./Spinner";
import { SESSION_ENDED_MESSAGE, loginUrlFor } from "@/lib/session";

/**
 * Continues a failed search as the same search. The button stays in its
 * loading state until the refreshed page (now running, progress row at
 * "Understanding the request") has actually rendered, so there's no gap
 * where it looks like nothing happened or can be clicked twice.
 */
export function ContinueSearchButton({ runId }: { runId: string }) {
  const router = useRouter();
  const [requesting, setRequesting] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const loading = requesting || refreshing;

  async function handleContinue() {
    setRequesting(true);
    try {
      const res = await fetch(`/api/runs/${runId}/continue`, { method: "POST" });
      if (res.status === 401) {
        toast.error(SESSION_ENDED_MESSAGE, {
          action: { label: "Log in", onClick: () => router.push(loginUrlFor(window.location.pathname)) },
        });
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        toast.error(body?.error ?? "We couldn't continue your search. Please try again.");
        return;
      }
      startRefresh(() => router.refresh());
    } catch {
      toast.error("We couldn't continue your search. Please try again.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleContinue}
      disabled={loading}
      className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-sm bg-accent px-4 py-2 text-sm font-medium text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
    >
      {loading && <Spinner />}
      {loading ? "Continuing search" : "Continue search"}
    </button>
  );
}
