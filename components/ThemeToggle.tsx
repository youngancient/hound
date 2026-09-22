"use client";

import { useEffect, useState } from "react";

type ThemeChoice = "system" | "light" | "dark";

const ORDER: ThemeChoice[] = ["system", "light", "dark"];
const TITLE: Record<ThemeChoice, string> = {
  system: "Theme: matching system — click for light",
  light: "Theme: light — click for dark",
  dark: "Theme: dark — click for system",
};

function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", choice);
  try {
    localStorage.setItem("theme", choice);
  } catch {
    // Private browsing / storage blocked — theme just won't persist across reloads.
  }
}

export function ThemeToggle() {
  // Starts at "system" on both server and first client render (matches the
  // no-flash inline script in layout.tsx, which sets data-theme before this
  // component ever mounts) — reading localStorage here instead would cause
  // a hydration mismatch, so the sync read happens after mount instead.
  const [theme, setTheme] = useState<ThemeChoice>("system");

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem("theme");
    } catch {
      // Private browsing / storage blocked — fall back to "system" silently.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of a client-only persisted value, not a cascading update
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      onClick={cycle}
      title={TITLE[theme]}
      aria-label={TITLE[theme]}
      className="cursor-pointer text-sm text-ash hover:text-ink"
    >
      {theme === "system" ? "Auto" : theme === "light" ? "Light" : "Dark"}
    </button>
  );
}
