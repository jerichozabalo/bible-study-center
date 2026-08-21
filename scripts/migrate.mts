/**
 * `npm run db:migrate` — bring a database up to date and make sure the GLC
 * curriculum is in it.
 *
 * Which database is whichever `DATABASE_URL` is in `.env.local`, so this prints
 * the host it is about to write to before it writes: there are two Neon
 * branches on this project and only one of them is allowed to be wrong.
 *
 * Safe to run repeatedly. Applied migrations are skipped, and the seed upserts.
 */
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  process.exit(1);
}

// The host only — a connection string carries the password.
console.log(`Migrating ${new URL(url).host}`);

const { migrate } = await import("../src/lib/migrate");
const { seedCurriculum } = await import("../src/lib/curriculum/seed");

const applied = await migrate();
if (applied.length === 0) {
  console.log("Schema already up to date.");
} else {
  for (const name of applied) console.log(`Applied ${name}`);
}

await seedCurriculum();
console.log("Curriculum seeded (8 books, 50 sessions).");

// The Neon pool holds an open WebSocket, and nothing above closes it.
process.exit(0);
