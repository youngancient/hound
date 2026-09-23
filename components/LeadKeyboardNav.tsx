"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * ↑/↓ (or k/j) move through the review list without touching the mouse.
 * Ignored while typing in a field, so editing outreach isn't hijacked.
 */
export function LeadKeyboardNav({ prevHref, nextHref }: { prevHref: string | null; nextHref: string | null }) {
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      const href = e.key === "ArrowDown" || e.key === "j" ? nextHref : e.key === "ArrowUp" || e.key === "k" ? prevHref : null;
      if (!href) return;
      e.preventDefault();
      router.replace(href, { scroll: false });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prevHref, nextHref, router]);

  return null;
}
