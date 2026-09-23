"use client";

import { useId, useRef, useState } from "react";

/**
 * "Export CSV" opens a small dialog to choose what goes in the file, then
 * downloads it. Uses the native <dialog>, so focus stays inside, Esc
 * closes it, and screen readers announce it as a dialog.
 * `baseHref` is the export route with any filters already applied.
 */
export function ExportCsvButton({
  baseHref,
  leadCount,
  reviewCount,
}: {
  baseHref: string;
  leadCount: number;
  /** "Needs a look" companies available to include, when known. */
  reviewCount?: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [includeReview, setIncludeReview] = useState(false);
  const [includeOutreach, setIncludeOutreach] = useState(false);
  const titleId = useId();
  const checkboxId = useId();
  const outreachId = useId();

  const extra = [includeReview ? "include=needs_review" : null, includeOutreach ? "outreach=1" : null].filter(Boolean);
  const href = extra.length ? `${baseHref}${baseHref.includes("?") ? "&" : "?"}${extra.join("&")}` : baseHref;
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  const total = leadCount + (includeReview ? (reviewCount ?? 0) : 0);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="cursor-pointer rounded-sm border border-rule px-3 py-1.5 text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Export CSV
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClick={(e) => {
          // A click on the backdrop (the dialog element itself) closes it.
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-sm border border-rule bg-paper p-0 text-ink backdrop:bg-ink/40"
      >
        <div className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-base font-medium">
              Export leads
            </h2>
            <p className="text-sm text-ash">
              A CSV for a spreadsheet or your CRM, with each company&apos;s details and why it fits.
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-sm border border-rule px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span>Leads</span>
              <span className="text-ash tabular-nums">{plural(leadCount, "company", "companies")}</span>
            </div>
            <label htmlFor={checkboxId} className="flex cursor-pointer items-start justify-between gap-3">
              <span className="flex items-start gap-2.5">
                <input
                  id={checkboxId}
                  type="checkbox"
                  checked={includeReview}
                  onChange={(e) => setIncludeReview(e.target.checked)}
                  className="mt-0.5 accent-[var(--accent)]"
                />
                <span className="flex flex-col gap-0.5">
                  <span>Include &ldquo;Needs a look&rdquo;</span>
                  <span className="text-xs text-ash">Companies Hound wasn&apos;t sure about. Marked as such in the file.</span>
                </span>
              </span>
              {reviewCount !== undefined && (
                <span className="text-ash tabular-nums">{plural(reviewCount, "company", "companies")}</span>
              )}
            </label>
            <label htmlFor={outreachId} className="flex cursor-pointer items-start gap-2.5 border-t border-rule pt-3">
              <input
                id={outreachId}
                type="checkbox"
                checked={includeOutreach}
                onChange={(e) => setIncludeOutreach(e.target.checked)}
                className="mt-0.5 accent-[var(--accent)]"
              />
              <span className="flex flex-col gap-0.5">
                <span>Include outreach drafts</span>
                <span className="text-xs text-ash">Adds the 3 emails and the LinkedIn message as extra columns.</span>
              </span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="cursor-pointer rounded-sm px-3 py-1.5 text-sm text-ash hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Cancel
            </button>
            <a
              href={href}
              download
              onClick={() => dialogRef.current?.close()}
              className="rounded-sm bg-accent px-4 py-1.5 text-sm font-medium text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {/* The count is only shown when it's known exactly. */}
              {reviewCount !== undefined || !includeReview ? `Download ${total}` : "Download"}
            </a>
          </div>
        </div>
      </dialog>
    </>
  );
}
