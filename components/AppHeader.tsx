import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { ThemeToggle } from "./ThemeToggle";

export function AppHeader({ email }: { email: string }) {
  return (
    <header className="flex items-center justify-between border-b border-rule px-6 py-4">
      <Link href="/" className="text-lg font-semibold">
        Hound
      </Link>
      <div className="flex items-center gap-4 text-sm text-ash">
        <ThemeToggle />
        <span>{email}</span>
        <form action={signOut}>
          <button type="submit" className="cursor-pointer hover:text-ink">
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
