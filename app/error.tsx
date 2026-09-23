"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Shown when a page fails to load (e.g. the database is unreachable).
 * Plain words for the people using Hound; the technical detail goes to
 * the console and server logs, never onto the page.
 */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-start justify-center gap-4 px-6 py-16">
      <h1 className="text-lg font-medium">This page didn&apos;t load</h1>
      <p className="text-sm text-ash">Something went wrong on our side. Try again in a moment.</p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => retry()}
          className="cursor-pointer rounded-sm bg-accent px-4 py-2 text-sm font-medium text-paper"
        >
          Try again
        </button>
        <Link href="/" className="text-sm text-ash hover:text-ink">
          Go to your searches
        </Link>
      </div>
    </main>
  );
}
