"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createBrowserAuthClient } from "@/lib/supabase/browser";
import { Spinner } from "./Spinner";
import { safeNextPath } from "@/lib/session";

/** Invite-only — there is no sign-up link here on purpose (design.md Section 11). */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createBrowserAuthClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast.error("That email or password didn't work. Please check them and try again.");
      return;
    }

    router.push(safeNextPath(searchParams.get("next")));
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm text-ash">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-sm border border-rule bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm text-ash">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-sm border border-rule bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="mt-2 inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-sm bg-accent px-4 py-2 text-sm font-medium text-paper transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading && <Spinner />}
        {loading ? "Logging in" : "Log in"}
      </button>
    </form>
  );
}
