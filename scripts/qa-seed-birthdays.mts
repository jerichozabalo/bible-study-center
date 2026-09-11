/**
 * Seed the TEST Neon branch with birthday-card data (bst-v1.1 issue 3).
 *
 * Forces DATABASE_URL to TEST_DATABASE_URL before anything imports the db
 * layer, then gives the QA owner three celebrants for the CURRENT week —
 * computed in Manila, so it works whatever day this is run:
 *
 *   - "Nena Villamor" (nickname "Nena") — birthday on today itself
 *   - "Ben Cruz" — birthday tomorrow (or Sunday if run on a Saturday)
 *   - "Cara Dio" — a removed person with a birthday this week (#24: out)
 *
 * Run:  DATABASE_URL="$TEST_DATABASE_URL" npx tsx scripts/qa-seed-birthdays.mts
 * (or with the dotenv line below, just: npx tsx scripts/qa-seed-birthdays.mts)
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

if (!process.env.TEST_DATABASE_URL) {
  console.error("TEST_DATABASE_URL is not set in .env.local");
  process.exit(1);
}
// The db layer reads DATABASE_URL at import time — set it before importing.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

/** The owner the local server session belongs to — the allowlisted address
 * (override with QA_OWNER if your .env.local allows a different one). */
const OWNER = process.env.QA_OWNER ?? "jerichozabalo0301@gmail.com";

const { createPerson, removePerson } = await import("../src/lib/roster/people");
const { getBirthdayCelebrants } = await import("../src/lib/insights/birthdays");
const { manilaToday } = await import("../src/lib/dates");

const today = manilaToday();
const [y, m, d] = today.split("-").map(Number);
const nextDay = (offset: number) => {
  const shifted = new Date(Date.UTC(y, m - 1, d + offset));
  return shifted.toISOString().slice(0, 10);
};

const nena = await createPerson(OWNER, {
  name: "Nena Villamor",
  nickname: "Nena",
  birthday: `1990-${today.slice(5)}`,
});
const ben = await createPerson(OWNER, { name: "Ben Cruz", birthday: `1988-${nextDay(1).slice(5)}` });
const cara = await createPerson(OWNER, { name: "Cara Dio", birthday: `1992-${today.slice(5)}` });
await removePerson(OWNER, cara);

const week = await getBirthdayCelebrants(OWNER, today);
console.log(
  `today ${today} · seeded ${nena} / ${ben} / ${cara} (removed)\n` +
    `card sees: ${week.map((c) => `${c.name} (${c.nickname ?? "no nickname"}) ${c.celebratingOn} turns ${c.turns}`).join(" | ")}`,
);
