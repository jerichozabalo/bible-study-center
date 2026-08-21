/**
 * Home. Still mostly a placeholder: `design/Main.dc.html`'s blue "next meeting"
 * hero, its Mark-attendance button and the "Needs you" attention list are issue
 * 8's, and the quiet-list derivation underneath them needs completions that do
 * not exist yet.
 *
 * What it does carry is the plain list of the next few meetings, so a meeting
 * created from the [+] tab is visible somewhere the moment it exists. The
 * calendar (issue 5) is where it properly belongs.
 */
import { SignOutButton } from "@/components/SignOutButton";
import { requireUser } from "@/lib/auth/guard";
import { formatLongDate, todayInManila } from "@/lib/dates";
import { type MeetingSummary, listUpcomingMeetings } from "@/lib/meetings/meetings";
import { formatTime } from "@/lib/roster/schedule";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  const firstName = user.name?.split(" ")[0];
  const upcoming = await listUpcomingMeetings(user.email, { from: todayInManila(), limit: 5 });

  return (
    <section className="py-6">
      <p className="text-[13px] font-semibold tracking-[0.06em] text-tan">SIGNED IN</p>
      <h1 className="mt-2 text-[27px]">{firstName ? `Hello, ${firstName}` : "Hello"}</h1>
      <p className="mt-2 text-[15px] leading-[1.5] text-slate">
        Your groups, meetings and roster land here. Nothing to show yet — the
        Home screen fills up as you add people and take attendance.
      </p>

      <h3 className="mt-8 mb-[11px] text-[18px]">Next meetings</h3>
      {upcoming.length === 0 ? (
        <p className="rounded-[20px] border-[1.5px] border-line bg-card px-4 py-5 text-[14.5px] leading-[1.5] text-slate">
          Nothing scheduled yet. Tap the blue [+] to create one.
        </p>
      ) : (
        <div className="flex flex-col gap-[10px]">
          {upcoming.map((meeting) => (
            <MeetingRow key={meeting.id} meeting={meeting} />
          ))}
        </div>
      )}

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

function MeetingRow({ meeting }: { meeting: MeetingSummary }) {
  const lesson =
    meeting.sessionNumber === null
      ? "No session — fellowship night"
      : `Book ${meeting.bookNumber} · Session ${meeting.sessionNumber} — ${meeting.sessionTitle}`;

  return (
    <div className="rounded-[20px] border-[1.5px] border-line bg-card px-[15px] py-[14px]">
      <div className="flex items-baseline justify-between gap-[10px]">
        <span className="min-w-0 text-[15.5px] font-bold">{meeting.groupName}</span>
        {/* #47: everything created here is proposed, and saying so on the card
            is what makes "held" read as the deliberate act it is. */}
        <span className="shrink-0 rounded-[9px] bg-shell px-[9px] py-[5px] text-[11.5px] font-bold text-tan">
          {meeting.status === "proposed" ? "Proposed" : "Held"}
        </span>
      </div>
      <div className="mt-[3px] text-[14px] text-slate">
        {formatLongDate(meeting.date)} · {formatTime(meeting.startTime)}
      </div>
      <div className="mt-[2px] text-[13px] text-tan">{lesson}</div>
    </div>
  );
}
