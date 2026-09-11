/**
 * Home's "Needs you" list — `design/Main.dc.html`'s attention list (#20).
 *
 * v1 surfaces one kind of entry: a member who has gone quiet (#10/#64) — missed
 * their home group's last N held meetings in a row. The board also mocks a
 * catch-up row and an upload row on this list; those belong to issue 7's
 * matching and issue 11's outbox and are not folded in here.
 *
 * There is no "Send a message" action (#10 — quiet follow-up is assisted-only
 * and v1.1 drafts against this list; v1 just shows it). Each row links to the
 * person so the leader can act however they choose. The copy describes the
 * situation and never grades the person (#66).
 */
import Link from "next/link";

import { quietLine } from "@/lib/insights/display";
import type { QuietMember } from "@/lib/insights/quiet";
import { initialsOf } from "@/lib/roster/display";

export function AttentionList({ quiet }: { quiet: QuietMember[] }) {
  if (quiet.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="mb-[11px] flex items-baseline justify-between">
        <h3 className="text-[18px]">Needs you</h3>
        <span className="text-[13px] font-semibold text-tan">{quiet.length}</span>
      </div>

      <div className="flex flex-col gap-[10px]">
        {quiet.map((member) => (
          <Link
            key={member.personId}
            href={`/people/${member.personId}`}
            className="block rounded-[20px] border border-line bg-card px-[15px] py-[14px] active:bg-shell"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[13px] bg-amber-well text-[13px] font-bold text-amber-ink">
                {initialsOf(member.name)}
              </span>
              <div className="min-w-0 grow">
                <div className="text-[15.5px] font-bold">{member.name}</div>
                <div className="mt-[2px] text-[14px] leading-[1.4] text-slate">
                  {quietLine(member)}
                </div>
                <div className="mt-[2px] text-[13px] text-tan">{member.homeGroupName}</div>
              </div>
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#c3b8a5"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="mt-[9px] shrink-0"
              >
                <path d="m9 18 6-6-6-6" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
