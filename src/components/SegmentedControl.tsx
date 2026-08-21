/**
 * The two-up switch inside a tab — People / Groups (#62), and the same shape
 * Reports uses for Person / Group / Roll-up.
 *
 * Links rather than state: each segment is its own route, so the back button
 * works, a segment can be linked to, and nothing here needs the browser. The
 * drawing is `design/Groups.dc.html`'s.
 */
import Link from "next/link";

export type Segment = {
  href: string;
  label: string;
};

export function SegmentedControl({ segments, current }: { segments: Segment[]; current: string }) {
  return (
    /* #EDE8DF is the board's own track colour — a shade under `shell`, and the
       only place in the app that uses it, so it stays here rather than in the
       theme. */
    <div className="mt-[14px] flex gap-[6px] rounded-[16px] bg-[#EDE8DF] p-[4px]">
      {segments.map((segment) => {
        const selected = segment.href === current;
        return (
          <Link
            key={segment.href}
            href={segment.href}
            aria-current={selected ? "page" : undefined}
            className={`flex h-[46px] grow items-center justify-center rounded-[13px] text-[14px] font-bold ${
              selected ? "bg-card text-blue" : "text-tan"
            }`}
          >
            {segment.label}
          </Link>
        );
      })}
    </div>
  );
}

/** Both segments of the People tab, in one place so they cannot drift apart. */
export const PEOPLE_SEGMENTS: Segment[] = [
  { href: "/people", label: "People" },
  { href: "/people/groups", label: "Groups" },
];
