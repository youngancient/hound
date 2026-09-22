import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client — auth only (login/logout), never application data. Split
 * into its own file (no next/headers import) so Client Components can
 * import it without pulling server-only code into the client bundle.
 */
export function createBrowserAuthClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
