import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS entirely — this is the only
 * client allowed to write to `leads`/`tool_calls`, and the only one that
 * can transition `runs.status`. Never import this from a Client Component;
 * `server-only` makes that a build error. See artifact/design.md Section 11.
 */
let client: SupabaseClient | null = null;

export function supabaseService(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  }

  client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return client;
}
