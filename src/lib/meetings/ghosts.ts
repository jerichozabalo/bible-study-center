/**
 * Ghosts (#49): the calendar draws proposed slots beyond the 8-week
 * materialised horizon straight from each live group's recurring schedule.
 * They are **not rows** — `computeGhosts` derives them for the visible window,
 * and tapping one calls `materializeGhost` to write that single meeting.
 *
 * A ghost only exists where there is no meeting on that (group, date): inside
 * the 8-week horizon every slot is already materialised, so ghosts surface
 * naturally past the edge. A cancelled or held night has a row, so it shows as
 * itself, never as a ghost.
 */
import { addDays, weekdayOf } from "../dates";
import type { CalendarEntry } from "./calendar";
import type { GroupSchedule } from "./calendar";

export type Ghost = {
  groupId: string;
  groupName: string;
  /** `YYYY-MM-DD`, the slot this ghost would create. */
  date: string;
  /** 0 = Sunday (#46). */
  weekday: number;
  /** `HH:MM:SS`. */
  startTime: string;
  durationMinutes: number;
};

/**
 * Every ghost slot in `[from, to]` that has no meeting behind it.
 *
 * `today` clips the start — a ghost is a future affordance, never drawn over a
 * date that has already passed (past-due resolution, #52, is the row's job).
 */
export function computeGhosts(
  schedules: GroupSchedule[],
  meetings: CalendarEntry[],
  range: { from: string; to: string },
  today: string,
): Ghost[] {
  const taken = new Set(meetings.map((m) => `${m.groupId}:${m.date}`));
  const start = range.from > today ? range.from : today;

  const ghosts: Ghost[] = [];
  for (const schedule of schedules) {
    let date = start;
    // Advance to the first occurrence of this group's weekday within the window.
    while (date <= range.to && weekdayOf(date) !== schedule.weekday) {
      date = addDays(date, 1);
    }
    for (; date <= range.to; date = addDays(date, 7)) {
      if (taken.has(`${schedule.id}:${date}`)) continue;
      ghosts.push({
        groupId: schedule.id,
        groupName: schedule.name,
        date,
        weekday: schedule.weekday,
        startTime: schedule.startTime,
        durationMinutes: schedule.durationMinutes,
      });
    }
  }
  return ghosts;
}
