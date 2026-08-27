/**
 * Seed the TEST Neon branch with a calendar worth QA-ing (issue 5).
 *
 * Forces DATABASE_URL to TEST_DATABASE_URL before anything imports the db
 * layer, migrates + seeds the curriculum, wipes this owner's rows, then builds:
 *
 *   - "Alpha BGroup"  — Tuesdays 19:00, Book 1, 3 members
 *   - "Beta BGroup"   — Thursdays 18:30, Book 1, 2 members
 *   - 8 weeks of generated PROPOSED meetings for each (the materialiser)
 *   - one PAST-DUE proposed meeting (last Tuesday) for Alpha
 *   - one CANCELLED future meeting for Alpha
 *
 * Ghosts (beyond the 8-week horizon) are not rows — they show on the calendar
 * on their own once you navigate past the materialised edge.
 *
 * Run:  npx tsx scripts/qa-seed-calendar.mts
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

if (!process.env.TEST_DATABASE_URL) {
  console.error("TEST_DATABASE_URL is not set in .env.local");
  process.exit(1);
}
// The db layer reads DATABASE_URL at import time — set it before importing.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

const OWNER = "leader@example.com";

const { migrate } = await import("../src/lib/migrate");
const { seedCurriculum } = await import("../src/lib/curriculum/seed");
const { query } = await import("../src/lib/db");
const { createGroup } = await import("../src/lib/roster/groups");
const { createPerson } = await import("../src/lib/roster/people");
const { createMeeting } = await import("../src/lib/meetings/meetings");
const { materializeSchedule, cancelMeeting, getCalendar } = await import(
  "../src/lib/meetings/calendar"
);
const { manilaToday, addDays, weekdayOf } = await import("../src/lib/dates");

console.log("host:", new URL(process.env.DATABASE_URL!).host);

await migrate();
await seedCurriculum();

// Clean slate for this owner (test branch only).
await query("DELETE FROM completions WHERE owner_id = $1", [OWNER]);
await query("DELETE FROM meetings WHERE owner_id = $1", [OWNER]);
await query("DELETE FROM group_memberships WHERE owner_id = $1", [OWNER]);
await query("DELETE FROM people WHERE owner_id = $1", [OWNER]);
await query("DELETE FROM groups WHERE owner_id = $1", [OWNER]);

const bookOne = (
  await query<{ id: string }>(
    "SELECT b.id FROM books b JOIN programs p ON p.id = b.program_id WHERE b.number = 1 ORDER BY p.position ASC LIMIT 1",
  )
)[0].id;

const today = manilaToday();

const alpha = await createGroup(OWNER, {
  name: "Alpha BGroup",
  weekday: 2, // Tuesday
  startTime: "19:00",
  durationMinutes: 90,
  currentBookId: bookOne,
});
const beta = await createGroup(OWNER, {
  name: "Beta BGroup",
  weekday: 4, // Thursday
  startTime: "18:30",
  durationMinutes: 90,
  currentBookId: bookOne,
});

for (const name of ["Ana Cruz", "Ben Dizon", "Carlo Reyes"]) {
  await createPerson(OWNER, { name, homeGroupId: alpha });
}
for (const name of ["Dina Santos", "Elias Tan"]) {
  await createPerson(OWNER, { name, homeGroupId: beta });
}

// 8 weeks of PROPOSED generated meetings for both live groups.
await materializeSchedule(OWNER, today);

// One PAST-DUE proposed meeting: the most recent Tuesday that has passed.
let lastTue = addDays(today, -1);
while (weekdayOf(lastTue) !== 2) lastTue = addDays(lastTue, -1);
await createMeeting(OWNER, {
  groupId: alpha,
  date: lastTue,
  startTime: null,
  durationMinutes: null,
  bookId: bookOne,
  sessionId: null,
  notes: null,
  repeatWeekly: false,
});

// Cancel Alpha's second upcoming Tuesday so the calendar has a struck-through
// entry to show.
const upcoming = await getCalendar(OWNER, { from: today, to: addDays(today, 60) });
const alphaFuture = upcoming
  .filter((m) => m.groupId === alpha && m.status === "proposed")
  .map((m) => m.date)
  .sort();
if (alphaFuture[1]) await cancelMeeting(OWNER, alpha, alphaFuture[1]);

const all = await getCalendar(OWNER, { from: addDays(today, -14), to: addDays(today, 90) });
console.log(`\nseeded ${all.length} meetings for ${OWNER}`);
for (const m of all) console.log(`  ${m.date}  ${m.groupName.padEnd(14)} ${m.status.padEnd(9)} ${m.origin}`);
console.log("\ndone — start the app against TEST_DATABASE_URL and QA /calendar");
process.exit(0);
