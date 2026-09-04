"use client";

/**
 * The People and Groups lists' offline rows (#72 as amended 2026-09-02, issue
 * 18 Tier 2).
 *
 * A person or BGroup created with no signal is queued in the outbox and is not
 * in the server-rendered list until it uploads. This draws those queued rows
 * above the real list, in the same register issue 11 set for the Home card:
 * **Uploads** when you have signal — never "Sync". A row whose upload was
 * refused by the server (a name clash, a deleted parent) shows why and offers
 * "Try again", which is `outbox.retry()` — the one way past a failed write.
 *
 * Rendered by the server pages as a client child so the list itself stays a
 * server component.
 */
import { useOutbox } from "./OutboxProvider";
import { GROUP_WRITE, PERSON_WRITE, pendingRosterRows } from "@/lib/outbox/pending";
import { initialsOf } from "@/lib/roster/display";

export function PendingRosterRows({ kind }: { kind: "person" | "group" }) {
  const { pendingWrites, retry } = useOutbox();
  const rows = pendingRosterRows(pendingWrites, kind === "person" ? PERSON_WRITE : GROUP_WRITE);
  if (rows.length === 0) return null;

  const noun = kind === "person" ? "person" : "BGroup";

  return (
    <ul className="mt-[11px] flex flex-col gap-[8px]">
      {rows.map((row) => (
        <li
          key={row.queueId}
          className={`rounded-[20px] border px-[13px] py-3 ${
            row.status === "failed"
              ? "border-amber-ink/40 bg-amber-well"
              : "border-dashed border-line bg-shell"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[17px] text-[15.5px] font-bold ${
                row.status === "failed" ? "bg-card text-amber-ink" : "bg-card text-tan"
              }`}
            >
              {kind === "person" ? (
                initialsOf(row.name)
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 21a6 6 0 0 0-12 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                </svg>
              )}
            </div>

            <div className="min-w-0 grow">
              <div className="truncate text-[16px] font-bold">{row.name}</div>
              <div
                className={`mt-[3px] text-[13px] ${
                  row.status === "failed" ? "text-amber-ink" : "text-tan"
                }`}
              >
                {row.status === "failed"
                  ? `Couldn't upload this ${noun}${row.error ? ` — ${row.error}` : ""}`
                  : "Uploads when you have signal"}
              </div>
            </div>
          </div>

          {row.status === "failed" ? (
            <button
              type="button"
              onClick={retry}
              className="mt-[9px] ml-[60px] text-[13.5px] font-bold text-blue active:opacity-70"
            >
              Try again
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
