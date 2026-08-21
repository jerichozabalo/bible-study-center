/**
 * A group's weekly schedule, in words. Day + time + duration live on the group
 * (#36, one recurrence per group per #48); this is the only place that turns
 * them into the line the screens print.
 *
 * Pure functions with no database and no `Intl` locale surprises: the app is
 * English everywhere a leader reads (#29/#66), and a device set to another
 * locale must not start rendering the roster in it.
 */

/** Sunday first, matching #46's calendar and JavaScript's own `getDay()`. */
export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type Schedule = {
  weekday: number;
  /** `HH:MM` or Postgres's `HH:MM:SS` — both arrive here. */
  startTime: string;
  durationMinutes: number;
};

export function weekdayPlural(weekday: number): string {
  return `${WEEKDAY_NAMES[weekday]}s`;
}

export function formatTime(startTime: string): string {
  const [rawHours, rawMinutes] = startTime.split(":");
  const hours = Number(rawHours);
  const minutes = rawMinutes ?? "00";
  const suffix = hours < 12 ? "AM" : "PM";
  // Midnight and noon are both "12" on a wall clock, and `hours % 12` gives 0.
  const clockHours = hours % 12 === 0 ? 12 : hours % 12;

  return `${clockHours}:${minutes.slice(0, 2)} ${suffix}`;
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) return `${rest} min`;
  const hoursText = hours === 1 ? "1 hr" : `${hours} hrs`;
  return rest === 0 ? hoursText : `${hoursText} ${rest} min`;
}

/** "Sundays 4:00 PM · 1 hr 30 min" — the group card's second line. */
export function formatSchedule(schedule: Schedule): string {
  return `${weekdayPlural(schedule.weekday)} ${formatTime(schedule.startTime)} · ${formatDuration(
    schedule.durationMinutes,
  )}`;
}

/**
 * The member pill. A brand new group says "No members yet" rather than
 * "0 members" — the first is a stage, the second reads like a failure.
 */
export function formatMembers(count: number): string {
  if (count === 0) return "No members yet";
  return count === 1 ? "1 member" : `${count} members`;
}
