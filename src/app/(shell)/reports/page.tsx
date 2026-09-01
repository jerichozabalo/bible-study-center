/**
 * The Reports tab — `design/Reports.dc.html`, with the board's three known
 * stale points corrected (all named in issue 10):
 *
 * - **The tab bar (#62).** The board predates it and pins "Export CSV" full
 *   width to the bottom of the screen, where the tab bar now sits. The Export
 *   control moves into the flow, under each report, the way every other screen
 *   put its actions (GroupForm, the People CTA).
 * - **"Export & back up" → "Export".** "back up" and "Sync" are retired (#66);
 *   CSV out is "Export", nothing else.
 * - **"baptised" → "baptized"** (#66 spelling), and the stat tiles use
 *   situation language — "Stepped away", never "Closed".
 *
 * Person / Group / Roll-up are three routes behind one segmented control (the
 * pattern `SegmentedControl` already carries for People / Groups), so the back
 * button works and a report can be linked to. The person and group pickers are
 * plain GET forms — nothing here needs the browser, and a download in a
 * standalone PWA is fussy enough without adding client navigation to it.
 *
 * Reports may be information-dense (#30's one explicit exception); it is still
 * English everywhere (#29).
 */
import { SessionDots } from "@/components/insights/BookProgressCard";
import { SegmentedControl } from "@/components/SegmentedControl";
import { requireUser } from "@/lib/auth/guard";
import { formatCalendarDayMonth, formatLongDate } from "@/lib/dates";
import { bookStatusLine } from "@/lib/insights/display";
import {
  type GroupReport,
  type PersonReport,
  type Rollup,
  getGroupReport,
  getPersonReport,
  getRollup,
} from "@/lib/insights/reports";
import { initialsOf } from "@/lib/roster/display";
import { listArchivedGroups, listGroups } from "@/lib/roster/groups";
import { listPeople } from "@/lib/roster/people";

/** Reads the session cookie and the roster — never prerendered. */
export const dynamic = "force-dynamic";

type View = "person" | "group" | "rollup";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; person?: string; group?: string }>;
}) {
  const { view: rawView, person: personId, group: groupId } = await searchParams;
  const user = await requireUser();

  const view: View =
    rawView === "group" ? "group" : rawView === "rollup" ? "rollup" : "person";

  return (
    <section className="pb-8">
      <h1 className="mt-[2px] text-[26px]">Reports</h1>

      <SegmentedControl
        current={`/reports?view=${view}`}
        segments={[
          { href: "/reports?view=person", label: "Person" },
          { href: "/reports?view=group", label: "Group" },
          { href: "/reports?view=rollup", label: "Roll-up" },
        ]}
      />

      <div className="mt-[18px]">
        {view === "person" ? (
          <PersonSection ownerId={user.email} personId={personId ?? null} />
        ) : view === "group" ? (
          <GroupSection ownerId={user.email} groupId={groupId ?? null} />
        ) : (
          <RollupSection ownerId={user.email} />
        )}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- person -- */

async function PersonSection({ ownerId, personId }: { ownerId: string; personId: string | null }) {
  const people = await listPeople(ownerId);
  const report = personId ? await getPersonReport(ownerId, personId) : null;

  return (
    <>
      <form method="get" className="flex gap-[8px]">
        <input type="hidden" name="view" value="person" />
        <select
          name="person"
          defaultValue={personId ?? ""}
          className="h-[46px] min-w-0 grow rounded-[14px] border border-line bg-card px-3 text-[14.5px] font-semibold"
        >
          <option value="">Pick a person…</option>
          {people.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="flex h-[46px] shrink-0 items-center justify-center rounded-[14px] bg-blue px-4 text-[14.5px] font-bold text-white active:bg-blue-deep"
        >
          View
        </button>
      </form>

      {report === null ? (
        <EmptyHint>
          {personId
            ? "That person is not on the roster."
            : "Pick a person to see their contact details, progress and attendance history."}
        </EmptyHint>
      ) : (
        <PersonSheet report={report} />
      )}
    </>
  );
}

function PersonSheet({ report }: { report: PersonReport }) {
  const p = report.person;
  const sub = [
    p.homeGroupName,
    p.spiritualStatus,
    p.baptized ? (p.baptizedOn ? `baptized ${formatLongDate(p.baptizedOn)}` : "baptized") : "not yet baptized",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="mt-[16px]">
      <div className="flex items-center gap-[12px] rounded-[20px] border border-line bg-card px-[14px] py-[13px]">
        <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[16px] bg-blue-tint text-[15px] font-bold text-blue">
          {initialsOf(p.name)}
        </div>
        <div className="min-w-0 grow">
          <div className="text-[16px] font-bold">{p.name}</div>
          <div className="mt-[2px] text-[13px] text-slate">{sub}</div>
        </div>
      </div>

      <div className="mt-[12px] rounded-[20px] border border-line bg-card px-[15px] py-1">
        {(
          [
            ["Mobile", p.phone],
            ["Email", p.email],
            ["Birthday", p.birthday ? formatLongDate(p.birthday) : null],
            ["Address", p.address],
            ["Civil status", p.civilStatus],
            ["Invited by", p.invitedBy],
            ["Joined", formatLongDate(p.joinedOn)],
            ["Stepped away", p.steppedAwayOn ? formatLongDate(p.steppedAwayOn) : null],
          ] as [string, string | null][]
        ).map(([label, value], index, all) => (
          <div
            key={label}
            className={`flex items-baseline justify-between gap-[14px] py-3 ${
              index === all.length - 1 ? "" : "border-b border-line-soft"
            }`}
          >
            <span className="shrink-0 text-[13.5px] text-tan">{label}</span>
            <span className="text-right text-[14.5px] font-semibold">{value ?? "—"}</span>
          </div>
        ))}
      </div>

      <h2 className="mt-[22px] mb-[11px] text-[17px]">Progress</h2>
      <div className="flex flex-col gap-[9px]">
        {report.progress.map((book) => (
          <div key={book.bookId} className="rounded-[20px] border border-line bg-card px-[15px] py-[13px]">
            <div className="text-[11px] font-bold tracking-[0.12em] text-tan">
              {book.bookNumber === null ? book.bookTitle : `BOOK ${book.bookNumber} — ${book.bookTitle.toUpperCase()}`}
            </div>
            <div className="mt-[4px] text-[13.5px] text-slate">{bookStatusLine(book)}</div>
            <SessionDots sessions={book.sessions} />
          </div>
        ))}
      </div>

      <h2 className="mt-[22px] mb-[11px] text-[17px]">Attendance</h2>
      {report.attendance.length === 0 ? (
        <EmptyHint>No meetings recorded for this person yet.</EmptyHint>
      ) : (
        <div className="flex flex-col gap-[8px]">
          {report.attendance.map((row, index) => (
            <div
              key={`${row.date}-${index}`}
              className="flex items-center gap-[12px] rounded-[18px] border border-line bg-card px-[14px] py-[11px]"
            >
              <div className="w-[52px] shrink-0 text-[13.5px] font-bold text-blue">
                {formatCalendarDayMonth(row.date)}
              </div>
              <div className="min-w-0 grow">
                <div className="text-[14px] font-semibold">{row.coverage}</div>
                <div className="mt-[2px] text-[12.5px] text-tan">
                  {row.groupName}
                  {row.guest ? " · guest visit" : ""}
                </div>
              </div>
              {row.mark === "present-only" ? (
                <span className="shrink-0 text-[11.5px] font-bold text-tan">PRESENT ONLY</span>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <ExportRow href={`/reports/export?report=person&person=${report.person.id}`} />
    </div>
  );
}

/* ----------------------------------------------------------------- group -- */

async function GroupSection({ ownerId, groupId }: { ownerId: string; groupId: string | null }) {
  const [live, archived] = await Promise.all([listGroups(ownerId), listArchivedGroups(ownerId)]);
  const groups = [...live, ...archived];
  const report = groupId ? await getGroupReport(ownerId, groupId) : null;

  return (
    <>
      <form method="get" className="flex gap-[8px]">
        <input type="hidden" name="view" value="group" />
        <select
          name="group"
          defaultValue={groupId ?? ""}
          className="h-[46px] min-w-0 grow rounded-[14px] border border-line bg-card px-3 text-[14.5px] font-semibold"
        >
          <option value="">Pick a BGroup…</option>
          {groups.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
              {entry.archivedAt ? " (archived)" : ""}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="flex h-[46px] shrink-0 items-center justify-center rounded-[14px] bg-blue px-4 text-[14.5px] font-bold text-white active:bg-blue-deep"
        >
          View
        </button>
      </form>

      {report === null ? (
        <EmptyHint>
          {groupId
            ? "That BGroup is not on your list."
            : "Pick a BGroup to see its meetings, attendance and book progress."}
        </EmptyHint>
      ) : (
        <GroupHistory report={report} />
      )}
    </>
  );
}

function GroupHistory({ report }: { report: GroupReport }) {
  return (
    <div className="mt-[16px]">
      <div className="flex items-baseline justify-between gap-[10px]">
        <span className="text-[16px] font-bold">{report.group.name}</span>
        <span className="shrink-0 text-[13px] font-semibold text-tan">
          {report.heldCount} held · {report.cancelledCount} cancelled
        </span>
      </div>
      <div className="mt-[2px] text-[13px] text-slate">
        {report.group.schedule}
        {report.group.currentBookLabel ? ` · ${report.group.currentBookLabel}` : ""}
        {report.group.archivedAt ? " · archived" : ""}
      </div>

      {report.bookProgress !== null ? (
        <div className="mt-[14px] rounded-[20px] border border-line bg-card px-[15px] py-[13px]">
          <div className="text-[11px] font-bold tracking-[0.12em] text-tan">BOOK PROGRESS</div>
          <div className="mt-[10px] flex flex-col gap-[9px]">
            {report.bookProgress.members.map((member) => (
              <div key={member.personId} className="flex items-baseline justify-between gap-[10px]">
                <span className="min-w-0 text-[14px] font-semibold">{member.name}</span>
                <span className="shrink-0 text-[13px] font-bold text-blue">
                  {member.coveredCount} of {member.sessionCount}
                  {member.complete ? " · complete" : ""}
                </span>
              </div>
            ))}
            {report.bookProgress.members.length === 0 ? (
              <span className="text-[13.5px] text-slate">Nobody calls this their home BGroup yet.</span>
            ) : null}
          </div>
        </div>
      ) : null}

      <h2 className="mt-[22px] mb-[11px] text-[17px]">Meetings</h2>
      {report.meetings.length === 0 ? (
        <EmptyHint>No held or cancelled meetings yet.</EmptyHint>
      ) : (
        <div className="flex flex-col gap-[8px]">
          {report.meetings.map((meeting) => (
            <div
              key={meeting.meetingId}
              className={`rounded-[18px] border px-[14px] py-[11px] ${
                meeting.status === "cancelled"
                  ? "border-line bg-shell"
                  : "border-line bg-card"
              }`}
            >
              <div className="flex items-center gap-[12px]">
                <div
                  className={`w-[52px] shrink-0 text-[13.5px] font-bold ${
                    meeting.status === "cancelled" ? "text-tan" : "text-blue"
                  }`}
                >
                  {formatCalendarDayMonth(meeting.date)}
                </div>
                <div className="min-w-0 grow">
                  <div
                    className={`text-[14px] font-semibold ${
                      meeting.status === "cancelled" ? "text-tan line-through" : ""
                    }`}
                  >
                    {meeting.coverage}
                  </div>
                  <div className="mt-[2px] text-[12.5px] text-tan">
                    {meeting.status === "cancelled"
                      ? "Not counted as held"
                      : `${meeting.attendeeCount} attended`}
                  </div>
                </div>
              </div>
              {meeting.guests.length > 0 ? (
                <div className="mt-[7px] border-t border-line-soft pt-[7px] text-[12.5px] text-slate">
                  Guest {meeting.guests.length === 1 ? "visit" : "visits"}:{" "}
                  {meeting.guests
                    .map((guest) => `${guest.name} (${guest.homeGroupName ?? "no BGroup"})`)
                    .join(", ")}
                </div>
              ) : null}
              {meeting.notes ? (
                <div className="mt-[6px] text-[12.5px] text-tan">{meeting.notes}</div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <ExportRow href={`/reports/export?report=group&group=${report.group.id}`} />
    </div>
  );
}

/* ---------------------------------------------------------------- roll-up -- */

async function RollupSection({ ownerId }: { ownerId: string }) {
  const rollup = await getRollup(ownerId);
  return <RollupView rollup={rollup} />;
}

function RollupView({ rollup }: { rollup: Rollup }) {
  const tiles: { n: number; label: string; sub?: string }[] = [
    { n: rollup.members, label: "Members" },
    {
      n: rollup.activeGroups,
      label: "BGroups",
      sub: rollup.archivedGroups > 0 ? `${rollup.archivedGroups} archived` : undefined,
    },
    { n: rollup.quiet, label: "Quiet" },
    { n: rollup.baptized, label: "Baptized" },
    { n: rollup.steppedAway, label: "Stepped away" },
  ];

  return (
    <div className="mt-[16px]">
      <div className="flex flex-wrap gap-[9px]">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="min-w-[96px] grow basis-[28%] rounded-[18px] bg-blue-tint px-[13px] py-[13px]"
          >
            <div className="font-display text-[28px] font-bold tracking-[-0.03em] text-blue-deep">
              {tile.n}
            </div>
            <div className="mt-[2px] text-[12.5px] font-bold text-blue-deep">{tile.label}</div>
            {tile.sub ? <div className="mt-[1px] text-[11.5px] text-slate">{tile.sub}</div> : null}
          </div>
        ))}
      </div>

      <div className="mt-[14px] rounded-[20px] border border-line bg-card px-[16px] py-[15px]">
        <div className="text-[11px] font-bold tracking-[0.12em] text-tan">BOOKS COMPLETED</div>
        <div className="mt-[13px] flex flex-col gap-[13px]">
          {rollup.books.map((book) => {
            const pct = rollup.members === 0 ? 0 : Math.round((book.completedCount / rollup.members) * 100);
            return (
              <div key={book.bookId}>
                <div className="flex items-baseline justify-between gap-[10px]">
                  <span className="min-w-0 text-[13.5px] font-semibold">
                    Book {book.bookNumber} — {book.bookTitle}
                  </span>
                  <span className="shrink-0 text-[13px] font-bold text-blue">
                    {book.completedCount} {book.completedCount === 1 ? "person" : "people"}
                  </span>
                </div>
                <div className="mt-[6px] h-[8px] overflow-hidden rounded-[5px] bg-shell">
                  <div className="h-[8px] rounded-[5px] bg-blue" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ExportRow href="/reports/export?report=rollup" />
    </div>
  );
}

/* ------------------------------------------------------------------ bits -- */

function ExportRow({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="mt-[20px] flex h-[54px] w-full items-center justify-center gap-[9px] rounded-[17px] border-[2px] border-blue text-[15.5px] font-bold text-blue active:bg-blue-tint"
    >
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#1D4E89"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
      Export CSV
    </a>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-[16px] rounded-[18px] border border-line bg-card px-[15px] py-[16px] text-[14px] leading-[1.45] text-slate">
      {children}
    </p>
  );
}
