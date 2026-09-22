"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Simple poll-and-refresh in place of a Supabase Realtime subscription —
 * design.md Section 1 says "polls/subscribes"; polling is the simpler of
 * the two and enough at this scale. Only runs while `active`, so a
 * finished search stops refreshing itself.
 */
export function AutoRefresh({ active, intervalMs = 3000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, router]);

  return null;
}
