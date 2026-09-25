import "server-only";
import { brevo, brevoSender } from "./brevo";

/**
 * Best-effort completion email to whoever started the search — never
 * blocks, never throws into the run's own status handling. No email on
 * failure (that's Discord's job) — see artifact/design.md Section 8.
 */
export async function notifySearchComplete(params: {
  toEmail: string;
  runId: string;
  objective: string;
  qualifiedCount: number;
}): Promise<void> {
  try {
    const appUrl = process.env.APP_URL;
    if (!appUrl) throw new Error("Missing APP_URL env var");

    await brevo().transactionalEmails.sendTransacEmail({
      sender: brevoSender(),
      to: [{ email: params.toEmail }],
      subject: `Your search is done: ${params.qualifiedCount} lead${params.qualifiedCount === 1 ? "" : "s"}`,
      htmlContent: `<p>Your search for "${escapeHtml(params.objective)}" is done. Hound found ${params.qualifiedCount} lead${params.qualifiedCount === 1 ? "" : "s"}.</p><p><a href="${appUrl}/searches/${params.runId}">${appUrl}/searches/${params.runId}</a></p>`,
    });
  } catch (err) {
    console.error("notifySearchComplete failed:", err);
  }
}

/**
 * Best-effort email when a search that asked for an ICP review is ready
 * for it. Sent after the search is already waiting, so a failed email
 * never affects the search; the page shows the same thing.
 */
export async function notifyReviewReady(params: { toEmail: string; runId: string; objective: string }): Promise<void> {
  try {
    const appUrl = process.env.APP_URL;
    if (!appUrl) throw new Error("Missing APP_URL env var");

    await brevo().transactionalEmails.sendTransacEmail({
      sender: brevoSender(),
      to: [{ email: params.toEmail }],
      subject: "Check how Hound read your request",
      htmlContent: `<p>Hound has read your request "${escapeHtml(params.objective)}" and is waiting for you to check it before it searches. Change anything that's off, then start the search. It'll wait 24 hours.</p><p><a href="${appUrl}/searches/${params.runId}">${appUrl}/searches/${params.runId}</a></p>`,
    });
  } catch (err) {
    console.error("notifyReviewReady failed:", err);
  }
}

/** The request is the user's own text: shown as typed, never read as HTML. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
