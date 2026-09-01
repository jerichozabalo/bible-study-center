/**
 * Home — `design/Main.dc.html` (#20): the blue "next meeting" hero, then the
 * "Needs you" attention list, then the rest of the upcoming meetings so a night
 * created from the [+] tab is always visible (the calendar, issue 5, is where
 * it properly belongs). The roster stays in its own tab (#62).
 *
 * The attention list is the quiet list (#10/#64) — members who have missed
 * their home group's last N held meetings in a row. It surfaces them and
 * nothing more; the follow-up is assisted-only and v1.1 (#10).
 */
import Link from "next/link";

import { AttentionList } from "@/components/insights/AttentionList";
import { NextMeetingHero } from "@/components/insights/NextMeetingHero";
import { SignOutButton } from "@/components/SignOutButton";
import { requireUser } from "@/lib/auth/guard";
import { formatWeekdayDate, manilaToday } from "@/lib/dates";
import { getQuietMembers } from "@/lib/insights/quiet";
import { type MeetingSummary, listUpcomingMeetings } from "@/lib/meetings/meetings";
import { formatTime } from "@/lib/roster/schedule";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  const firstName = user.name?.split(" ")[0];
  const today = manilaToday();
  const [upcoming, quiet] = await Promise.all([
    listUpcomingMeetings(user.email, { from: today, limit: 6 }),
    getQuietMembers(user.email),
  ]);

  const [next, ...rest] = upcoming;

  return (
    <section className="py-6">
      <p className="text-[13px] font-semibold tracking-[0.06em] text-tan">
        {formatWeekdayDate(today).toUpperCase()}
      </p>
      <h1 className="mt-2 text-[27px]">{firstName ? `Hello, ${firstName}` : "Hello"}</h1>

      {next ? (
        <div className="mt-5">
          <NextMeetingHero meeting={next} />
        </div>
      ) : (
        <p className="mt-5 rounded-[20px] border-[1.5px] border-line bg-card px-4 py-5 text-[14.5px] leading-[1.5] text-slate">
          Nothing scheduled yet. Tap the blue [+] to create one.
        </p>
      )}

      <AttentionList quiet={quiet} />

      {rest.length > 0 ? (
        <>
          <h3 className="mt-8 mb-[11px] text-[18px]">More meetings</h3>
          <div className="flex flex-col gap-[10px]">
            {rest.map((meeting) => (
              <MeetingRow key={meeting.id} meeting={meeting} />
            ))}
          </div>
        </>
      ) : null}

      {/* Through `SignOutButton`, not a bare form: it also clears this device's
          lock, which is what makes #19's "a forgotten PIN is recovered by
          signing in with Google again" true from here and not only from
          Settings. */}
      <div className="mt-8">
        <SignOutButton className="flex h-12 items-center rounded-[14px] border-[1.5px] border-line px-5 text-[15px] font-semibold text-slate active:bg-shell" />
      </div>
    </section>
  );
}

/**
 * One of the meetings below the hero and the attention list. Tapping it opens
 * that meeting's attendance sheet (issue 6), the same as the hero's button. It
 * leads there whether the night is proposed or held: taking attendance is what
 * makes it held (#47), and reopening it is how a tick is corrected (#24).
 */
function MeetingRow({ meeting }: { meeting: MeetingSummary }) {
  const lesson =
    meeting.sessionNumber === null
      ? "No session — fellowship night"
      : `Book ${meeting.bookNumber} · Session ${meeting.sessionNumber} — ${meeting.sessionTitle}`;

  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="block rounded-[20px] border-[1.5px] border-line bg-card px-[15px] py-[14px] active:bg-shell"
    >
      <div className="flex items-baseline justify-between gap-[10px]">
        <span className="min-w-0 text-[15.5px] font-bold">{meeting.groupName}</span>
        {/* #47: everything created here is proposed, and saying so on the card
            is what makes "held" read as the deliberate act it is. */}
        <span className="shrink-0 rounded-[9px] bg-shell px-[9px] py-[5px] text-[11.5px] font-bold text-tan">
          {meeting.status === "proposed" ? "Proposed" : "Held"}
        </span>
      </div>
      <div className="mt-[3px] text-[14px] text-slate">
        {formatWeekdayDate(meeting.date)} · {formatTime(meeting.startTime)}
      </div>
      <div className="mt-[2px] text-[13px] text-tan">{lesson}</div>
    </Link>
  );
}
