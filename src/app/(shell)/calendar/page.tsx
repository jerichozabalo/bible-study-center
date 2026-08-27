/**
 * The calendar page — issue 5.
 *
 * A Week-first view of the next several weeks, driven by materialised proposed
 * meetings (#7/#49), with the Month view as a switch. Weekday is computed from
 * each meeting's own date (#48b), so a held night from under the old schedule
 * keeps its weekday after a schedule change.
 *
 * The server component reads the calendar data with one query and passes it to
 * the client component, which owns only view state: the Week/Month toggle and
 * the selected day. Taps on past-due proposed meetings fire the server actions
 * from `calendar-actions.ts` and revalidate on return.
 *
 * `design/Calendar.dc.html` draws the layout; this is that drawing.
 */
import { addDays, manilaToday } from "@/lib/dates";
import { getCalendar, getGroupSchedules, materializeSchedule } from "@/lib/meetings/calendar";
import { computeGhosts } from "@/lib/meetings/ghosts";
import { requireUser } from "@/lib/auth/guard";

import { CalendarView } from "./CalendarView";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const user = await requireUser();
  const today = manilaToday();

  // Ensure the forward horizon is populated before reading (#5). The
  // materialiser is idempotent, so this is a no-op when meetings already exist.
  await materializeSchedule(user.email, today);

  // One query for ~6 months. The calendar navigates within this window;
  // revalidation (via server actions) refreshes on any write.
  const fromDate = addDays(today, -7); // a week back
  const toDate = addDays(today, 30 * 6); // six months forward
  const meetings = await getCalendar(user.email, { from: fromDate, to: toDate });

  // Ghosts (#49): proposed slots past the 8-week materialised edge, drawn from
  // each live group's schedule — not rows. Tapping one materialises it.
  const schedules = await getGroupSchedules(user.email);
  const ghosts = computeGhosts(schedules, meetings, { from: fromDate, to: toDate }, today);

  return <CalendarView meetings={meetings} ghosts={ghosts} today={today} />;
}
