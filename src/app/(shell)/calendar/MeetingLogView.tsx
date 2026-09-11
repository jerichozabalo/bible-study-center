/**
 * The meeting log — the Meeting page's default view (bst-v1.2 #1).
 *
 * Every meeting dated today or earlier, Manila (#56), newest first: days
 * descend, and under each day header its nights keep evening order. Future
 * nights and ghosts (#49) are the calendar's business, not the log's.
 *
 * The cards are the agenda's own — the shared `MeetingCard` — so a past-due
 * night's one-tap resolve (#52) and a cancelled night's grey strike (#50)
 * read the same here as there. The cover thumbnails are the log's own gift:
 * one signed thumbnail per night that has photos, drawn right side of the
 * card; the agenda passes none and stays as it was. A server component: its
 * interactivity is links and server-action forms.
 */
import { MeetingCard } from "@/components/meetings/MeetingCard";
import { formatWeekdayDate } from "@/lib/dates";
import { type MeetingSummary } from "@/lib/meetings/meetings";

export function MeetingLogView({
  meetings,
  covers,
  today,
}: {
  meetings: MeetingSummary[];
  /** meetingId → signed cover-thumbnail URL, for nights that have photos. */
  covers: Map<string, string>;
  today: string;
}) {
  if (meetings.length === 0) {
    return (
      <p className="mt-[18px] rounded-[20px] border-[1.5px] border-line bg-card px-4 py-5 text-[14.5px] leading-[1.5] text-slate">
        Nothing here yet — this log fills as nights pass. Upcoming nights are on
        the Calendar.
      </p>
    );
  }

  // The read is already ordered (days newest-first, a day's nights in evening
  // order); just cut it into days for the headers.
  const days: { date: string; meetings: MeetingSummary[] }[] = [];
  for (const meeting of meetings) {
    const last = days[days.length - 1];
    if (last && last.date === meeting.date) last.meetings.push(meeting);
    else days.push({ date: meeting.date, meetings: [meeting] });
  }

  return (
    <div className="mt-[16px] flex flex-col gap-[18px]">
      {days.map((day) => (
        <div key={day.date}>
          <div className="mb-[9px] text-[12px] font-semibold tracking-[0.06em] text-tan">
            {formatWeekdayDate(day.date).toUpperCase()}
          </div>
          <div className="flex flex-col gap-[10px]">
            {day.meetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                today={today}
                photoUrl={covers.get(meeting.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
