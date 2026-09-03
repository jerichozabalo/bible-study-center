import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { resetCustomBooks } from "../../../tests/curriculum-fixtures";
import { TEST_OWNER, dbConfigured, ensureSchema, resetRoster } from "../../../tests/fixtures";
import { query } from "../db";
import { createGroup, setCurrentBook } from "../roster/groups";
import { getBook, listBooks, listOwnBooks, listRetiredBooks } from "./books";
import { CurriculumValidationError, createBook, retireBook, unretireBook } from "./custom";
import { seedCurriculum } from "./seed";

/**
 * Retiring a custom book (issue 16) — creation used to be a one-way door.
 *
 * The mirror of `unarchiveGroup` for BGroups: a `retired_at` flag, owner-scoped
 * writes so a seeded GLC book (#32) can never be reached, and a way back. What
 * is asserted here is that a retired book leaves the two lists that *offer* a
 * book without leaving the database, and that nothing about history moves.
 */
describe.skipIf(!dbConfigured)("retiring a custom book", () => {
  beforeAll(async () => {
    await ensureSchema();
    await seedCurriculum();
  });

  beforeEach(async () => {
    await resetRoster();
    await resetCustomBooks();
  });

  // `seed.test.ts` asserts the curriculum is exactly the eight GLC books, so a
  // custom book left behind by the last test here fails a file that is fine.
  afterAll(async () => {
    await resetCustomBooks();
  });

  const parables = {
    title: "Kingdom Parables",
    sessions: [
      { id: null, title: "The Sower" },
      { id: null, title: "The Wheat and the Weeds" },
    ],
  };

  it("takes a retired book out of the main list and the picker, but not getBook", async () => {
    const id = await createBook(TEST_OWNER, parables);

    await retireBook(TEST_OWNER, id);

    expect((await listOwnBooks(TEST_OWNER)).map((book) => book.id)).not.toContain(id);
    expect((await listBooks()).map((book) => book.id)).not.toContain(id);
    // A BGroup that already adopted it still needs its title and sessions drawn.
    expect(await getBook(id)).toMatchObject({ title: "Kingdom Parables", sessionCount: 2 });
  });

  it("lists retired books newest first, for the restore section", async () => {
    const id = await createBook(TEST_OWNER, parables);
    await retireBook(TEST_OWNER, id);

    const retired = await listRetiredBooks(TEST_OWNER);

    expect(retired.map((book) => book.id)).toEqual([id]);
    expect(retired[0].retiredAt).not.toBeNull();
    // Seeded rows belong to no one (#32), so nobody's retired list can reach them.
    expect(await listRetiredBooks("someone.else@example.com")).toEqual([]);
  });

  it("cannot retire a seeded GLC book (#32)", async () => {
    const seeded = (await listBooks()).find((book) => book.number === 1)!;

    await expect(retireBook(TEST_OWNER, seeded.id)).rejects.toBeInstanceOf(
      CurriculumValidationError,
    );
    expect((await listBooks()).map((book) => book.id)).toContain(seeded.id);
  });

  it("cannot retire another leader's book", async () => {
    const id = await createBook(TEST_OWNER, parables);

    await expect(retireBook("someone.else@example.com", id)).rejects.toBeInstanceOf(
      CurriculumValidationError,
    );
    expect((await listOwnBooks(TEST_OWNER)).map((book) => book.id)).toContain(id);
  });

  it("rejects a junk id rather than casting it in SQL", async () => {
    await expect(retireBook(TEST_OWNER, "not-a-uuid")).rejects.toBeInstanceOf(
      CurriculumValidationError,
    );
    await expect(unretireBook(TEST_OWNER, "not-a-uuid")).rejects.toBeInstanceOf(
      CurriculumValidationError,
    );
  });

  it("refuses to retire a book a BGroup currently holds, and names the group", async () => {
    const id = await createBook(TEST_OWNER, parables);
    await createGroup(TEST_OWNER, {
      name: "BGroup Sabado",
      weekday: 6,
      startTime: "16:00",
      durationMinutes: 90,
      currentBookId: id,
    });

    await expect(retireBook(TEST_OWNER, id)).rejects.toThrow(/Kingdom Parables.*BGroup Sabado/);
    expect((await listOwnBooks(TEST_OWNER)).map((book) => book.id)).toContain(id);
  });

  it("names every BGroup that holds it", async () => {
    const id = await createBook(TEST_OWNER, parables);
    for (const name of ["BGroup Sabado", "BGroup Linggo"]) {
      await createGroup(TEST_OWNER, {
        name,
        weekday: 6,
        startTime: "16:00",
        durationMinutes: 90,
        currentBookId: id,
      });
    }

    await expect(retireBook(TEST_OWNER, id)).rejects.toThrow(/BGroup Linggo/);
    await expect(retireBook(TEST_OWNER, id)).rejects.toThrow(/BGroup Sabado/);
  });

  it("retires once every holding BGroup has moved off it", async () => {
    const id = await createBook(TEST_OWNER, parables);
    const other = await createBook(TEST_OWNER, {
      title: "Another Book",
      sessions: [{ id: null, title: "Its Only Session" }],
    });
    const groupId = await createGroup(TEST_OWNER, {
      name: "BGroup Sabado",
      weekday: 6,
      startTime: "16:00",
      durationMinutes: 90,
      currentBookId: id,
    });

    await setCurrentBook(TEST_OWNER, groupId, other);
    await retireBook(TEST_OWNER, id);

    expect((await listOwnBooks(TEST_OWNER)).map((book) => book.id)).not.toContain(id);
  });

  it("puts a retired book back with unretireBook", async () => {
    const id = await createBook(TEST_OWNER, parables);
    await retireBook(TEST_OWNER, id);

    await unretireBook(TEST_OWNER, id);

    expect((await listOwnBooks(TEST_OWNER)).map((book) => book.id)).toContain(id);
    expect((await listBooks()).map((book) => book.id)).toContain(id);
    expect(await listRetiredBooks(TEST_OWNER)).toEqual([]);
  });

  it("unretire is scoped to the owner", async () => {
    const id = await createBook(TEST_OWNER, parables);
    await retireBook(TEST_OWNER, id);

    await unretireBook("someone.else@example.com", id);

    expect(await listRetiredBooks(TEST_OWNER)).toHaveLength(1);
  });

  it("leaves the book's sessions untouched in both directions (#24)", async () => {
    const id = await createBook(TEST_OWNER, parables);
    const before = await query(
      "SELECT id, number, title, retired_at FROM sessions WHERE book_id = $1 ORDER BY number",
      [id],
    );

    await retireBook(TEST_OWNER, id);
    await unretireBook(TEST_OWNER, id);

    const after = await query(
      "SELECT id, number, title, retired_at FROM sessions WHERE book_id = $1 ORDER BY number",
      [id],
    );
    expect(after).toEqual(before);
  });
});
