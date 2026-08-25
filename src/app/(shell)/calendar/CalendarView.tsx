"use client";

/**
 * The interactive calendar view — Week or Month (#5).
 *
 * Server data arrives as props from the page server component; this client
 * component owns the view toggle (Week/Month) and the selected day. Weekday is
 * drawn from each meeting's date, not the group's current weekday (#48b), so a
 * held night keeps its original day after a schedule shift.
 *
 * Past-due proposed meetings (#52) surface a "NEEDS CONFIRMING" pill with
 * Yes / Cancelled buttons that post to `resolveMeetingAction`; cancelled
 * meetings (#50) render greyed and struck through.
 *
 * `design/Calendar.dc.html` is the drawing this file implements.
 */
import { type CalendarEntry } from "@/lib/meetings/calendar";
import { addDays, weekdayOf } from "@/lib/dates";
import {
  resolveMeetingAction,
} from "@/lib/meetings/calendar-actions";
import { WEEKDAY_NAMES, formatTime } from "@/lib/roster/schedule";
import { useState } from "react";

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = [15, 16, 17, 18, 19, 20]; // 3pm–8pm, the artboard's grid origin
const HOUR_H = 44; // px per hour row

export function CalendarView({
  meetings,
  today,
}: {
  meetings: CalendarEntry[];
  today: string;
}) {
  const [view, setView] = useState<"week" | "month">("week");
  const [selectedDate, setSelectedDate] = useState<string>(today);

  return (
    <section className="flex flex-col">
      {/* Header: title + Today + Week/Month toggle */}
      <div className="flex items-center justify-between pb-[6px]">
        <h1 className="text-[26px]">Calendar</h1>
        <div className="flex items-center gap-[8px]">
          <button
            type="button"
            onClick={() => setSelectedDate(today)}
            className="h-[34px] rounded-[12px] border border-line bg-card px-[13px] text-[13px] font-bold text-blue"
          >
            Today
          </button>
          <div className="flex h-[28px] items-center rounded-[12px] bg-shell p-[3px]">
            <button
              type="button"
              onClick={() => setView("week")}
              className={tabClass(view === "week")}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setView("month")}
              className={tabClass(view === "month")}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* Period navigation */}
      <PeriodNav />

      {view === "week" ? (
        <WeekView
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          meetings={meetings}
          today={today}
        />
      ) : (
        <MonthView
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          meetings={meetings}
          today={today}
        />
      )}

      {/* Selected-day agenda */}
      <Agenda selectedDate={selectedDate} meetings={meetings} today={today} />
    </section>
  );
}

function tabClass(selected: boolean): string {
  return (
    "h-[28px] w-[60px] rounded-[9px] text-[12.5px] font-bold " +
    (selected ? "bg-card text-blue" : "text-tan")
  );
}

/** prev / next period + period label */
function PeriodNav() {
  return (
    <div className="flex items-center justify-between pb-[10px]">
      <button
        type="button"
        className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] text-slate"
        aria-label="Previous"
      >
        <ChevronLeftIcon />
      </button>
      <span className="text-[14.5px] font-bold">August 2026</span>
      <button
        type="button"
        className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] text-slate"
        aria-label="Next"
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="m15 18-6-6 6-6"></path>
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="m9 18 6-6-6-6"></path>
    </svg>
  );
}

/**
 * Week view: a day strip across the top, then a time grid showing meeting
 * blocks. The selected day's agenda renders below (see `Agenda`).
 *
 * #58: two groups meeting at the same hour share the column — each block takes
 * a slice of the width.
 */
function WeekView({
  selectedDate,
  onDateChange,
  meetings,
  today,
}: {
  selectedDate: string;
  onDateChange: (date: string) => void;
  meetings: CalendarEntry[];
  today: string;
}) {
  const weekStart = startOfWeek(selectedDate);
  const days = Array.from({ length: 7 }, (_, i) =>
    addDays(weekStart, i),
  );

  return (
    <>
      {/* Day strip — Sunday first (#46) */}
      <div className="flex gap-[2px] px-[2px]">
        <div className="w-[34px] flex-shrink-0" />
        {days.map((day) => {
          const isSel = day === selectedDate;
          const isToday = day === today;
          const dayMeetings = meetings.filter((m) => m.date === day);
          const hasCancelled = dayMeetings.some((m) => m.status === "cancelled");
          return (
            <button
              key={day}
              type="button"
              onClick={() => onDateChange(day)}
              className="flex flex-col items-center gap-[3px] rounded-[12px] px-[4px] py-[5px] text-[13px]"
            >
              <span className={isToday ? "text-blue" : "text-tan"}>
                {WEEKDAYS_SHORT[weekdayOf(day)]}
              </span>
              <span
                className={
                  "flex h-[26px] w-[26px] items-center justify-center rounded-[9px] text-[13.5px] font-bold " +
                  (isSel
                    ? "bg-blue text-white"
                    : isToday
                      ? "bg-blue-tint text-blue"
                      : hasCancelled
                        ? "bg-stone text-tan"
                        : "text-ink")
                }
              >
                {Number(day.slice(8, 10))}
              </span>
            </button>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="mt-[4px] h-[216px] overflow-y-auto">
        <div className="relative h-[272px]">
          <TimeAxis />
          <div className="absolute inset-0 flex gap-[2px]">
            {days.map((day) => {
              const dayMeetings = meetings.filter((m) => m.date === day);
              return <TimeColumn key={day} meetings={dayMeetings} />;
            })}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Month view: a grid of weeks, each cell showing dots for the meetings on that
 * day. Cancelled meetings show a hollow dot (#50).
 */
function MonthView({
  selectedDate,
  onDateChange,
  meetings,
  today,
}: {
  selectedDate: string;
  onDateChange: (date: string) => void;
  meetings: CalendarEntry[];
  today: string;
}) {
  const month = Number(selectedDate.slice(5, 7));
  const year = Number(selectedDate.slice(0, 4));
  const days = monthDays(year, month);

  return (
    <div className="px-[2px]">
      {/* Day-of-week headers, Sunday first (#46) */}
      <div className="flex gap-[2px]">
        {WEEKDAYS_SHORT.map((label) => (
          <div
            key={label}
            className="flex-1 text-center text-[10.5px] font-bold text-tan"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Week rows */}
      {days.map((week, wi) => (
        <div key={wi} className="flex gap-[2px]">
          {week.map((day, di) => {
            const isOther = day.other;
            const dateStr = day.date;
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === today;
            const dayMeetings = meetings.filter((m) => m.date === dateStr);
            return (
              <button
                key={`${wi}-${di}`}
                type="button"
                onClick={() => !isOther && onDateChange(dateStr)}
                disabled={isOther}
                className={
                  "relative flex h-[44px] flex-col items-center justify-center gap-[2px] rounded-[12px] text-[13px] " +
                  (isOther
                    ? "text-slate"
                    : isSelected
                      ? "bg-card text-blue"
                      : "text-ink")
                }
              >
                <span className={isToday ? "font-bold text-blue" : "font-medium"}>
                  {dateStr ? Number(dateStr.slice(8, 10)) : ""}
                </span>
                <span className="flex gap-[2px]">
                  {dayMeetings.slice(0, 3).map((m, i) => (
                    <span
                      key={i}
                      className={
                        "h-[5px] w-[5px] rounded-[3px] " +
                        (m.status === "cancelled"
                          ? "border border-stone bg-transparent"
                          : m.status === "held"
                            ? "bg-mint"
                            : "bg-blue")
                      }
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      ))}

      {/* Legend */}
      <div className="mt-[10px] flex items-center gap-[13px]">
        <span className="flex items-center gap-[5px] text-[10.5px] text-tan">
          <span className="h-[6px] w-[6px] rounded-[3px] bg-blue" />
          scheduled
        </span>
        <span className="flex items-center gap-[5px] text-[10.5px] text-tan">
          <span className="h-[6px] w-[6px] rounded-[3px] border border-stone bg-transparent" />
          not created yet
        </span>
        <span className="flex items-center gap-[5px] text-[10.5px] text-tan">
          <span className="h-[6px] w-[6px] rounded-[3px] bg-stone" />
          cancelled
        </span>
      </div>
      <p className="mt-[6px] text-[10.5px] text-tan">
        Meetings are created 8 weeks ahead. From the materialised edge they show
        hollow — the schedule is known, the meeting is not created yet. Tapping one
        creates it.
      </p>
    </div>
  );
}

/**
 * The agenda for the selected day — the scrollable region under the grid.
 */
function Agenda({
  selectedDate,
  meetings,
  today,
}: {
  selectedDate: string;
  meetings: CalendarEntry[];
  today: string;
}) {
  const dayMeetings = meetings.filter((m) => m.date === selectedDate);

  return (
    <div className="mt-[10px] flex flex-col gap-[10px]">
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-bold text-tan">
          {WEEKDAY_NAMES[weekdayOf(selectedDate)]}, {dayLabel(selectedDate)}
        </span>
        <span className="text-[12.5px] font-medium text-tan">
          {dayMeetings.length === 0
            ? "nothing scheduled"
            : dayMeetings.length === 1
              ? "1 meeting"
              : `${dayMeetings.length} meetings`}
        </span>
      </div>

      {dayMeetings.map((meeting) => (
        <MeetingCard key={meeting.id} meeting={meeting} today={today} />
      ))}

      {/* The "new meeting" ghost action at the bottom of the agenda */}
      <NewMeetingButton date={selectedDate} />
    </div>
  );
}

/**
 * One meeting card in the agenda. Past-due proposed meetings (#52) show the
 * "NEEDS CONFIRMING" pill and the Yes/Cancelled buttons; held meetings show a
 * green check and the attendance count; cancelled meetings are greyed and
 * struck through (#50).
 */
function MeetingCard({ meeting, today }: { meeting: CalendarEntry; today: string }) {
  const isPastDue = meeting.status === "proposed" && meeting.date < today;
  const isCancelled = meeting.status === "cancelled";
  const isHeld = meeting.status === "held";

  const timeStr = formatTime(meeting.startTime);
  const sessionStr =
    meeting.sessionNumber === null
      ? "No session — fellowship night"
      : `Book ${meeting.bookNumber} · Session ${meeting.sessionNumber} — ${meeting.sessionTitle}`;

  // Bar colour, text colour, strikethrough, pill — derived from the status.
  let barColor = "#E7EFF9";
  let nameColor = "#14202E";
  let textDec = "none";
  let pillShow = false;
  let pillLabel = "";
  let pillBg = "#E7EFF9";
  let pillInk = "#1D4E89";

  if (isCancelled) {
    barColor = "#EDEAE3";
    nameColor = "#A4998A";
    textDec = "line-through";
    pillShow = true;
    pillLabel = "CANCELLED";
    pillBg = "#EDEAE3";
    pillInk = "#8B7B63";
  } else if (isHeld) {
    barColor = "#E7EFF9";
    pillShow = true;
    pillLabel = "HELD";
    pillBg = "#E4F1E9";
    pillInk = "#2E7D52";
  } else if (isPastDue) {
    barColor = "#FFFFFF";
    pillShow = true;
    pillLabel = "NEEDS CONFIRMING";
    pillBg = "#FBF0DC";
    pillInk = "#9A5B0B";
  }

  return (
    <div className="rounded-[20px] border-[1.5px] border-line bg-card p-[13px] pb-[14px]">
      <div className="flex items-start gap-[11px]">
        <div className="w-[4px] flex-shrink-0 rounded-[3px]" style={{ backgroundColor: barColor }} />
        <div className="min-w-0 flex-grow">
          <div className="flex items-center gap-[7px]">
            <span
              className="text-[16px] font-bold leading-[1.2]"
              style={{ color: nameColor, textDecoration: textDec }}
            >
              {meeting.groupName}
            </span>
            {pillShow && (
              <span
                className="shrink-0 rounded-[7px] px-[7px] py-[3px] text-[10px] font-bold uppercase"
                style={{ backgroundColor: pillBg, color: pillInk }}
              >
                {pillLabel}
              </span>
            )}
          </div>
          <div
            className="mt-[4px] text-[13.5px] text-slate"
            style={{ textDecoration: textDec }}
          >
            {timeStr} · {sessionStr}
          </div>

          {/* Past-due confirmation buttons (#52) */}
          {isPastDue && <PastDueActions meeting={meeting} />}

          {/* Held meeting: green check + attendance */}
          {isHeld && <HeldFooter attendance="8 of 8 marked" />}
        </div>
      </div>
    </div>
  );
}

/** The Yes / Cancelled buttons that appear under a past-due proposed meeting. */
function PastDueActions({ meeting }: { meeting: CalendarEntry }) {
  return (
    <div className="mt-[12px] border-t border-[#F0E3C8] pt-[12px]">
      <p className="mb-[9px] text-[12.5px] font-semibold text-amber-ink">
        This date has passed. Did it push through?
      </p>
      <div className="flex gap-[8px]">
        <form action={resolveMeetingAction}>
          <input type="hidden" name="groupId" value={meeting.groupId} />
          <input type="hidden" name="date" value={meeting.date} />
          <input type="hidden" name="status" value="held" />
          <button
            type="submit"
            className="flex h-[42px] w-full items-center justify-center rounded-[14px] bg-blue text-[14px] font-bold text-white"
          >
            Yes, mark held
          </button>
        </form>
        <form action={resolveMeetingAction}>
          <input type="hidden" name="groupId" value={meeting.groupId} />
          <input type="hidden" name="date" value={meeting.date} />
          <input type="hidden" name="status" value="cancelled" />
          <button
            type="submit"
            className="flex h-[42px] w-full items-center justify-center rounded-[14px] border border-line bg-card text-[14px] font-bold text-slate"
          >
            Cancelled
          </button>
        </form>
      </div>
    </div>
  );
}

function HeldFooter({ attendance }: { attendance: string }) {
  return (
    <div className="mt-[11px] flex items-center gap-[7px]">
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#2E7D52"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <span className="text-[13px] font-bold text-[#2E7D52]">{attendance}</span>
    </div>
  );
}

/** The "new meeting" CTA at the bottom of the agenda. */
function NewMeetingButton({ date }: { date: string }) {
  return (
    <button
      type="button"
      className="flex h-[54px] w-full items-center justify-center gap-[9px] rounded-[20px] border-[1.5px] border-dashed border-stone text-[14.5px] font-bold text-tan"
    >
      <PlusIcon />
      <span>New meeting on {dayShort(date)}</span>
    </button>
  );
}

function PlusIcon() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#8B7B63"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/**
 * Time grid column for one day. Meeting blocks stack vertically at their hour;
 * when two groups meet at the same hour each takes half the column (#58).
 */
function TimeColumn({ meetings }: { meetings: CalendarEntry[] }) {
  if (meetings.length === 0) return <div className="flex-1" />;

  const START_HOUR = 15; // 3pm, the artboard's grid origin
  const columnWidth = 100 / meetings.length;

  return (
    <div className="relative flex-1">
      {meetings.map((meeting, i) => {
        const hour = Number(meeting.startTime.slice(0, 2));
        const mins = Number(meeting.startTime.slice(3, 5));
        const top = (hour - START_HOUR) * HOUR_H + (mins / 60) * HOUR_H;
        const height = (meeting.durationMinutes / 60) * HOUR_H;

        const isCancelled = meeting.status === "cancelled";
        const bg = isCancelled ? "#EDEAE3" : "#E7EFF9";
        const bar = isCancelled ? "#C9BFAE" : "#1D4E89";
        const ink = isCancelled ? "#A4998A" : "#143761";
        const strike = isCancelled ? "line-through" : "none";

        return (
          <div
            key={meeting.id}
            className="absolute overflow-hidden rounded-[6px] p-[3px] text-[9px] font-bold"
            style={{
              top: `${top}px`,
              height: `${height}px`,
              left: `${i * columnWidth}%`,
              width: `${columnWidth}%`,
              backgroundColor: bg,
              borderLeft: `3px solid ${bar}`,
            }}
          >
            <span style={{ color: ink, textDecoration: strike }}>
              {meetings.length > 1 ? "" : meeting.groupName}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const TimeAxis = () => (
  <>
    {HOURS.map((h, i) => (
      <div
        key={h}
        className="absolute right-[6px] text-[10px] font-medium text-tan"
        style={{ top: `${i * HOUR_H}px`, transform: "translateY(-5px)" }}
      >
        {h > 12 ? `${h - 12}pm` : `${h}am`}
      </div>
    ))}
  </>
);

// ─── Date utilities ──────────────────────────────────────────────
function startOfWeek(date: string): string {
  const day = weekdayOf(date);
  return addDays(date, -day);
}

function dayLabel(date: string): string {
  const d = Number(date.slice(8, 10));
  const m = Number(date.slice(5, 7));
  return `${d} ${monthName(m)}`;
}

function dayShort(date: string): string {
  const day = weekdayOf(date);
  return WEEKDAYS_SHORT[day] + " " + date.slice(8, 10);
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? "";
}

/** One week's worth of days for the month grid, with leading/trailing blanks. */
function monthDays(year: number, month: number): { date: string; other: boolean }[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstDay = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: { date: string; other: boolean }[] = [];

  // Leading blanks from the previous month
  const prevDaysInMonth = new Date(Date.UTC(year, month - 1, 0)).getUTCDate();
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevDaysInMonth - i;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    cells.push({ date: formatISODate(prevYear, prevMonth, d), other: true });
  }

  // Days of this month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: formatISODate(year, month, d), other: false });
  }

  // Trailing blanks from the next month (pad to 35 or 42 cells)
  const totalCells = cells.length + (7 - (cells.length % 7));
  const paddedTotal = totalCells < 35 ? 35 : totalCells;
  while (cells.length < paddedTotal) {
    const nextDay = cells.length - daysInMonth - firstDay + 1;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    cells.push({ date: formatISODate(nextYear, nextMonth, nextDay), other: true });
  }

  // Split into weeks of 7
  const weeks: { date: string; other: boolean }[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return weeks;
}

function formatISODate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
