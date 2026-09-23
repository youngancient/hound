/**
 * Time formatting shared by the timer and dates. Pure, no imports, so it's
 * unit-tested directly (tests/time.test.ts) and safe in client components.
 */

/** 45s, 2min14s, 3min0s, 1h3min5s. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h${m}min${s}s`;
  if (m > 0) return `${m}min${s}s`;
  return `${s}s`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "Sep 23, 14:05", with the year only when it isn't this year ("Dec 31, 2025, 23:00"). In the
 * viewer's time zone unless one is given. Month names come from a fixed
 * list: browsers disagree on abbreviations ("Sep" vs "Sept").
 */
export function formatDateTime(date: Date, now: Date, timeZone?: string): string {
  const parts = (d: Date) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        timeZone,
      })
        .formatToParts(d)
        .map((x) => [x.type, x.value])
    );
    return p as Record<string, string>;
  };
  const d = parts(date);
  const sameYear = d.year === parts(now).year;
  return `${MONTHS[Number(d.month) - 1]} ${Number(d.day)}${sameYear ? "" : `, ${d.year}`}, ${d.hour}:${d.minute}`;
}

/** "just now", "5min ago", "2h ago", then a date: recent searches read naturally, older ones stay exact. */
export function formatRelative(date: Date, now: Date, timeZone?: string): string {
  const ago = now.getTime() - date.getTime();
  if (ago < 60_000) return "just now";
  if (ago < 3_600_000) return `${Math.floor(ago / 60_000)}min ago`;
  if (ago < 86_400_000) return `${Math.floor(ago / 3_600_000)}h ago`;
  return formatDateTime(date, now, timeZone);
}
