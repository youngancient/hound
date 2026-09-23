import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-start justify-center gap-4 px-6 py-16">
      <h1 className="text-lg font-medium">We couldn&apos;t find that</h1>
      <p className="text-sm text-ash">The link may be wrong, or the search or lead may have been removed.</p>
      <Link href="/" className="rounded-sm bg-accent px-4 py-2 text-sm font-medium text-paper">
        Go to your searches
      </Link>
    </main>
  );
}
