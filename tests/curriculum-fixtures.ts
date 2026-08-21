/**
 * Scaffolding for the tests that write curriculum rows (issue 13, #22).
 *
 * Kept apart from `tests/fixtures.ts` because the two clean up opposite halves
 * of the database: that file empties the roster, this one empties only the
 * books Jericho wrote himself. The seeded GLC rows are reference data that
 * every other suite reads — nothing here may touch them.
 */
import { query } from "@/lib/db";

/**
 * Drop every user-created book, sessions included (the `books` -> `sessions`
 * foreign key cascades).
 *
 * `owner_id IS NOT NULL` is the whole safety rule: seeded books belong to no
 * one (#32), so this can never reach them. An unqualified `DELETE FROM books`
 * would take the GLC curriculum with it.
 */
export async function resetCustomBooks(): Promise<void> {
  await query("DELETE FROM books WHERE owner_id IS NOT NULL");
}
