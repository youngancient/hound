/**
 * Client-side helpers for an expired login. API routes answer 401 when the
 * session has ended; the UI says so plainly and offers the way back.
 */
export const SESSION_ENDED_MESSAGE = "You've been logged out. Log in again to continue.";

/** Only same-site paths, so `?next=` can't send someone to another website after login. */
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

export function loginUrlFor(currentPath: string): string {
  return `/login?next=${encodeURIComponent(safeNextPath(currentPath))}`;
}
