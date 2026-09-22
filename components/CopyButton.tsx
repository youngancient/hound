"use client";

import { toast } from "sonner";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied.");
    } catch {
      toast.error("Couldn't copy — try selecting the text instead.");
    }
  }

  return (
    <button type="button" onClick={handleCopy} className="cursor-pointer text-xs text-ash hover:text-ink">
      {label}
    </button>
  );
}
