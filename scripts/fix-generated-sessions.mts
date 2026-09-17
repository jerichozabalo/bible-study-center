/**
 * One-off correction for the #53 generator bug (2026-09-17): every
 * auto-generated PROPOSED meeting used to open on its book's first session,
 * flat, regardless of what the group had already held. `insertGeneratedMeeting`
 * (`src/lib/meetings/calendar.ts`) is fixed going forward; this recomputes the
 * same rule for rows it already wrote wrong and updates them in place.
 *
 * Scope, deliberately narrow:
 * - `status = 'proposed'` only — a HELD or CANCELLED meeting is history and
 *   #24 says history does not rewrite. This never touches one.
 * - `origin = 'generated'` only — a `created` meeting had a session someone
 *   typed on purpose (or the picker's already-correct #53 prefill); this is
 *   not that meeting's business.
 *
 * Which database is whichever `DATABASE_URL` is in `.env.local` — the same
 * production branch every other one-off script here writes to. Run once;
 * safe to re-run (a second pass finds nothing left to correct).
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  process.exit(1);
}

console.log(`Correcting generated sessions on ${new URL(url).host}`);

const { query } = await import("../src/lib/db");

const CORRECT_SESSION = `
  SELECT m2.id,
         m2.group_id,
         to_char(m2.date, 'YYYY-MM-DD') AS date,
         m2.session_id AS old_session_id,
         (SELECT s.id FROM sessions s
           WHERE s.book_id = m2.book_id AND s.retired_at IS NULL
             AND s.number > COALESCE(
               (SELECT s3.number
                  FROM meetings held
                  JOIN sessions s3 ON s3.id = held.session_id
                 WHERE held.owner_id = m2.owner_id
                   AND held.group_id = m2.group_id
                   AND held.book_id = m2.book_id
                   AND held.status = 'held'
                 ORDER BY held.date DESC, held.start_time DESC, held.created_at DESC
                 LIMIT 1),
               0)
           ORDER BY s.number ASC LIMIT 1) AS new_session_id
    FROM meetings m2
   WHERE m2.status = 'proposed' AND m2.origin = 'generated' AND m2.book_id IS NOT NULL
`;

type Row = {
  id: string;
  group_id: string;
  date: string;
  old_session_id: string | null;
  new_session_id: string | null;
};

const candidates = await query<Row>(CORRECT_SESSION);
const wrong = candidates.filter((row) => row.old_session_id !== row.new_session_id);

if (wrong.length === 0) {
  console.log("Nothing to correct.");
  process.exit(0);
}

console.log(`Correcting ${wrong.length} of ${candidates.length} generated proposed meetings:`);
for (const row of wrong) {
  console.log(`  ${row.date}  group ${row.group_id}  ${row.old_session_id ?? "(none)"} -> ${row.new_session_id ?? "(none)"}`);
}

await query(
  `UPDATE meetings SET session_id = correct.new_session_id, updated_at = now()
     FROM (${CORRECT_SESSION}) AS correct
    WHERE meetings.id = correct.id
      AND meetings.session_id IS DISTINCT FROM correct.new_session_id`,
);

console.log("Done.");
process.exit(0);
