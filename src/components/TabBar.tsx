"use client";

/**
 * The five slots, fixed by #62: Home · Calendar · [+] · People · Reports.
 * `design/Main.dc.html` draws it; this is that drawing, made to navigate.
 *
 * A client component for one reason — it has to know which slot is current, and
 * `usePathname` is the only thing on this screen that needs the browser. The
 * screens it leads to are all server components.
 *
 * [+] is not a tab in the sense the other four are. It has no label and no
 * selected state because it is an action, not a place: it opens the create-a-
 * meeting form (issue 4). It sits in the middle slot at the size the board
 * gives it, which is bigger than the icons on either side and deliberately so —
 * it is the thing Jericho reaches for standing up, in a room, one-handed.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

type Slot = {
  href: string;
  label: string;
  /** Drawn at 23px, stroke 1.9 (2.1 when current) — the board's weights. */
  path: React.ReactNode;
};

const SLOTS: Slot[] = [
  {
    href: "/",
    label: "Home",
    path: <path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  },
  {
    href: "/calendar",
    label: "Calendar",
    path: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M8 3v4M16 3v4M3 11h18" />
      </>
    ),
  },
  {
    href: "/people",
    label: "People",
    path: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        {/* The second person's head. The artboards drop this subpath — Lucide's
            `users` glyph has four, Main.dc.html and Calendar.dc.html carry
            three — so the icon rendered as a headless shoulder beside a whole
            person. Caught by eye on the first real sign-in, 2026-08-21. Boards
            govern visual idiom, but a missing head is an authoring slip, not an
            idiom; both boards were corrected to match. */}
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  {
    href: "/reports",
    label: "Reports",
    path: <path d="M5 20V10M12 20V4M19 20v-7" />,
  },
];

function isCurrent(pathname: string, href: string): boolean {
  // Home is the only one that must match exactly, or every screen in the app
  // would light it up as well as its own tab.
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function TabBar() {
  const pathname = usePathname();
  const [home, calendar, people, reports] = SLOTS;

  return (
    <nav
      aria-label="Main"
      className="flex shrink-0 items-end justify-between border-t border-line bg-card px-[14px] pt-[9px] pb-[18px]"
      // The home indicator on a phone sits under the last 34px of the screen.
      // Without this the Reports label is behind it.
      style={{ paddingBottom: "calc(18px + env(safe-area-inset-bottom, 0px))" }}
    >
      <Tab slot={home} pathname={pathname} />
      <Tab slot={calendar} pathname={pathname} />

      <div className="flex w-[60px] justify-center">
        <Link
          href="/new"
          aria-label="New meeting"
          className="mb-1 flex h-[58px] w-[58px] items-center justify-center rounded-[20px] bg-blue active:bg-blue-deep"
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.4"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </Link>
      </div>

      <Tab slot={people} pathname={pathname} />
      <Tab slot={reports} pathname={pathname} />
    </nav>
  );
}

function Tab({ slot, pathname }: { slot: Slot; pathname: string }) {
  const current = isCurrent(pathname, slot.href);

  return (
    <Link
      href={slot.href}
      aria-current={current ? "page" : undefined}
      className="flex w-[60px] flex-col items-center gap-[3px]"
    >
      <svg
        width="23"
        height="23"
        viewBox="0 0 24 24"
        fill="none"
        stroke={current ? "#1D4E89" : "#8B7B63"}
        strokeWidth={current ? 2.1 : 1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {slot.path}
      </svg>
      <span
        className={
          current ? "text-[11px] font-bold text-blue" : "text-[11px] font-semibold text-tan"
        }
      >
        {slot.label}
      </span>
    </Link>
  );
}
