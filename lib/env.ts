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
  "APP_URL",
] as const;

/**
 * Only Inngest Cloud needs these. With INNGEST_DEV=1 the SDK talks to the
 * local Dev Server (`npx inngest-cli@latest dev`), which needs no keys, so
 * requiring them there would just force fake values into .env.
 */
const INNGEST_CLOUD_ENV_VARS = ["INNGEST_EVENT_KEY", "INNGEST_SIGNING_KEY"] as const;

/**
 * Fails fast and loud with one complete list of what's missing, instead of
 * each module discovering it lazily. Called from instrumentation.ts's
 * register(), which Next.js runs before the server accepts requests.
 */
export function assertRequiredEnv(): void {
  const inngestDev = process.env.INNGEST_DEV === "1" || process.env.INNGEST_DEV === "true";
  const required = inngestDev ? REQUIRED_ENV_VARS : [...REQUIRED_ENV_VARS, ...INNGEST_CLOUD_ENV_VARS];
  const missing = required.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `See .env.example for what each one is and where to get it.`
    );
  }
}
