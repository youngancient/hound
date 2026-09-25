/**
 * Pure helpers for a person's edits to a waiting search's ICP — no I/O,
 * unit-tested in tests/icp-edit.test.ts.
 */
import type { IcpEdit, RefinedIcp } from "./schemas";

export const EDITABLE_ICP_FIELDS = [
  "target_company_type",
  "industries",
  "geography",
  "headcount_min",
  "headcount_max",
  "country_codes",
  "buyer_persona",
  "business_problem",
  "hard_filters",
  "soft_preferences",
  "disqualifiers",
] as const satisfies ReadonlyArray<keyof IcpEdit>;

/** The ICP to search with: the person's edits, with Hound's assumptions kept as Hound wrote them. */
export function applyIcpEdit(original: RefinedIcp, edit: IcpEdit): RefinedIcp {
  return { ...edit, assumptions: original.assumptions };
}

/** The fields an edit changed, for the search's log. */
export function changedIcpFields(original: RefinedIcp, edit: IcpEdit): string[] {
  return EDITABLE_ICP_FIELDS.filter((field) => JSON.stringify(original[field]) !== JSON.stringify(edit[field]));
}

/** The editable part of an ICP, as the editor starts from. */
export function toIcpEdit(icp: RefinedIcp): IcpEdit {
  return Object.fromEntries(EDITABLE_ICP_FIELDS.map((field) => [field, icp[field]])) as IcpEdit;
}
