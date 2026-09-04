"use client";

/**
 * The attendance sheet — `design/Attendance.dc.html`, row for row: the marked
 * count and its bar, the person cards with their tick ring and their chip, and
 * the dashed "Add someone else" card under them.
 *
 * Four departures from that board, all of them decisions it predates or facts
 * it could not know:
 *
 * - The board pins "Save attendance" to a bottom bar. Under #62 the tab bar is
 *   there, so the button sits at the end of the sheet — the same move
 *   `GroupForm`, `PersonForm` and `NewMeetingForm` all made.
 * - Its footnote reads "Saves on this phone. Uploads when you have signal."
 *   That is #72's outbox, which is issue 11 and does not exist yet. Printing it
 *   now would be a promise the app cannot keep, so the line says what is true
 *   today instead.
 * - Its guest row appears in the list as "Guest (unsaved)" before it has a
 *   name. Server-first (#70) has no unsaved row to draw: the walk-in is named
 *   and saved in one step, through #67's name-only path, and then it is an
 *   ordinary member of the sheet. A real visitor — someone whose home BGroup is
 *   not this one — is an ordinary row too, reading "Nico (BGroup Linggo)" (#31).
 * - Its COVERING panel carries a "Change" pill. There is no screen that edits a
 *   meeting's lesson yet (issue 5), and a control that does nothing is worse
 *   than one that is not drawn.
 *
 * The ticks live in this component until the sheet is saved, which is what the
 * board's counter and its Save button describe — and the shape issue 11's
 * outbox wants: one payload per sheet, not a request per tap.
 */
import { useActionState, useState } from "react";

import { CatchUpList } from "@/components/attendance/CatchUpList";
import { useOutbox } from "@/components/outbox/OutboxProvider";
import type { SheetFormState } from "@/lib/attendance/actions";
import type { CatchUpCandidate } from "@/lib/attendance/catchup";
import type { Mark } from "@/lib/attendance/completions";
import { guestLabel, markChipLabel, parseSheetForm } from "@/lib/attendance/form";
import type { SheetPerson } from "@/lib/attendance/sheet";
import { SHEET_WRITE } from "@/lib/outbox/pending";
import { initialsOf } from "@/lib/roster/display";
import type { PersonSummary } from "@/lib/roster/people";

export function AttendanceSheet({
  action,
  meetingId,
  people,
  roster,
  catchUpCandidates,
  sessionNumber,
  sessionTitle,
  held,
}: {
  action: (state: SheetFormState, formData: FormData) => Promise<SheetFormState>;
  meetingId: string;
  people: SheetPerson[];
  /** The whole roster, for the "Add someone else" search (#31 ride-along). */
  roster: PersonSummary[];
  /** #31 — people from other BGroups missing tonight's session. */
  catchUpCandidates: CatchUpCandidate[];
  /** NULL on a fellowship night (#26) — every tick then credits nothing. */
  sessionNumber: number | null;
  sessionTitle: string | null;
  /** #47 — already held, so this visit is a correction (#24). */
  held: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const outbox = useOutbox();

  // Set once the sheet has been queued on the phone with no signal (#72). The
  // server never saw it; the outbox uploads it on reconnect.
  const [queued, setQueued] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    // The walk-in path creates a person, which needs the server (issue 18).
    // Offline it fails like anything else that needs a connection — no queue.
    if (submitter?.name === "intent" && submitter.value === "walk-in") return;
    // Adding a ride-along (#31) is a server read + write, online-only — it is
    // not the sheet save the outbox carries.
    if (submitter?.name === "rideAlong") return;
    if (typeof navigator === "undefined" || navigator.onLine) return;

    event.preventDefault();
    const form = parseSheetForm(new FormData(event.currentTarget));
    void outbox.enqueue({
      type: SHEET_WRITE,
      payload: { meetingId: form.meetingId, marks: form.marks },
    });
    setQueued(true);
  }

  // The marks the leader has changed since the sheet was drawn. Anyone not in
  // here is at whatever the server last recorded, which is what makes a
  // reopened sheet (#24) start where it left off.
  const [changed, setChanged] = useState<Record<string, Mark | null>>({});
  const [adding, setAdding] = useState(false);
  const [walkInName, setWalkInName] = useState("");
  const [rideAlongSearch, setRideAlongSearch] = useState("");

  // A walk-in or a ride-along comes back as a longer sheet. Closing the card on
  // that rather than on the submit is what keeps it open if the save was
  // refused.
  const [rosterSize, setRosterSize] = useState(people.length);
  if (people.length !== rosterSize) {
    setRosterSize(people.length);
    setAdding(false);
    setWalkInName("");
    setRideAlongSearch("");
  }

  // #31 — the leader's own people not already on tonight's sheet, matched on
  // name or the digits of a number, the same way the People search does.
  const onSheet = new Set(people.map((person) => person.personId));
  const term = rideAlongSearch.trim().toLowerCase();
  const termDigits = term.replace(/\D/g, "");
  const rideAlongMatches =
    term === ""
      ? []
      : roster
          .filter((person) => !onSheet.has(person.id))
          .filter(
            (person) =>
              person.name.toLowerCase().includes(term) ||
              (termDigits !== "" &&
                (person.phone ?? "").replace(/\D/g, "").includes(termDigits)),
          )
          .slice(0, 6);

  const markOf = (person: SheetPerson): Mark | null =>
    person.personId in changed ? changed[person.personId] : person.mark;
  const setMark = (personId: string, mark: Mark | null) =>
    setChanged({ ...changed, [personId]: mark });

  const marked = people.filter((person) => markOf(person) !== null).length;
  const percent = people.length === 0 ? 0 : Math.round((marked / people.length) * 100);

  return (
    <form action={formAction} onSubmit={handleSubmit} className="pb-2">
      <input type="hidden" name="meetingId" value={meetingId} />

      {state.error ? <FormError message={state.error} /> : null}

      {queued ? (
        <p className="mt-3 rounded-[18px] bg-blue-tint px-4 py-3 text-[14px] leading-[1.45] text-blue-deep">
          Saved on this phone. {outbox.pending === 1 ? "1 sheet" : `${outbox.pending} sheets`} waiting
          to upload — it goes up by itself when you have signal.
        </p>
      ) : null}

      <div className="mt-[14px] flex items-center gap-3">
        <div className="shrink-0 text-[15px] font-bold">
          {marked} of {people.length} marked
        </div>
        <div className="h-2 grow overflow-hidden rounded-[5px] bg-line">
          <div className="h-2 rounded-[5px] bg-blue" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-[9px]">
        {people.map((person) => (
          <PersonCard
            key={person.personId}
            person={person}
            mark={markOf(person)}
            sessionNumber={sessionNumber}
            onToggle={() => setMark(person.personId, markOf(person) === null ? "attended" : null)}
            onCycle={() =>
              setMark(
                person.personId,
                markOf(person) === "attended" ? "present-only" : "attended",
              )
            }
          />
        ))}

        {people.length === 0 ? (
          <p className="rounded-[20px] border-[1.5px] border-line bg-card px-4 py-5 text-[14.5px] leading-[1.5] text-slate">
            Nobody is in this BGroup yet. Add whoever is in the room below — a name is enough.
          </p>
        ) : null}

        {adding ? (
          <div className="rounded-[20px] border-[1.5px] border-line bg-card p-[14px]">
            {/* #31 — a ride-along is already on the roster, from another BGroup.
                Adding them writes no new person: the visit is the completion. */}
            <label
              className="text-[11px] font-bold tracking-[0.13em] text-tan"
              htmlFor="ride-along-search"
            >
              ALREADY ON YOUR ROSTER
            </label>
            <input
              id="ride-along-search"
              type="search"
              value={rideAlongSearch}
              autoFocus
              onChange={(event) => setRideAlongSearch(event.target.value)}
              onKeyDown={(event) => {
                // Enter in here would fire the form's first submit; the add
                // buttons below are the only way onto the sheet.
                if (event.key === "Enter") event.preventDefault();
              }}
              placeholder="Search name or number"
              className="mt-[8px] h-[54px] w-full rounded-[16px] border-[1.5px] border-line bg-card px-[13px] text-[15.5px] font-semibold text-ink placeholder:font-normal placeholder:text-[#968871b0]"
            />
            {term === "" ? null : rideAlongMatches.length === 0 ? (
              <p className="mt-[8px] text-[12.5px] leading-[1.45] text-tan">
                Nobody on your roster matches — add them as someone new below.
              </p>
            ) : (
              <div className="mt-[8px] flex flex-col gap-[7px]">
                {rideAlongMatches.map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center gap-3 rounded-[16px] border-[1.5px] border-line bg-[#FBF9F5] px-3 py-[9px]"
                  >
                    <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[14px] bg-blue-tint text-[13px] font-bold text-blue">
                      {initialsOf(person.name)}
                    </span>
                    <span className="min-w-0 grow">
                      <span className="block text-[14.5px] leading-[1.2] font-bold">
                        {person.name}
                      </span>
                      {person.homeGroupName === null ? null : (
                        <span className="mt-[2px] block text-[12.5px] text-slate">
                          {person.homeGroupName}
                        </span>
                      )}
                    </span>
                    <button
                      type="submit"
                      name="rideAlong"
                      value={person.id}
                      disabled={pending}
                      className="shrink-0 rounded-[13px] bg-blue px-[13px] py-[8px] text-[13px] font-bold text-white active:bg-blue-deep disabled:opacity-60"
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="my-[13px] h-px bg-line" />

            {/* #67 — a genuinely new person, saved on a name alone. */}
            <label className="text-[11px] font-bold tracking-[0.13em] text-tan" htmlFor="walk-in">
              SOMEONE NEW
            </label>
            <input
              id="walk-in"
              name="walkInName"
              value={walkInName}
              onChange={(event) => setWalkInName(event.target.value)}
              placeholder="Their name"
              className="mt-[8px] h-[54px] w-full rounded-[16px] border-[1.5px] border-line bg-card px-[13px] text-[15.5px] font-semibold text-ink placeholder:font-normal placeholder:text-[#968871b0]"
            />
            {/* #67 said out loud: a name is enough now, a number is still owed. */}
            <p className="mt-[7px] text-[12.5px] leading-[1.45] text-tan">
              A name is enough. They stay flagged until you add a phone or an email.
            </p>
            <div className="mt-[10px] flex gap-[8px]">
              <button
                type="submit"
                name="intent"
                value="walk-in"
                disabled={pending || walkInName.trim() === ""}
                className="flex h-[50px] grow items-center justify-center rounded-[16px] bg-blue text-[15.5px] font-bold text-white active:bg-blue-deep disabled:opacity-60"
              >
                {pending ? "Saving…" : "Save to the roster"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setWalkInName("");
                  setRideAlongSearch("");
                }}
                className="flex h-[50px] shrink-0 items-center justify-center rounded-[16px] border-[1.5px] border-line px-4 text-[15.5px] font-bold text-slate active:bg-shell"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-3 rounded-[20px] border-[1.5px] border-dashed border-stone bg-card px-3 py-[14px]"
          >
            <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[16px] bg-shell">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#61708A"
                strokeWidth="2.2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className="text-left">
              <span className="block text-[15.5px] font-bold">Add someone else</span>
              <span className="mt-[2px] block text-[13px] text-slate">
                A ride-along or a walk-in guest
              </span>
            </span>
          </button>
        )}
      </div>

      {/* Every row on the sheet posts, ticked or not: an empty value is what
          takes a tick back, and the module tombstones that too (#24). */}
      {people.map((person) => (
        <input
          key={person.personId}
          type="hidden"
          name={`mark:${person.personId}`}
          value={markOf(person) ?? ""}
        />
      ))}

      <button
        type="submit"
        name="intent"
        value="save"
        disabled={pending}
        className="mt-[22px] flex h-[58px] w-full items-center justify-center gap-[9px] rounded-[18px] bg-blue text-[17px] font-bold text-white active:bg-blue-deep disabled:opacity-60"
      >
        <svg
          width="21"
          height="21"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
        {pending ? "Saving…" : held ? "Save corrections" : "Save attendance"}
      </button>
      <p className="mt-[9px] text-center text-[12.5px] leading-[1.45] text-tan">
        {held
          ? "This night is already held. What you change here is saved as a correction."
          : "Saves offline. Uploads when you have signal."}
      </p>

      {/* #31 — inside the form on purpose: "Add to tonight" is a submit that
          carries every tick already made, so a ride-along add cannot wipe the
          leader's unsaved marks. It sits after the sheet because the room comes
          first — the ticks are what the leader opened this screen for. */}
      <CatchUpList
        candidates={catchUpCandidates}
        sessionNumber={sessionNumber}
        sessionTitle={sessionTitle}
        pending={pending}
      />
    </form>
  );
}

function PersonCard({
  person,
  mark,
  sessionNumber,
  onToggle,
  onCycle,
}: {
  person: SheetPerson;
  mark: Mark | null;
  sessionNumber: number | null;
  onToggle: () => void;
  onCycle: () => void;
}) {
  const attended = mark === "attended";
  const sub = person.removedAt
    ? "No longer on the roster"
    : person.contactIncomplete
      ? "No phone or email yet"
      : null;

  return (
    <div
      className={`rounded-[20px] border-[1.5px] px-3 py-[10px] ${
        attended
          ? "border-blue bg-card"
          : mark === "present-only"
            ? "border-[#E0BE86] bg-card"
            : "border-line bg-[#FBF9F5]"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[16px] text-[15px] font-bold ${
            attended ? "bg-blue-tint text-blue" : "bg-shell text-tan"
          }`}
        >
          {initialsOf(person.name)}
        </span>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={mark !== null}
          className="min-w-0 grow text-left"
        >
          {/* #31 — a visitor is an ordinary row that says where they came
              from. There is no guest entity and no second kind of card. */}
          <span className="block text-[16px] leading-[1.2] font-bold">
            {guestLabel(person.name, person.guest ? person.homeGroupName : null)}
          </span>
          {sub ? <span className="mt-[3px] block text-[13px] text-slate">{sub}</span> : null}
        </button>
        <button
          type="button"
          onClick={onToggle}
          aria-label={`Mark ${person.name}`}
          className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[18px] border-2 ${
            attended
              ? "border-blue bg-blue"
              : mark === "present-only"
                ? "border-amber-ink"
                : "border-stone"
          }`}
        >
          {attended ? (
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : mark === "present-only" ? (
            <span className="h-[14px] w-[14px] rounded-[8px] bg-amber-ink" />
          ) : null}
        </button>
      </div>

      {/* #25's second half: the chip is where one tick becomes "she was here
          but did not do the lesson", without a second control on every row. */}
      {mark === null ? null : (
        <button
          type="button"
          onClick={onCycle}
          className={`mt-2 ml-[58px] flex h-[38px] items-center gap-[7px] rounded-[12px] px-[13px] ${
            attended ? "bg-blue-tint" : "bg-amber-well"
          }`}
        >
          <span
            className={`h-[7px] w-[7px] rounded-[4px] ${attended ? "bg-blue" : "bg-amber-ink"}`}
          />
          <span
            className={`text-[13px] font-bold ${attended ? "text-blue-deep" : "text-amber-ink"}`}
          >
            {markChipLabel(mark, sessionNumber)}
          </span>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke={attended ? "#143761" : "#9A5B0B"}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}

/** The same attention pair every other form uses for a refusal. */
function FormError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="mt-3 flex items-start gap-[9px] rounded-[18px] bg-amber-well px-4 py-3 text-[14.5px] leading-[1.45] text-amber-ink"
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
