import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { ThemeToggle } from "./ThemeToggle";

export function AppHeader({ email }: { email: string }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-rule px-4 py-4 sm:px-6">
      <Link href="/" className="text-lg font-semibold">
        Hound
      </Link>
      <div className="flex min-w-0 items-center gap-4 text-sm text-ash">
        <ThemeToggle />
        <span className="hidden max-w-[16rem] truncate sm:inline" title={email}>
          {email}
        </span>
        <form action={signOut}>
          <button type="submit" className="cursor-pointer whitespace-nowrap hover:text-ink">
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
