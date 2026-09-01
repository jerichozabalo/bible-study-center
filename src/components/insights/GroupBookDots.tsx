/**
 * How far the BGroup itself has got through its current book —
 * `design/GroupDetail.dc.html`'s row of segments on the blue card.
 *
 * Not the same statement as the Person screen's dots, and deliberately drawn
 * differently: these say "we covered this on one of our nights", not "you have
 * this". Completion is per person, never per group (#2) — the members' own
 * standing is the second half of the line under this row, and the member list
 * below it.
 *
 * #68 applies here too: six per row, so Book 8's twelve segments are two rows
 * rather than twelve 22px slivers.
 */
import { columnsFor } from "@/components/insights/dots";
import type { GroupBookProgress } from "@/lib/insights/progress";

export function GroupBookDots({ sessions }: { sessions: GroupBookProgress["sessions"] }) {
  if (sessions.length === 0) return null;

  return (
    <div className="mt-[13px] grid gap-[5px]" style={columnsFor(sessions.length)}>
      {sessions.map((session) => (
        <div
          key={session.sessionId}
          title={`Session ${session.number} — ${session.title}`}
          className={`h-[8px] rounded-[5px] ${
            session.coveredByGroup ? "bg-white" : "bg-white/25"
          }`}
        />
      ))}
    </div>
  );
}
