/**
 * #68's layout rule, in one place: **progress dots wrap at six per row.**
 *
 * Its own module, and not part of either component, for two reasons. It is
 * shared by the numbered dots on the Person screen and the segment bars on the
 * GroupDetail card, and it is imported by a server component and a client one —
 * a function exported from a `"use client"` file cannot be called while the
 * server renders.
 *
 * Written as a style rather than a Tailwind class because the count is data:
 * Tailwind only generates classes it has seen in the source, so `grid-cols-${n}`
 * would silently produce nothing.
 */
export function columnsFor(count: number): React.CSSProperties {
  return { gridTemplateColumns: `repeat(${Math.min(6, Math.max(count, 1))}, minmax(0, 1fr))` };
}
