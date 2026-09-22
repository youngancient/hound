import "server-only";
import { BrevoClient } from "@getbrevo/brevo";

let client: BrevoClient | null = null;

/** Shared Brevo client for the completion email. See artifact/design.md Section 8. */
export function brevo(): BrevoClient {
  if (client) return client;
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("Missing BREVO_API_KEY env var");
  client = new BrevoClient({ apiKey });
  return client;
}

export function brevoSender(): { email: string; name: string } {
  const email = process.env.BREVO_SENDER_EMAIL;
  const name = process.env.BREVO_SENDER_NAME ?? "Hound";
  if (!email) throw new Error("Missing BREVO_SENDER_EMAIL env var. It must be a verified sender in Brevo.");
  return { email, name };
}
