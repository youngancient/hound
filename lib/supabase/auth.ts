import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Anon-key client for Server Components / Route Handlers — session
 * check only, never application data (reads go through the browser
 * client's session or a Route Handler backed by the service client).
 */
export async function createServerAuthClient() {
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options ?? {});
          }
        } catch {
          // Called from a render path that can't set cookies — proxy.ts
          // refreshes the session instead, so this is safe to ignore.
        }
      },
    },
  });
}

/** Current session's user, or null if not logged in. */
export async function getSessionUser() {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Throws unless there's an active session — for Route Handlers, which need
 * a catchable error to turn into a 401 response, not a hard redirect.
 * Returns { id, email } since some routes need the id (e.g. created_by).
 */
export async function requireSessionUser(): Promise<{ id: string; email: string }> {
  const user = await getSessionUser();
  if (!user?.email) {
    throw new Error("Unauthorized: no active session");
  }
  return { id: user.id, email: user.email };
}
