/**
 * The app shell: header, a scrolling middle, the tab bar. Every screen behind
 * sign-in renders inside this, and none of them draws its own chrome.
 *
 * `requireUser()` is here rather than in each page so that adding a screen
 * cannot accidentally add an unguarded one — a new route under `(shell)` is
 * behind sign-in by construction. It is the whole reason for the route group.
 *
 * The three-row grid (header / scroll / tab bar) is what keeps the tab bar
 * pinned without `position: fixed`, which on mobile Safari moves with the URL
 * bar and covers content at exactly the wrong moment.
 */
import Link from "next/link";

import { Emblem } from "@/components/Emblem";
import { TabBar } from "@/components/TabBar";
import { requireUser } from "@/lib/auth/guard";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  await requireUser();

  return (
    /* Capped and centred for the same reason the sign-in screen is: the boards
       are a 390px phone frame, and a laptop window is not. */
    <div className="mx-auto flex h-dvh w-full max-w-[420px] flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between px-4 pt-4 pb-1">
        <div className="flex items-center gap-[10px]">
          <Emblem size={30} />
          <span className="font-display text-[17px] font-bold tracking-[-0.015em]">
            Bible Study Tayo
          </span>
        </div>
        <Link
          href="/settings"
          aria-label="Settings"
          className="flex h-11 w-11 items-center justify-center rounded-[14px] active:bg-shell"
        >
          <svg
            width="21"
            height="21"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#61708A"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.35.45.6.83.71H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </header>

      <div className="scroll min-h-0 grow overflow-y-auto px-4 pt-[6px] pb-5">{children}</div>

      <TabBar />
    </div>
  );
}
