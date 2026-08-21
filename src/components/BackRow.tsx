/**
 * The chevron back to where you came from, with an optional title beside it.
 *
 * `design/GroupDetail.dc.html` and `design/NewMeeting.dc.html` both draw this
 * row at the very top of the screen, above their own chrome. Under #62 every
 * screen sits inside the shell, which already has a header, so the row lives at
 * the top of the content instead — the chevron is where the eye expects it and
 * the app's name stays put.
 */
import Link from "next/link";

export function BackRow({ href, title }: { href: string; title?: string }) {
  return (
    <div className="-ml-[10px] flex items-center gap-[2px] pb-1">
      <Link
        href={href}
        aria-label="Back"
        className="flex h-11 w-11 items-center justify-center rounded-[14px] active:bg-shell"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#14202E"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </Link>
      {title ? <h2 className="text-[19px]">{title}</h2> : null}
    </div>
  );
}
