"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Searches", isActive: (p: string) => p === "/" || p.startsWith("/searches/") },
  { href: "/leads", label: "Leads", isActive: (p: string) => p === "/leads" },
];

/** The current page's link is simply darker and medium weight; others lighten on hover. */
export function HeaderNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="order-last -ml-2 flex w-full items-center gap-2 pb-3 text-sm sm:order-none sm:ml-0 sm:w-auto sm:pb-0">
      {LINKS.map((link) => {
        const active = link.isActive(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-sm px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              active ? "font-medium text-ink" : "text-ash hover:bg-rule/60 hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
