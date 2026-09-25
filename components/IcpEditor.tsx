"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Spinner } from "./Spinner";
import { allCountries, countryName } from "@/lib/countries";
import { hasLinkedinLocationFilter } from "@/lib/discovery";
import { changedIcpFields, toIcpEdit } from "@/lib/icp-edit";
import { ICP_EDIT_MAX_CHARS, ICP_EDIT_MAX_ITEMS, type IcpEdit, type RefinedIcp } from "@/lib/schemas";
import { SESSION_ENDED_MESSAGE, loginUrlFor } from "@/lib/session";

const inputClass =
  "w-full rounded-sm border border-rule bg-transparent px-2.5 py-1.5 text-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30";
const smallButtonClass =
  "cursor-pointer rounded-sm px-2 py-1 text-xs text-ash hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";

/**
 * A waiting search's ICP, editable by the person who started it. The
 * server checks everything again (IcpEditSchema); the limits here only
 * save a round trip. Hound's assumptions are shown, not edited.
 */
export function IcpEditor({ runId, icp }: { runId: string; icp: RefinedIcp }) {
  const router = useRouter();
  const original = useMemo(() => toIcpEdit(icp), [icp]);
  const [draft, setDraft] = useState<IcpEdit>(original);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changed = changedIcpFields(icp, draft);
  const set = <K extends keyof IcpEdit>(key: K, value: IcpEdit[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`/api/runs/${runId}/icp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changed.length > 0 ? { icp: cleaned(draft) } : {}),
      });
      if (res.status === 401) {
        setStarting(false);
        toast.error(SESSION_ENDED_MESSAGE, {
          action: { label: "Log in", onClick: () => router.push(loginUrlFor(window.location.pathname)) },
        });
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setStarting(false);
        setError(body?.error ?? "We couldn't start your search. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      setStarting(false);
      setError("We couldn't start your search. Please try again.");
    }
  }

  return (
    <section className="flex flex-col gap-5 rounded-sm border border-accent px-4 py-4 text-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium">Check how Hound read your request</h2>
        <p className="text-ash">
          Change anything that&apos;s off, then start the search. Hound searches with exactly this, and waits up to 24
          hours.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Companies" hint="What kind of company to look for." className="sm:col-span-2">
          {(id) => (
            <input
              id={id}
              value={draft.target_company_type}
              maxLength={ICP_EDIT_MAX_CHARS}
              onChange={(e) => set("target_company_type", e.target.value)}
              className={inputClass}
            />
          )}
        </Field>

        <Field label="Size" hint="Employees. Leave a side empty for no limit.">
          {(id) => (
            <div className="flex items-center gap-2">
              <input
                id={id}
                type="number"
                min={0}
                inputMode="numeric"
                aria-label="Smallest size"
                placeholder="Any"
                value={draft.headcount_min ?? ""}
                onChange={(e) => set("headcount_min", toCount(e.target.value))}
                className={inputClass}
              />
              <span className="text-ash">to</span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                aria-label="Largest size"
                placeholder="Any"
                value={draft.headcount_max ?? ""}
                onChange={(e) => set("headcount_max", toCount(e.target.value))}
                className={inputClass}
              />
            </div>
          )}
        </Field>

        <CountriesField value={draft.country_codes} onChange={(codes) => set("country_codes", codes)} />

        <ListField label="Industries" value={draft.industries} onChange={(v) => set("industries", v)} />
        <ListField
          label="Other location details"
          hint="Anything more specific than a country, like a city or region."
          value={draft.geography}
          onChange={(v) => set("geography", v)}
        />

        <Field label="Who to reach" hint="The person the outreach is written for.">
          {(id) => (
            <input
              id={id}
              value={draft.buyer_persona}
              maxLength={ICP_EDIT_MAX_CHARS}
              onChange={(e) => set("buyer_persona", e.target.value)}
              className={inputClass}
            />
          )}
        </Field>
        <Field label="Problem they have" hint="What makes them a good fit.">
          {(id) => (
            <input
              id={id}
              value={draft.business_problem}
              maxLength={ICP_EDIT_MAX_CHARS}
              onChange={(e) => set("business_problem", e.target.value)}
              className={inputClass}
            />
          )}
        </Field>

        <ListField
          label="Must have"
          hint="A company that misses any of these isn't a fit."
          value={draft.hard_filters}
          onChange={(v) => set("hard_filters", v)}
        />
        <ListField
          label="Nice to have"
          hint="Counts in a company's favour, but isn't required."
          value={draft.soft_preferences}
          onChange={(v) => set("soft_preferences", v)}
        />
        <ListField
          label="Leaving out"
          hint="Kinds of company to rule out."
          value={draft.disqualifiers}
          onChange={(v) => set("disqualifiers", v)}
          className="sm:col-span-2"
        />
      </div>

      {icp.assumptions.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-rule pt-3">
          <p className="text-ash">Hound assumed</p>
          <ul className="flex list-outside list-disc flex-col gap-1 pl-5">
            {icp.assumptions.map((assumption, i) => (
              <li key={i}>{assumption}</li>
            ))}
          </ul>
          <p className="text-xs text-ash">If an assumption is wrong, change the fields above.</p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-oxblood">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-rule pt-4">
        {changed.length > 0 && (
          <button
            type="button"
            disabled={starting}
            onClick={() => setDraft(original)}
            className="cursor-pointer rounded-sm px-3 py-1.5 text-sm text-ash hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            Undo my changes
          </button>
        )}
        <button
          type="button"
          disabled={starting}
          onClick={start}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm bg-accent px-4 py-2 text-sm font-medium text-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {starting && <Spinner />}
          {starting ? "Starting search" : changed.length > 0 ? "Start search with my changes" : "Start search"}
        </button>
      </div>
    </section>
  );
}

function Field({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-ash">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-ash">{hint}</p>}
    </div>
  );
}

function ListField({
  label,
  hint,
  value,
  onChange,
  className = "",
}: {
  label: string;
  hint?: string;
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
}) {
  const headingId = useId();
  const full = value.length >= ICP_EDIT_MAX_ITEMS;
  return (
    <div role="group" aria-labelledby={headingId} className={`flex flex-col gap-1.5 ${className}`}>
      <span id={headingId} className="text-ash">
        {label}
      </span>
      {value.length === 0 && <p className="text-xs text-ash">None.</p>}
      <ul className="flex flex-col gap-1.5">
        {value.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <input
              aria-label={`${label} ${i + 1}`}
              value={item}
              maxLength={ICP_EDIT_MAX_CHARS}
              onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))}
              className={inputClass}
            />
            <button
              type="button"
              aria-label={`Remove ${label.toLowerCase()} ${i + 1}`}
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              className={smallButtonClass}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button type="button" disabled={full} onClick={() => onChange([...value, ""])} className={`w-fit ${smallButtonClass}`}>
        + Add
      </button>
      {hint && <p className="text-xs text-ash">{hint}</p>}
    </div>
  );
}

function CountriesField({ value, onChange }: { value: string[]; onChange: (codes: string[]) => void }) {
  const id = useId();
  const countries = useMemo(() => allCountries(), []);
  const searchedByName = value.filter((code) => !hasLinkedinLocationFilter(code));

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-ash">
        Countries
      </label>
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((code) => (
            <li key={code} className="inline-flex items-center gap-1 rounded-sm border border-rule py-0.5 pl-2 pr-0.5">
              {countryName(code)}
              <button
                type="button"
                aria-label={`Remove ${countryName(code)}`}
                onClick={() => onChange(value.filter((c) => c !== code))}
                className={smallButtonClass}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ash">Anywhere.</p>
      )}
      <select
        id={id}
        value=""
        disabled={value.length >= ICP_EDIT_MAX_ITEMS}
        onChange={(e) => e.target.value && onChange([...value, e.target.value])}
        className={inputClass}
      >
        <option value="">Add a country…</option>
        {countries
          .filter((c) => !value.includes(c.code))
          .map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
      </select>
      {searchedByName.length > 0 && (
        <p className="text-xs text-ash">
          So far Hound only uses LinkedIn&apos;s location filter for the United States and the United Kingdom. For{" "}
          {searchedByName.map(countryName).join(", ")}, it adds the country to the search words instead, which is less
          precise, so fewer of the companies it finds may be based there.
        </p>
      )}
    </div>
  );
}

/** "" → no limit; anything else → a whole number of employees. */
function toCount(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Trimmed, with blank list entries dropped, so an empty "+ Add" row isn't sent. */
function cleaned(edit: IcpEdit): IcpEdit {
  const list = (items: string[]) => items.map((s) => s.trim()).filter(Boolean);
  return {
    ...edit,
    target_company_type: edit.target_company_type.trim(),
    buyer_persona: edit.buyer_persona.trim(),
    business_problem: edit.business_problem.trim(),
    industries: list(edit.industries),
    geography: list(edit.geography),
    hard_filters: list(edit.hard_filters),
    soft_preferences: list(edit.soft_preferences),
    disqualifiers: list(edit.disqualifiers),
  };
}
