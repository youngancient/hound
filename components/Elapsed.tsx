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
 *
 * Time spent waiting for an ICP review isn't Hound's working time: while
 * waiting, the timer stops where Hound stopped (`reviewStartedAt`), and
 * afterwards the wait (`reviewWaitMs`) is left out.
 */
export function Elapsed({
  status,
  attemptStartedAt,
  priorAttemptsMs,
  completedAt,
  reviewStartedAt = null,
  reviewWaitMs = 0,
  serverNow,
}: {
  status: string;
  attemptStartedAt: string;
  priorAttemptsMs: number;
  completedAt: string | null;
  reviewStartedAt?: string | null;
  reviewWaitMs?: number;
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
  const stoppedAt = status === "awaiting_review" ? reviewStartedAt : completedAt;
  const end = stoppedAt ? new Date(stoppedAt).getTime() : now;
  const thisAttempt = Math.max(0, end - start - (status === "awaiting_review" ? 0 : reviewWaitMs));

  // Running and stopped show this attempt; a finished search shows its
  // total across attempts (excluding the time it sat failed).
  const ms = running || status === "failed" ? thisAttempt : priorAttemptsMs + thisAttempt;
  return <span className="tabular-nums">{formatDuration(ms)}</span>;
}
