/**
 * The Meeting page — issue 5's calendar, now with the meeting log as its
 * default view on open (bst-v1.2 #1).
 *
 * It lands on the List: every meeting dated today or earlier, newest first
 * (`listMeetingLog`) — the record, cards and all. The Calendar view beside it
 * is what this page has always drawn: materialised proposed meetings (#7/#49)
 * with ghosts beyond the 8-week edge, the week/month grids, and the selected
 * day's agenda. Weekday comes from each meeting's own date (#48b), so a held
 * night from under the old schedule keeps its weekday after a change.
 *
 * The segments are links — the #62 People/Groups idiom — so the back button
 * works and each view can be linked: List is the bare /calendar, Calendar is
 * ?view=calendar. `requireUser()` and the materialiser run either way; the
 * calendar's own reads run only when that view landed. The client component
 * keeps owning its Week/Month toggle and the selected day.
 *
 * `design/Calendar.dc.html` draws the calendar view; the List borrows its
 * cards (`components/meetings/MeetingCard`).
 */
import { SegmentedControl } from "@/components/SegmentedControl";
import { requireUser } from "@/lib/auth/guard";
import { addDays, manilaToday } from "@/lib/dates";
import { getCalendar, getGroupSchedules, materializeSchedule } from "@/lib/meetings/calendar";
import { computeGhosts } from "@/lib/meetings/ghosts";
import { listMeetingLog } from "@/lib/meetings/meetings";

import { CalendarView } from "./CalendarView";
import { MeetingLogView } from "./MeetingLogView";

export const dynamic = "force-dynamic";

export default async function MeetingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const user = await requireUser();
  const today = manilaToday();
  const isCalendar = view === "calendar";

  // Ensure the forward horizon is populated (#5) — whichever view landed: the
  // log promises "upcoming nights are on the Calendar", so the calendar must
  // be able to show them once tapped. The materialiser is idempotent.
  await materializeSchedule(user.email, today);

  return (
    <section className="flex flex-col">
      <h1 className="text-[26px]">Meeting</h1>
      <SegmentedControl
        current={isCalendar ? "/calendar?view=calendar" : "/calendar"}
        segments={[
          { href: "/calendar", label: "List" },
          { href: "/calendar?view=calendar", label: "Calendar" },
        ]}
      />

      {isCalendar ? (
        <CalendarSection ownerId={user.email} today={today} />
      ) : (
        <LogSection ownerId={user.email} today={today} />
      )}
    </section>
  );
}

/** The List: the log read, then the cards. */
async function LogSection({ ownerId, today }: { ownerId: string; today: string }) {
  const meetings = await listMeetingLog(ownerId, { to: today });
  return <MeetingLogView meetings={meetings} today={today} />;
}

/** The Calendar: issue 5's reads, unchanged. */
async function CalendarSection({ ownerId, today }: { ownerId: string; today: string }) {
  // One query for ~6 months. The calendar navigates within this window;
  // revalidation (via server actions) refreshes on any write.
  const fromDate = addDays(today, -7); // a week back
  const toDate = addDays(today, 30 * 6); // six months forward
  const meetings = await getCalendar(ownerId, { from: fromDate, to: toDate });

  // Ghosts (#49): proposed slots past the 8-week materialised edge, drawn from
  // each live group's schedule — not rows. Tapping one materialises it.
  const schedules = await getGroupSchedules(ownerId);
  const ghosts = computeGhosts(schedules, meetings, { from: fromDate, to: toDate }, today);

  return <CalendarView meetings={meetings} ghosts={ghosts} today={today} />;
}
