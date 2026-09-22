import { PHASE_PRODUCTION_BUILD } from "next/constants";

/**
 * Runs once when a new server instance starts, before it accepts any
 * requests — the sanctioned place for a boot-time env check. Skipped
 * during `next build`, since build environments often lack runtime
 * secrets and never actually serve a request.
 */
export async function register() {
  if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) return;

  const { assertRequiredEnv } = await import("./lib/env");
  assertRequiredEnv();
}
