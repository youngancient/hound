"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/time";

/**
 * A search's timer. The only state is "now", ticking once a second while
 * the search runs; the duration itself is always derived from times the
 * database stores (the attempt's start, earlier attempts' total, and the
 * finish), so leaving and coming back, a sleeping laptop or a reload all
 * show the right number. `serverNow` corrects for a wrong clock on the
 * viewer's machine, and makes the first render match the server's.
 */
export function Elapsed({
  status,
  attemptStartedAt,
  priorAttemptsMs,
  completedAt,
  serverNow,
}: {
  status: string;
  attemptStartedAt: string;
  priorAttemptsMs: number;
  completedAt: string | null;
  serverNow: string;
}) {
  const running = status === "pending" || status === "running";
  const [now, setNow] = useState(() => new Date(serverNow).getTime());

  useEffect(() => {
    if (!running) return;
    const clockOffset = new Date(serverNow).getTime() - Date.now();
    const tick = () => setNow(Date.now() + clockOffset);
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running, serverNow]);

  const start = new Date(attemptStartedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : now;
  const thisAttempt = end - start;

  // Running and stopped show this attempt; a finished search shows its
  // total across attempts (excluding the time it sat failed).
  const ms = running || status === "failed" ? thisAttempt : priorAttemptsMs + thisAttempt;
  return <span className="tabular-nums">{formatDuration(ms)}</span>;
}
