/**
 * One-off correction (2026-10-12, Jericho's report): generated PROPOSED
 * meetings sat frozen at the session the agenda said the day they were
 * materialised. Dominguez Family finished session 4 and kept "proposing
 * session 4"; every live BGroup had the same drift to some degree, and rows
 * written before #77 could still point at a retired session.
 *
 * The app now recomputes these rows whenever the agenda moves (#78 —
 * `recomputeProposedSessions`); this puts the rows written before that on the
 * same rule, group by group. Scope, the same fence #78 drew: proposed +
 * generated rows only, and only their book_id / session_id / updated_at —
 * never a held or cancelled night, never a human-created meeting.
 *
 * Archived groups are included deliberately: their rows leave every screen
 * (#79), but a correct horizon is what unarchive hands back.
 *
 * Usage (run from the repo root):
 *   npx tsx scripts/fix-proposed-sessions.mts --dry-run          # PRODUCTION, print only
 *   npx tsx scripts/fix-proposed-sessions.mts                    # PRODUCTION write
 *   npx tsx scripts/fix-proposed-sessions.mts --test --dry-run   # the test branch
 *
 * Which database is whichever `DATABASE_URL` is in `.env.local` — the same
 * production branch every other one-off script here writes to; `--test` swaps
 * in `TEST_DATABASE_URL` first (for proving the script itself). Safe to
 * re-run: a second pass finds nothing left to correct.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const useTest = process.argv.includes("--test");
const dryRun = process.argv.includes("--dry-run");

const url = useTest ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
if (!url) {
  console.error(
    useTest
      ? "TEST_DATABASE_URL is not set. Copy .env.example to .env.local and fill it in."
      : "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
  );
  process.exit(1);
}

// The modules below read DATABASE_URL when they first touch the pool; point it
// at the chosen branch before they load.
process.env.DATABASE_URL = url;

console.log(
  `${dryRun ? "Checking" : "Correcting"} proposed sessions on ${new URL(url).host}${useTest ? " (test branch)" : ""}`,
);

const { query } = await import("../src/lib/db");
const { agendaSessionSubquery, recomputeProposedSessions } = await import(
  "../src/lib/meetings/calendar"
);

// The #53 rule, from the one place it is written down — the same string the
// generator and the app's recompute read, so a dry run can never disagree with
// what the write would do.
const agenda = agendaSessionSubquery({
  owner: "$1",
  group: "m.group_id",
  book: "g.current_book_id",
});

const groups = await query<{ id: string; owner_id: string; name: string; archived: boolean }>(
  `SELECT id, owner_id, name, (archived_at IS NOT NULL) AS archived
     FROM groups
    ORDER BY archived_at NULLS FIRST, lower(name) ASC`,
);

let totalRows = 0;
let totalGroups = 0;

for (const group of groups) {
  const rows = await query<{
    date: string;
    old_book: number | null;
    old_session: number | null;
    new_book: number | null;
    new_session: number | null;
  }>(
    `SELECT to_char(m.date, 'YYYY-MM-DD') AS date,
            b.number AS old_book, s.number AS old_session,
            bn.number AS new_book, sn.number AS new_session
       FROM meetings m
       JOIN groups g ON g.id = m.group_id
       LEFT JOIN books b ON b.id = m.book_id
       LEFT JOIN sessions s ON s.id = m.session_id
       LEFT JOIN books bn ON bn.id = g.current_book_id
       LEFT JOIN sessions sn ON sn.id = ${agenda}
      WHERE m.owner_id = $1
        AND m.group_id = $2
        AND m.status = 'proposed'
        AND m.origin = 'generated'
        AND (m.book_id IS DISTINCT FROM g.current_book_id
             OR m.session_id IS DISTINCT FROM ${agenda})
      ORDER BY m.date ASC`,
    [group.owner_id, group.id],
  );

  if (rows.length === 0) continue;

  totalGroups += 1;
  totalRows += rows.length;
  console.log(`\n${group.archived ? "(archived) " : ""}${group.name}  [${group.id}]`);
  for (const row of rows) {
    console.log(
      `  ${row.date}  book ${row.old_book ?? "-"} session ${row.old_session ?? "-"}  ->  book ${row.new_book ?? "-"} session ${row.new_session ?? "-"}`,
    );
  }

  if (!dryRun) {
    await recomputeProposedSessions(group.owner_id, group.id);
  }
}

if (totalRows === 0) {
  console.log("Nothing to correct.");
} else if (dryRun) {
  console.log(
    `\nDRY RUN — would correct ${totalRows} rows across ${totalGroups} groups. Nothing written.`,
  );
} else {
  console.log(`\nDone — corrected ${totalRows} rows across ${totalGroups} groups.`);
}
process.exit(0);
