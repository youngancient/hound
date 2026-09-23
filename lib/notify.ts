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
      subject: `Your search is done: ${params.qualifiedCount} good fit${params.qualifiedCount === 1 ? "" : "s"}`,
      htmlContent: `<p>Your search for "${params.objective}" is done. Hound found ${params.qualifiedCount} good fit${params.qualifiedCount === 1 ? "" : "s"}.</p><p><a href="${appUrl}/searches/${params.runId}">${appUrl}/searches/${params.runId}</a></p>`,
    });
  } catch (err) {
    console.error("notifySearchComplete failed:", err);
  }
}
