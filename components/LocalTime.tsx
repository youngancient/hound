"use client";

import { useEffect, useState } from "react";
import { formatDateTime, formatRelative } from "@/lib/time";

/**
 * A date in the viewer's own time zone. The server doesn't know it, so the
 * first render uses UTC (matching on server and client, no hydration
 * mismatch) and the local time takes over right after mount. Relative
 * times ("5min ago") refresh every minute.
 */
export function LocalTime({ iso, mode = "absolute" }: { iso: string; mode?: "absolute" | "relative" }) {
  const date = new Date(iso);
  const [local, setLocal] = useState<{ now: Date } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- switching to the browser's time zone after hydration
    setLocal({ now: new Date() });
    if (mode !== "relative") return;
    const id = setInterval(() => setLocal({ now: new Date() }), 60_000);
    return () => clearInterval(id);
  }, [mode]);

  const now = local?.now ?? date;
  const timeZone = local ? undefined : "UTC";
  const text = mode === "relative" && local ? formatRelative(date, now, timeZone) : formatDateTime(date, now, timeZone);

  return (
    <time dateTime={iso} title={local ? formatDateTime(date, now) : undefined}>
      {text}
    </time>
  );
}
