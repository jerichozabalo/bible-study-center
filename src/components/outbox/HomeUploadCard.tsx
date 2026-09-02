"use client";

/**
 * Home's "waiting to upload" card — `design/Main.dc.html`'s upload entry on the
 * attention list (#20), pulled out as its own card because it is device state,
 * not a person who needs the leader.
 *
 * Only drawn when something is actually queued (#72). The word is **Upload**
 * (#66/#72) — never "sync", never "back up".
 */
import { useOutbox } from "./OutboxProvider";

export function HomeUploadCard() {
  const { pending, flush } = useOutbox();
  if (pending === 0) return null;

  return (
    <section className="mt-6">
      <div className="rounded-[20px] border border-line bg-[#EDEAE3] px-[15px] py-[14px]">
        <div className="flex items-start gap-3">
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[13px] bg-card text-slate">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#61708A"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
          </span>
          <div className="min-w-0 grow">
            <div className="text-[15.5px] font-bold">Waiting to upload</div>
            <div className="mt-[2px] text-[14px] leading-[1.4] text-slate">
              {pending === 1 ? "1 change" : `${pending} changes`} saved on this phone with no signal.
              It uploads by itself when you have a connection.
            </div>
            <button
              type="button"
              onClick={flush}
              className="mt-[8px] text-[13.5px] font-bold text-blue active:opacity-70"
            >
              Upload now
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
