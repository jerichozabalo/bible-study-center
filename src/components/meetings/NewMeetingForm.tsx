"use client";

/**
 * The [+] tab's form — `design/NewMeeting.dc.html`, section for section: GROUP
 * cards, DATE, TIME, LESSON (with the fellowship-night state), NOTES.
 *
 * Three departures from that board, all of them decisions it predates:
 *
 * - Its TIME row's "Change" is drawn but does nothing. #36 makes the override
 *   real, so Change opens a time and a length under the row and the note says
 *   which of the two you are looking at.
 * - Its NOTES box is a styled `div` with placeholder text in it. #55 makes it a
 *   real field, and #54 makes it the only place a moved venue is recorded.
 * - It draws no recurring option at all, and #48 says the create form is one of
 *   the two places a group's schedule can be set. That toggle sits under TIME,
 *   where the day and the hour it would save are both already on screen.
 *
 * The board also pins "Create meeting" to a bottom bar. Under #62 the tab bar
 * is there, so the button sits at the end of the form — the same move
 * `GroupForm` made.
 *
 * A client component because the whole screen is one interaction: picking a
 * group rewrites the agenda below it, and a round trip per tap would make the
 * form feel like a website.
 */
import { useActionState, useState } from "react";

import type { MeetingFormState } from "@/lib/meetings/actions";
import type { PickerGroup } from "@/lib/meetings/prefill";
import {
  moreLabel,
  pickerMetaLine,
  pickerScheduleLine,
  visibleGroups,
} from "@/lib/meetings/picker";
import { formatLongDate, weekdayOf } from "@/lib/dates";
import { formatDuration, formatTime, weekdayPlural } from "@/lib/roster/schedule";

/** The lengths a BGroup night actually runs, in minutes — `GroupForm`'s list. */
const DURATIONS = [45, 60, 75, 90, 105, 120, 150, 180];

const EYEBROW = "text-[11px] font-bold tracking-[0.13em] text-tan";
const CARD = "w-full rounded-[18px] border-[1.5px] border-line bg-card px-[14px] py-[13px]";
const PILL =
  "flex h-11 shrink-0 items-center rounded-[13px] bg-shell px-[15px] text-[14px] font-bold text-ink";
const FIELD =
  "h-[54px] rounded-[16px] border-[1.5px] border-line bg-card px-[13px] text-[15.5px] font-semibold text-ink";

type DateChoice = "today" | "yesterday" | "pick";

export function NewMeetingForm({
  action,
  groups,
  today,
  yesterday,
}: {
  action: (state: MeetingFormState, formData: FormData) => Promise<MeetingFormState>;
  groups: PickerGroup[];
  /** Both computed on the server: the phone's clock is not the record (#56). */
  today: string;
  yesterday: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  // The pre-filled group is the first one — #63 orders them so that is the one
  // most recently met with.
  const [selectedId, setSelectedId] = useState(groups[0].id);
  const [expanded, setExpanded] = useState(false);
  const [dateChoice, setDateChoice] = useState<DateChoice>("today");
  const [pickedDate, setPickedDate] = useState(today);
  const [override, setOverride] = useState<{ startTime: string; durationMinutes: number } | null>(
    null,
  );
  const [lessonOn, setLessonOn] = useState(groups[0].prefill.sessionId !== null);
  const [sessionId, setSessionId] = useState<string | null>(groups[0].prefill.sessionId);
  const [repeatWeekly, setRepeatWeekly] = useState(false);

  const selected = groups.find((group) => group.id === selectedId) ?? groups[0];
  const shown = visibleGroups(groups, selectedId, expanded);
  const expander = moreLabel(groups.length, expanded);

  // `pickedDate ||` because a cleared native date input reads as an empty
  // string, and every line below formats this date rather than checking it.
  const date =
    dateChoice === "today" ? today : dateChoice === "yesterday" ? yesterday : pickedDate || today;
  const startTime = override?.startTime ?? selected.prefill.startTime;
  const durationMinutes = override?.durationMinutes ?? selected.prefill.durationMinutes;

  function pickGroup(group: PickerGroup) {
    setSelectedId(group.id);
    // The agenda, the hour and the lesson toggle all belong to the group, so
    // they follow the pick rather than surviving it (#53/#36).
    setSessionId(group.prefill.sessionId);
    setLessonOn(group.prefill.sessionId !== null);
    setOverride(null);
  }

  return (
    <form action={formAction} className="pt-1 pb-2">
      <input type="hidden" name="groupId" value={selected.id} />
      <input type="hidden" name="date" value={date} />
      {/* The time and duration fields carry their own names and only exist
          while an override is open — posting nothing is what "inherit the
          group's hour" means to the module (#36). */}
      {lessonOn && selected.prefill.bookId ? (
        <>
          <input type="hidden" name="bookId" value={selected.prefill.bookId} />
          <input type="hidden" name="sessionId" value={sessionId ?? ""} />
        </>
      ) : null}
      {repeatWeekly ? <input type="hidden" name="repeatWeekly" value="on" /> : null}

      {state.error ? <FormError message={state.error} /> : null}

      <div className={EYEBROW}>GROUP</div>
      <div className="mt-[9px] flex flex-col gap-[8px]">
        {shown.map((group) => (
          <GroupCard
            key={group.id}
            group={group}
            selected={group.id === selected.id}
            onPick={() => pickGroup(group)}
          />
        ))}
        {expander ? (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex h-11 w-full items-center justify-center gap-[7px] rounded-[16px] text-[14px] font-bold text-blue active:bg-shell"
          >
            {expander}
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1D4E89"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={expanded ? "m18 15-6-6-6 6" : "m6 9 6 6 6-6"} />
            </svg>
          </button>
        ) : null}
      </div>

      <div className={`${EYEBROW} mt-[22px]`}>DATE</div>
      <div className="mt-[9px] flex gap-[8px]">
        {(
          [
            ["today", "Today"],
            ["yesterday", "Yesterday"],
            ["pick", "Pick a date"],
          ] as const
        ).map(([choice, label]) => (
          <button
            key={choice}
            type="button"
            aria-pressed={dateChoice === choice}
            onClick={() => setDateChoice(choice)}
            className={`flex h-[54px] grow items-center justify-center rounded-[16px] border-2 text-[14.5px] font-bold ${
              dateChoice === choice
                ? "border-blue bg-blue text-white"
                : "border-line bg-card text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {dateChoice === "pick" ? (
        <input
          type="date"
          aria-label="Date"
          value={pickedDate}
          onChange={(event) => setPickedDate(event.target.value)}
          className={`${FIELD} mt-[8px] w-full`}
        />
      ) : null}
      <div className="mt-[9px] text-[13.5px] text-slate">
        {formatLongDate(date)}
        {date < today ? " — backdated" : ""}
      </div>

      <div className={`${EYEBROW} mt-[22px]`}>TIME</div>
      <div className={`${CARD} mt-[9px] flex items-center justify-between gap-[10px]`}>
        <div className="min-w-0">
          <div className="text-[15.5px] font-bold">
            {formatTime(startTime)} · {formatDuration(durationMinutes)}
          </div>
          <div className="mt-[2px] text-[13px] text-slate">
            {override ? "Set for this meeting only" : `From ${selected.name}'s schedule`}
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            setOverride(override ? null : { startTime: startTime.slice(0, 5), durationMinutes })
          }
          className={`${PILL} active:bg-line`}
        >
          {override ? "Undo" : "Change"}
        </button>
      </div>
      {override ? (
        <div className="mt-[8px] flex gap-[8px]">
          <input
            type="time"
            name="startTime"
            aria-label="Start time"
            value={override.startTime}
            onChange={(event) => setOverride({ ...override, startTime: event.target.value })}
            className={`${FIELD} w-[136px]`}
          />
          <select
            name="durationMinutes"
            aria-label="How long it runs"
            value={override.durationMinutes}
            onChange={(event) =>
              setOverride({ ...override, durationMinutes: Number(event.target.value) })
            }
            className={`${FIELD} grow`}
          >
            {DURATIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatDuration(minutes)}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {/* #48: one recurrence per group, and this is the second place it can be
          set. The note names exactly what would be saved, because this writes to
          the BGroup and not only to tonight. */}
      <button
        type="button"
        onClick={() => setRepeatWeekly(!repeatWeekly)}
        className={`${CARD} mt-[10px] flex items-center gap-[13px]`}
      >
        <span className="min-w-0 grow text-left">
          <span className="block text-[15.5px] font-bold">Every week from now on</span>
          <span className="mt-[2px] block text-[13px] text-slate">
            {repeatWeekly
              ? `${selected.name} meets ${weekdayPlural(weekdayOf(date))} ${formatTime(startTime)}`
              : `Leaves ${selected.name}'s schedule as it is`}
          </span>
        </span>
        <Switch on={repeatWeekly} />
      </button>

      <div className={`${EYEBROW} mt-[22px]`}>LESSON</div>
      <button
        type="button"
        onClick={() => setLessonOn(!lessonOn)}
        className={`${CARD} mt-[9px] flex items-center gap-[13px]`}
      >
        <span className="min-w-0 grow text-left">
          <span className="block text-[15.5px] font-bold">A session was covered</span>
          <span className="mt-[2px] block text-[13px] text-slate">
            {lessonOn ? "Pre-filled from the group" : "No completions will be recorded"}
          </span>
        </span>
        <Switch on={lessonOn} />
      </button>

      {lessonOn ? (
        <LessonPanel
          group={selected}
          sessionId={sessionId}
          onPick={(id) => setSessionId(id)}
        />
      ) : (
        /* The board's amber well. Its wording is #26's promise in one sentence:
           nothing is credited, but everyone ticked still counts as contact, so
           the quiet list (#64) stays honest. */
        <div className="mt-[12px] rounded-[20px] bg-amber-well px-4 py-[15px]">
          <div className="text-[15px] font-bold text-amber-ink">Fellowship, prayer or a party</div>
          <div className="mt-[5px] text-[14px] leading-[1.45] text-amber-ink">
            No session completions are recorded — but everyone you tick still counts as contact, so
            they stay off the quiet list.
          </div>
        </div>
      )}

      <label className={`${EYEBROW} mt-[22px] block`} htmlFor="meeting-notes">
        NOTES
      </label>
      <textarea
        id="meeting-notes"
        name="notes"
        rows={3}
        placeholder="Where you met if it moved, or anything worth remembering about tonight."
        className={`${CARD} mt-[9px] min-h-[86px] resize-none text-[14.5px] leading-[1.5] text-ink placeholder:text-[#968871b0]`}
      />
      <p className="mt-[7px] text-[12.5px] leading-[1.45] text-tan">
        Optional. This is where a changed venue lives.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="mt-[26px] flex h-[58px] w-full items-center justify-center rounded-[18px] bg-blue text-[17px] font-bold text-white active:bg-blue-deep disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create meeting"}
      </button>
      {/* #47: no future/past split and no prompt — the state is the same
          whatever the date, and the form says so rather than leaving the leader
          to wonder why a backdated night is not marked held. */}
      <p className="mt-[9px] text-center text-[12.5px] leading-[1.45] text-tan">
        Meetings are created as proposed. You mark one held when you take attendance.
      </p>
    </form>
  );
}

function GroupCard({
  group,
  selected,
  onPick,
}: {
  group: PickerGroup;
  selected: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onPick}
      className={`flex w-full items-center gap-3 rounded-[18px] border-2 bg-card px-[14px] py-[13px] ${
        selected ? "border-blue" : "border-line"
      }`}
    >
      <span
        className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[12px] border-2 ${
          selected ? "border-blue bg-blue" : "border-stone"
        }`}
      >
        {selected ? <span className="h-2 w-2 rounded-[5px] bg-card" /> : null}
      </span>
      <span className="min-w-0 grow text-left">
        <span className="block text-[15.5px] font-bold">{group.name}</span>
        <span className="mt-[2px] block text-[13px] text-slate">{pickerScheduleLine(group)}</span>
        <span className="mt-[1px] block text-[12.5px] text-tan">
          {pickerMetaLine(group.memberCount, group.lastHeldDate)}
        </span>
      </span>
    </button>
  );
}

function LessonPanel({
  group,
  sessionId,
  onPick,
}: {
  group: PickerGroup;
  sessionId: string | null;
  onPick: (id: string) => void;
}) {
  if (group.currentBookId === null) {
    return (
      <div className="mt-[12px] rounded-[20px] border-[1.5px] border-line bg-card p-[14px]">
        <div className="text-[15px] font-bold">No book chosen yet</div>
        <p className="mt-[5px] text-[14px] leading-[1.45] text-slate">
          {group.name} has no current book, so there is no session to pre-fill. Set one on the
          BGroup and the agenda fills itself in.
        </p>
      </div>
    );
  }

  // #53's rule made visible: everything before the pre-filled session is what
  // the group has already covered.
  const nextNumber = group.prefill.sessionNumber ?? group.prefill.sessions.length + 1;

  return (
    <div className="mt-[12px] rounded-[20px] border-[1.5px] border-line bg-card p-[14px]">
      <div className="flex items-center justify-between gap-[10px]">
        <div className="min-w-0">
          <div className="text-[11px] font-bold tracking-[0.12em] text-tan">BOOK</div>
          <div className="mt-[3px] text-[15.5px] font-bold">
            {group.currentBookNumber === null
              ? group.currentBookTitle
              : `Book ${group.currentBookNumber} — ${group.currentBookTitle}`}
          </div>
        </div>
      </div>

      <div className="my-[13px] h-px bg-line-soft" />
      <div className="mb-[8px] text-[11px] font-bold tracking-[0.12em] text-tan">SESSION</div>
      <div className="flex flex-col gap-[7px]">
        {group.prefill.sessions.map((session) => {
          const on = session.id === sessionId;
          const covered = session.number < nextNumber;
          return (
            <button
              key={session.id}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(session.id)}
              className={`flex items-center gap-[11px] rounded-[14px] border-[1.5px] px-[11px] py-[10px] ${
                on ? "border-blue bg-blue-tint" : "border-line-soft bg-[#FBF9F5]"
              }`}
            >
              <span
                className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[11px] text-[13.5px] font-bold ${
                  on ? "bg-blue text-white" : "bg-shell text-tan"
                }`}
              >
                {session.number}
              </span>
              <span
                className={`min-w-0 grow text-left text-[14.5px] ${on ? "font-bold" : "font-medium"} ${
                  covered ? "text-tan" : "text-ink"
                }`}
              >
                {session.title}
              </span>
              {covered ? (
                <span className="shrink-0 text-[11.5px] font-bold text-tan">covered</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The board's 54×32 switch, in the theme's own off-track colour. */
function Switch({ on }: { on: boolean }) {
  return (
    <span
      className={`flex h-8 w-[54px] shrink-0 items-center rounded-[18px] p-[3px] ${
        on ? "justify-end bg-blue" : "justify-start bg-track"
      }`}
    >
      <span className="h-[26px] w-[26px] rounded-[14px] bg-card" />
    </span>
  );
}

/** The same attention pair the group form uses for a refusal. */
function FormError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="mb-4 flex items-start gap-[9px] rounded-[18px] bg-amber-well px-4 py-3 text-[14.5px] leading-[1.45] text-amber-ink"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-[2px] shrink-0"
        aria-hidden="true"
      >
        <path d="M12 8v5M12 16.5v.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      </svg>
      {message}
    </p>
  );
}
