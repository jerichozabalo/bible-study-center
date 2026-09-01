/**
 * One person — `design/Person.dc.html`.
 *
 * What the board draws that is not here, and why:
 *
 * - **The Progress section** (dot rows, per-book breakdown) is issue 9: it
 *   needs completions, and inventing dots would be inventing progress.
 * - **The amber "Quiet — missed 3 meetings" panel** is #64's derivation over
 *   held meetings, which issue 6 delivers. The slot is used by the two things
 *   that ARE true today: a contact still owed (#9/#67) and #10's manual
 *   "Stepped away".
 * - The catch-up section names the upcoming meetings that cover a session they
 *   are missing (#31). It is drawn on no board — Person predates the decision —
 *   so it borrows the Home board's catch-up tone: blue, not amber, because
 *   CATCH-UP is a path and not a warning (#66).
 *
 * Everything else is the board's: the avatar and title block, the Call / Text /
 * Email row, the chips, and the label/value card under them.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import { ContactChip } from "@/components/people/PersonRow";
import { type CatchUpTarget, getCatchUpTargets } from "@/lib/attendance/catchup";
import { bookLabel } from "@/lib/curriculum/books";
import { requireUser } from "@/lib/auth/guard";
import { formatDayMonth, formatLongDate, formatWeekdayDate } from "@/lib/dates";
import {
  removePersonAction,
  restorePersonAction,
  setSteppedAwayAction,
} from "@/lib/roster/actions";
import { baptizedLabel, initialsOf } from "@/lib/roster/display";
import { type Membership, getPerson } from "@/lib/roster/people";
import { formatTime } from "@/lib/roster/schedule";

export const dynamic = "force-dynamic";

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const person = await getPerson(user.email, id);

  if (!person) notFound();

  const catchUp = await getCatchUpTargets(user.email, person.id);

  const current = person.memberships.find((membership) => membership.endedOn === null) ?? null;
  const past = person.memberships.filter((membership) => membership.endedOn !== null);

  const details: [string, string][] = [
    ["Mobile", person.phone ?? "—"],
    ["Email", person.email ?? "—"],
    [
      "Birthday",
      person.birthday === null
        ? "—"
        : `${formatLongDate(person.birthday)}${person.age === null ? "" : ` · ${person.age}`}`,
    ],
    ["Address", person.address ?? "—"],
    ["Civil status", person.civilStatus ?? "—"],
    ["Joined", formatLongDate(person.joinedOn)],
  ];

  return (
    <section className="pb-4">
      <div className="flex items-center justify-between">
        <BackChevron />
        <Link
          href={`/people/${person.id}/edit`}
          className="flex h-11 items-center rounded-[14px] px-3 text-[15px] font-bold text-blue active:bg-shell"
        >
          Edit
        </Link>
      </div>

      <div className="flex items-center gap-[14px]">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] bg-blue-tint text-[21px] font-bold text-blue">
          {initialsOf(person.name)}
        </div>
        <div className="min-w-0">
          <h2 className="text-[24px]">{person.name}</h2>
          <div className="mt-[3px] text-[14px] text-slate">
            Joined {formatLongDate(person.joinedOn)}
            {person.invitedBy ? ` · invited by ${person.invitedBy}` : ""}
          </div>
        </div>
      </div>

      {person.removedAt ? (
        <div className="mt-4 rounded-[20px] bg-shell px-4 py-[15px]">
          <div className="text-[15px] font-bold text-slate">
            Removed from the roster {formatDayMonth(person.removedAt)}
          </div>
          <p className="mt-[3px] text-[13.5px] leading-[1.45] text-tan">
            Nothing was deleted. Their record and everything on it is still here.
          </p>
          <form action={restorePersonAction} className="mt-3">
            <input type="hidden" name="id" value={person.id} />
            <button
              type="submit"
              className="flex h-[50px] w-full items-center justify-center rounded-[16px] bg-card text-[15.5px] font-bold text-blue"
            >
              Put back on the roster
            </button>
          </form>
        </div>
      ) : null}

      {person.phone || person.email ? (
        <div className="mt-[14px] flex gap-[8px]">
          {person.phone ? (
            <a
              href={`tel:${person.phone.replace(/\s/g, "")}`}
              className="flex h-[52px] grow items-center justify-center gap-[8px] rounded-[16px] bg-blue text-[14.5px] font-bold text-white active:bg-blue-deep"
            >
              <PhoneIcon />
              Call
            </a>
          ) : null}
          {person.phone ? (
            <a
              href={`sms:${person.phone.replace(/\s/g, "")}`}
              className="flex h-[52px] grow items-center justify-center gap-[8px] rounded-[16px] border-[1.5px] border-line bg-card text-[14.5px] font-bold text-ink active:bg-shell"
            >
              <TextIcon />
              Text
            </a>
          ) : null}
          {person.email ? (
            <a
              href={`mailto:${person.email}`}
              className="flex h-[52px] grow items-center justify-center gap-[8px] rounded-[16px] border-[1.5px] border-line bg-card text-[14.5px] font-bold text-ink active:bg-shell"
            >
              <MailIcon />
              Email
            </a>
          ) : null}
        </div>
      ) : (
        /* #9/#67 — the deferral, said out loud on the one screen where it can
           be fixed. The board's amber panel, carrying what is true today. */
        <div className="mt-[14px] flex items-start gap-[11px] rounded-[18px] bg-amber-well px-[15px] py-[14px]">
          <AlertIcon />
          <div className="min-w-0">
            <div className="text-[15px] font-bold text-amber-ink">No phone or email yet</div>
            <p className="mt-[3px] text-[13.5px] leading-[1.45] text-amber-ink">
              Saved on a name alone, which is how a walk-in gets on the roster. Add a way to reach
              them when you have one.
            </p>
            <Link
              href={`/people/${person.id}/edit`}
              className="mt-[9px] inline-flex h-[42px] items-center rounded-[13px] bg-card px-4 text-[14px] font-bold text-blue"
            >
              Add contact details
            </Link>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-[7px]">
        {person.homeGroupName ? (
          <Chip tone="blue">{person.homeGroupName}</Chip>
        ) : (
          <Chip tone="plain">No BGroup yet</Chip>
        )}
        {person.spiritualStatus ? <Chip tone="blue">{person.spiritualStatus}</Chip> : null}
        <Chip tone={person.baptized ? "blue" : "plain"}>
          {baptizedLabel(person.baptized, person.baptizedOn)}
        </Chip>
        {person.steppedAwayOn ? (
          <Chip tone="plain">Stepped away {formatLongDate(person.steppedAwayOn)}</Chip>
        ) : null}
        {person.contactIncomplete ? <ContactChip /> : null}
      </div>

      <div className="mt-[18px] rounded-[20px] border border-line bg-card px-[15px] py-1">
        {details.map(([label, value], index) => (
          <div
            key={label}
            className={`flex items-baseline justify-between gap-[14px] py-3 ${
              index === details.length - 1 ? "" : "border-b border-line-soft"
            }`}
          >
            <span className="shrink-0 text-[13.5px] text-tan">{label}</span>
            <span className="text-right text-[14.5px] font-semibold">{value}</span>
          </div>
        ))}
      </div>

      {person.notes ? (
        <>
          <h3 className="mt-[22px] mb-[11px] text-[18px]">Notes</h3>
          <p className="rounded-[20px] border border-line bg-card px-[15px] py-[14px] text-[14.5px] leading-[1.5]">
            {person.notes}
          </p>
        </>
      ) : null}

      <h3 className="mt-[22px] mb-[11px] text-[18px]">BGroup</h3>
      <div className="rounded-[20px] border border-line bg-card px-[15px] py-[14px]">
        {current === null ? (
          <p className="text-[14.5px] leading-[1.45] text-slate">
            Not in a BGroup yet. Adding one records the day they joined and the book the group was
            on, which is what keeps a mid-book start readable later.
          </p>
        ) : (
          <CurrentMembership membership={current} />
        )}

        {past.length > 0 ? (
          <div className="mt-[13px] border-t border-line-soft pt-[11px]">
            <div className="text-[11px] font-bold tracking-[0.13em] text-tan">BEFORE THAT</div>
            {past.map((membership) => (
              <div key={membership.id} className="mt-[7px] text-[13.5px] text-slate">
                {membership.groupName} · {formatLongDate(membership.joinedOn)} to{" "}
                {formatLongDate(membership.endedOn ?? "")}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {catchUp.length === 0 ? null : (
        <>
          <h3 className="mt-[22px] mb-[3px] text-[18px]">Catch-up</h3>
          <p className="mb-[11px] text-[13.5px] leading-[1.45] text-slate">
            {catchUp.length === 1 ? "A night" : "Nights"} coming up that{" "}
            {catchUp.length === 1 ? "covers" : "cover"} a session they have not done yet.
          </p>
          <div className="flex flex-col gap-[9px]">
            {catchUp.map((target) => (
              <CatchUpCard key={target.sessionId} target={target} />
            ))}
          </div>
        </>
      )}

      {/* Issue 9's section. Named rather than absent so the screen reads as
          unfinished rather than as missing something. */}
      <h3 className="mt-[22px] mb-[11px] text-[18px]">Progress</h3>
      <div className="rounded-[20px] border border-line bg-card px-4 py-6 text-center">
        <p className="mx-auto max-w-[250px] text-[14.5px] leading-[1.45] text-slate">
          Sessions covered arrive with issue 9, once meetings can be held.
        </p>
      </div>

      {person.removedAt ? null : (
        <div className="mt-[22px] flex flex-col gap-[9px]">
          <form action={setSteppedAwayAction}>
            <input type="hidden" name="id" value={person.id} />
            <input
              type="hidden"
              name="steppedAway"
              value={person.steppedAwayOn ? "false" : "true"}
            />
            <button
              type="submit"
              className="flex h-[54px] w-full items-center justify-center rounded-[17px] border-[1.5px] border-line bg-card text-[15.5px] font-bold text-ink active:bg-shell"
            >
              {person.steppedAwayOn ? "Back in the group" : "Mark as stepped away"}
            </button>
          </form>
          <p className="px-1 text-[12.5px] leading-[1.45] text-tan">
            {person.steppedAwayOn
              ? "They are marked as stepped away, so the quiet list leaves them alone."
              : "Stepped away means you have decided they are not coming for now — the quiet list stops asking about them."}
          </p>
          <form action={removePersonAction}>
            <input type="hidden" name="id" value={person.id} />
            <button
              type="submit"
              className="flex h-[54px] w-full items-center justify-center rounded-[17px] text-[15.5px] font-bold text-tan active:bg-shell"
            >
              Remove from roster
            </button>
          </form>
        </div>
      )}
    </section>
  );
}

/**
 * One upcoming night that covers a gap (#31), in the Home board's catch-up
 * colours. It taps through to that meeting's own sheet, which is where the
 * night is either held or not — the app drafts no invite in v1 (v1.1 owns that,
 * and the leader sends it themselves).
 */
function CatchUpCard({ target }: { target: CatchUpTarget }) {
  return (
    <Link
      href={`/meetings/${target.meetingId}`}
      className="block rounded-[20px] bg-blue-tint px-[15px] py-[13px] active:bg-[#DBE7F6]"
    >
      <div className="text-[15px] font-bold text-blue-deep">
        Session {target.sessionNumber} — {target.sessionTitle}
      </div>
      <div className="mt-[3px] text-[13.5px] leading-[1.45] text-blue-deep">
        {target.groupName} covers it on {formatWeekdayDate(target.date)} at{" "}
        {formatTime(target.startTime)}.
        {/* #31 — another BGroup's night, and the visit credits them all the
            same. Their own BGroup's night needs no explaining. */}
        {target.ownGroup ? "" : " They would be riding along."}
      </div>
      <div className="mt-[6px] text-[12.5px] text-[#4A7BB7]">
        {bookLabel({ number: target.bookNumber, title: target.bookTitle })}
      </div>
    </Link>
  );
}

/** #28 — the joined-at marker, in words. */
function CurrentMembership({ membership }: { membership: Membership }) {
  const book =
    membership.bookTitle === null
      ? null
      : bookLabel({ number: membership.bookNumber, title: membership.bookTitle });

  return (
    <>
      <div className="text-[15.5px] font-bold">
        {membership.groupName}
        {membership.groupArchivedAt ? (
          <span className="ml-[6px] text-[13px] font-bold text-tan">archived</span>
        ) : null}
      </div>
      <div className="mt-[3px] text-[13.5px] leading-[1.45] text-slate">
        Joined this BGroup on {formatLongDate(membership.joinedOn)}
        {book === null ? "." : `, while the group was on ${book}.`}
      </div>
    </>
  );
}

function Chip({ tone, children }: { tone: "blue" | "plain"; children: React.ReactNode }) {
  return (
    <span
      className={`flex h-9 items-center rounded-[12px] px-[13px] text-[13px] font-bold ${
        tone === "blue" ? "bg-blue-tint text-blue-deep" : "bg-shell text-slate"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * The board's own back control, at the top of the person's own screen rather
 * than `BackRow`'s left-aligned pair: this row carries Edit on the right, which
 * is where the board puts it.
 */
function BackChevron() {
  return (
    <Link
      href="/people"
      aria-label="Back"
      className="-ml-[10px] flex h-11 w-11 items-center justify-center rounded-[14px] active:bg-shell"
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#14202E"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m15 18-6-6 6-6" />
      </svg>
    </Link>
  );
}

function PhoneIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#14202E"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 20.5l1.5-4.6A8.4 8.4 0 0 1 3.6 11a8.4 8.4 0 0 1 8.4-8.4h.5A8.4 8.4 0 0 1 21 11z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#14202E"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="16" rx="3" />
      <path d="m2.5 6.5 9.5 6.5 9.5-6.5" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#9A5B0B"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-[1px] shrink-0"
      aria-hidden="true"
    >
      <path d="M12 8v5M12 16.5v.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
