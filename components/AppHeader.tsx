import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { HeaderNav } from "./HeaderNav";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Sits in the same column as every page's content (max-w-5xl), so the
 * wordmark lines up with the page title. No separate chrome bar
 * (frontend-design.md): one content-width hairline underneath.
 */
export function AppHeader() {
  return (
    <header className="mx-auto w-full max-w-5xl px-4 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-rule">
        <Link
          href="/"
          className="py-4 text-[17px] font-semibold tracking-[-0.01em] text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        >
          Hound
        </Link>

        <HeaderNav />

        <div className="ml-auto flex items-center gap-4 py-3 text-sm">
          <ThemeToggle />
          <form action={signOut}>
            <button
              type="submit"
              className="cursor-pointer whitespace-nowrap rounded-sm px-2 py-1 text-ash hover:bg-rule/60 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Log out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
