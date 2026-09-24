import { Inngest } from "inngest";

/**
 * Dev mode (the local Inngest Dev Server) only when running `next dev`
 * with INNGEST_DEV set. A production build (`next start`, NODE_ENV
 * "production") is always cloud mode, even if INNGEST_DEV leaks in from a
 * copied .env: in dev mode events go to localhost, where nothing is
 * listening, and Inngest's request signatures aren't checked.
 */
export const isInngestDev =
  process.env.NODE_ENV !== "production" && (process.env.INNGEST_DEV === "1" || process.env.INNGEST_DEV === "true");

export const inngest = new Inngest({ id: "hound", isDev: isInngestDev });
