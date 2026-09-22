import "server-only";

/**
 * Core env vars the app cannot function without. Deliberately excludes
 * vars that are optional by design and already handled gracefully
 * elsewhere: DISCORD_BOT_TOKEN/DISCORD_CHANNEL_ID (the notifier no-ops if
 * either is unset — a Discord outage or missing config must never fail a
 * search), BREVO_API_KEY (same — the completion email is best-effort).
 * See artifact/design.md Section 8.
 */
const REQUIRED_ENV_VARS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ANTHROPIC_API_KEY",
  "APIFY_API_TOKEN",
  "FIRECRAWL_API_KEY",
  "INNGEST_EVENT_KEY",
  "INNGEST_SIGNING_KEY",
  "APP_URL",
] as const;

/**
 * Fails fast and loud with one complete list of what's missing, instead of
 * each module discovering it lazily. Called from instrumentation.ts's
 * register(), which Next.js runs before the server accepts requests.
 */
export function assertRequiredEnv(): void {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `See .env.example for what each one is and where to get it.`
    );
  }
}
