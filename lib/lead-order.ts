/**
 * The order leads are reviewed in, everywhere: leads first (strongest on
 * top), then "needs a look", then "not a fit". The list, the detail
 * panel's Next/Previous and the arrow keys all follow this.
 */
type Orderable = { qualification_status: string; confidence: number };

const RANK: Record<string, number> = { qualified: 0, needs_review: 1, not_qualified: 2 };

export function orderLeads<T extends Orderable>(leads: T[]): T[] {
  return [...leads].sort(
    (a, b) => (RANK[a.qualification_status] ?? 3) - (RANK[b.qualification_status] ?? 3) || b.confidence - a.confidence
  );
}
