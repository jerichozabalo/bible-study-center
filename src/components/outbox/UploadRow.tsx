"use client";

/**
 * The Settings ACCOUNT row for the outbox (#72) — `design/Settings.dc.html`'s
 * "Upload pending attendance" row, with its board heading "ACCOUNT & SYNC"
 * dropped to "ACCOUNT" because *Sync* is retired (#66/#72).
 *
 * It never says "sync" and never says "back up". Tapping it while something is
 * waiting asks the outbox to flush now; the flush also runs by itself on
 * reconnect, so this is a nudge, not the only way up.
 */
import { useOutbox } from "./OutboxProvider";

export function UploadRow() {
  const { pending, flush } = useOutbox();
  const clear = pending === 0;

  return (
    <button
      type="button"
      onClick={() => {
        if (!clear) flush();
      }}
      disabled={clear}
      className="flex w-full items-center gap-3 p-[15px] text-left active:bg-shell disabled:active:bg-transparent"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-blue-tint">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#1D4E89"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
      </span>
      <span className="min-w-0 grow">
        <span className="block text-[15.5px] font-bold">
          {clear ? "Everything uploaded" : "Upload pending attendance"}
        </span>
        <span className="mt-[2px] block text-[13.5px] text-slate">
          {clear
            ? "Nothing is waiting on this phone."
            : `${pending} ${pending === 1 ? "change" : "changes"} waiting. Needs a connection.`}
        </span>
      </span>
    </button>
  );
}
