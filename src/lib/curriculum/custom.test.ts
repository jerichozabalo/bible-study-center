import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { resetCustomBooks } from "../../../tests/curriculum-fixtures";
import { TEST_OWNER, dbConfigured, ensureSchema, resetRoster } from "../../../tests/fixtures";
import { query } from "../db";
import { createGroup, getGroup } from "../roster/groups";
import { bookLabel, getBook, getOwnBook, listBooks, listOwnBooks } from "./books";
import { CurriculumValidationError, createBook, updateBook } from "./custom";
import { seedCurriculum } from "./seed";

/**
 * Books Jericho wrote himself (#22) at the module boundary.
 *
 * The point of the issue is not that a custom book can be stored — it is that
 * nothing downstream can tell the difference, so most of what is asserted here
 * is that a custom book reads exactly like a seeded one.
 */
describe.skipIf(!dbConfigured)("custom books", () => {
  beforeAll(async () => {
    await ensureSchema();
    await seedCurriculum();
  });

  beforeEach(async () => {
    await resetCustomBooks();
  });

  // And again at the end: `seed.test.ts` asserts that the curriculum is exactly
  // the eight GLC books, so a custom book left behind by the last test in this
  // file fails a file that has nothing wrong with it.
  afterAll(async () => {
    await resetCustomBooks();
  });

  const parables = {
    title: "Kingdom Parables",
    sessions: [
      { id: null, title: "The Sower" },
      { id: null, title: "The Wheat and the Weeds" },
      { id: null, title: "The Mustard Seed" },
    ],
  };

  it("creates a book with its sessions in the order they were typed", async () => {
    const id = await createBook(TEST_OWNER, parables);

    const book = await getBook(id);

    expect(book).toMatchObject({ title: "Kingdom Parables", sessionCount: 3 });
    expect(book?.sessions.map((session) => [session.number, session.title])).toEqual([
      [1, "The Sower"],
      [2, "The Wheat and the Weeds"],
      [3, "The Mustard Seed"],
    ]);
  });

  it("belongs to no program and carries no published number (#33)", async () => {
    const id = await createBook(TEST_OWNER, parables);

    const book = await getBook(id);

    expect(book?.programName).toBeNull();
    expect(book?.number).toBeNull();
    // A custom book is simply its own title — there is no "Book n" to prefix.
    expect(bookLabel(book!)).toBe("Kingdom Parables");
  });

  it("stamps the owner, which seeded books never carry (#32)", async () => {
    const id = await createBook(TEST_OWNER, parables);

    expect((await listOwnBooks(TEST_OWNER)).map((book) => book.id)).toEqual([id]);
    expect(await listOwnBooks("someone.else@example.com")).toEqual([]);
    // The GLC rows belong to no one, so nobody's own list can reach them.
    expect((await listOwnBooks(TEST_OWNER)).every((book) => book.number === null)).toBe(true);
  });

  it("appears in the picker after the seeded curriculum", async () => {
    const id = await createBook(TEST_OWNER, parables);

    const books = await listBooks();

    expect(books).toHaveLength(9);
    expect(books.at(-1)).toMatchObject({ id, title: "Kingdom Parables", programName: null });
  });

  it("trims what was typed and refuses what cannot be saved", async () => {
    await expect(createBook(TEST_OWNER, { ...parables, title: "   " })).rejects.toBeInstanceOf(
      CurriculumValidationError,
    );
    // #5 is strict completion — a book with no sessions would be complete the
    // moment it was adopted, which is not a book.
    await expect(createBook(TEST_OWNER, { ...parables, sessions: [] })).rejects.toBeInstanceOf(
      CurriculumValidationError,
    );
    await expect(
      createBook(TEST_OWNER, { ...parables, sessions: [{ id: null, title: "  " }] }),
    ).rejects.toBeInstanceOf(CurriculumValidationError);

    const id = await createBook(TEST_OWNER, {
      title: "  Kingdom Parables  ",
      sessions: [{ id: null, title: "  The Sower  " }],
    });
    const book = await getBook(id);

    expect(book?.title).toBe("Kingdom Parables");
    expect(book?.sessions[0].title).toBe("The Sower");
  });

  it("hands the edit screen only the leader's own books", async () => {
    const id = await createBook(TEST_OWNER, parables);
    const seeded = (await listBooks()).find((book) => book.number === 1)!;

    expect(await getOwnBook(TEST_OWNER, id)).toMatchObject({ title: "Kingdom Parables" });
    expect(await getOwnBook("someone.else@example.com", id)).toBeNull();
    // A seeded book is CCF's published material, not Jericho's to rewrite.
    expect(await getOwnBook(TEST_OWNER, seeded.id)).toBeNull();
    expect(await getOwnBook(TEST_OWNER, "not-a-uuid")).toBeNull();
  });

  describe("editing", () => {
    it("renames the book and its sessions in place", async () => {
      const id = await createBook(TEST_OWNER, parables);
      const before = await getBook(id);

      await updateBook(TEST_OWNER, id, {
        title: "Parables of the Kingdom",
        sessions: [
          { id: before!.sessions[0].id, title: "The Sower and the Soils" },
          { id: before!.sessions[1].id, title: "The Wheat and the Weeds" },
          { id: before!.sessions[2].id, title: "The Mustard Seed" },
        ],
      });

      const after = await getBook(id);

      expect(after?.title).toBe("Parables of the Kingdom");
      expect(after?.sessions.map((session) => session.title)).toEqual([
        "The Sower and the Soils",
        "The Wheat and the Weeds",
        "The Mustard Seed",
      ]);
      // Same rows, not replacements: a completion (issue 9) points at a session
      // id, and a correction to the wording must not cost anyone their history.
      expect(after?.sessions.map((session) => session.id)).toEqual(
        before?.sessions.map((session) => session.id),
      );
    });

    it("adds a session after the last one", async () => {
      const id = await createBook(TEST_OWNER, parables);
      const before = await getBook(id);

      await updateBook(TEST_OWNER, id, {
        title: before!.title,
        sessions: [
          ...before!.sessions.map((session) => ({ id: session.id, title: session.title })),
          { id: null, title: "The Pearl of Great Price" },
        ],
      });

      const after = await getBook(id);

      expect(after?.sessionCount).toBe(4);
      expect(after?.sessions.map((session) => [session.number, session.title])).toEqual([
        [1, "The Sower"],
        [2, "The Wheat and the Weeds"],
        [3, "The Mustard Seed"],
        [4, "The Pearl of Great Price"],
      ]);
    });

    it("tombstones a removed session rather than erasing it (#24)", async () => {
      const id = await createBook(TEST_OWNER, parables);
      const before = await getBook(id);
      const removed = before!.sessions[1];

      await updateBook(TEST_OWNER, id, {
        title: before!.title,
        sessions: [
          { id: before!.sessions[0].id, title: before!.sessions[0].title },
          { id: before!.sessions[2].id, title: before!.sessions[2].title },
        ],
      });

      const after = await getBook(id);

      expect(after?.sessionCount).toBe(2);
      expect(after?.sessions.map((session) => session.title)).toEqual([
        "The Sower",
        "The Mustard Seed",
      ]);
      // Read straight from the table: the point of a tombstone is that the row
      // is still there for whatever already pointed at it.
      const rows = await query<{ retired_at: Date | null }>(
        "SELECT retired_at FROM sessions WHERE id = $1",
        [removed.id],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].retired_at).not.toBeNull();
    });

    it("never re-uses a tombstoned session's number", async () => {
      const id = await createBook(TEST_OWNER, parables);
      const before = await getBook(id);

      // Drop the last session, then add another one. Numbers are identities,
      // not positions — 3 stays spent, and the new session is 4.
      await updateBook(TEST_OWNER, id, {
        title: before!.title,
        sessions: before!.sessions.slice(0, 2).map((s) => ({ id: s.id, title: s.title })),
      });
      const trimmed = await getBook(id);
      await updateBook(TEST_OWNER, id, {
        title: trimmed!.title,
        sessions: [
          ...trimmed!.sessions.map((s) => ({ id: s.id, title: s.title })),
          { id: null, title: "The Hidden Treasure" },
        ],
      });

      const after = await getBook(id);

      expect(after?.sessions.map((session) => [session.number, session.title])).toEqual([
        [1, "The Sower"],
        [2, "The Wheat and the Weeds"],
        [4, "The Hidden Treasure"],
      ]);
    });

    it("refuses a book that is not the leader's own", async () => {
      const id = await createBook(TEST_OWNER, parables);
      const seeded = (await listBooks()).find((book) => book.number === 1)!;
      const detail = await getBook(id);
      const sessions = detail!.sessions.map((s) => ({ id: s.id, title: s.title }));

      await expect(
        updateBook("someone.else@example.com", id, { title: "Mine now", sessions }),
      ).rejects.toBeInstanceOf(CurriculumValidationError);
      await expect(
        updateBook(TEST_OWNER, seeded.id, { title: "Rewritten", sessions: [] }),
      ).rejects.toBeInstanceOf(CurriculumValidationError);

      expect((await getBook(id))?.title).toBe("Kingdom Parables");
      expect((await getBook(seeded.id))?.title).toBe("One By One");
    });

    it("refuses a session that belongs to another book", async () => {
      const id = await createBook(TEST_OWNER, parables);
      const other = await createBook(TEST_OWNER, {
        title: "Another Book",
        sessions: [{ id: null, title: "Its Only Session" }],
      });
      const stolen = (await getBook(other))!.sessions[0];

      await expect(
        updateBook(TEST_OWNER, id, {
          title: "Kingdom Parables",
          sessions: [{ id: stolen.id, title: "Renamed From Elsewhere" }],
        }),
      ).rejects.toBeInstanceOf(CurriculumValidationError);

      expect((await getBook(other))?.sessions[0].title).toBe("Its Only Session");
    });

    it("refuses a book with nothing left in it", async () => {
      const id = await createBook(TEST_OWNER, parables);

      await expect(
        updateBook(TEST_OWNER, id, { title: "Kingdom Parables", sessions: [] }),
      ).rejects.toBeInstanceOf(CurriculumValidationError);

      expect((await getBook(id))?.sessionCount).toBe(3);
    });
  });

  describe("downstream", () => {
    beforeEach(async () => {
      await resetRoster();
    });

    it("can be a BGroup's current book, twelve sessions and all (#17/#68)", async () => {
      const id = await createBook(TEST_OWNER, {
        title: "Walking Through Romans",
        // Twelve, the length of Book 8 — the case #68's dot-wrapping exists for
        // and the one no artboard renders.
        sessions: Array.from({ length: 12 }, (_, index) => ({
          id: null,
          title: `Romans ${index + 1}`,
        })),
      });

      const groupId = await createGroup(TEST_OWNER, {
        name: "BGroup Sabado",
        weekday: 6,
        startTime: "16:00",
        durationMinutes: 90,
        currentBookId: id,
      });

      expect(await getGroup(TEST_OWNER, groupId)).toMatchObject({
        currentBookId: id,
        currentBookNumber: null,
        currentBookTitle: "Walking Through Romans",
        currentBookSessionCount: 12,
      });
    });

    it("reads exactly like a seeded book, field for field", async () => {
      // What prefill (#53), strict completion (#5) and catch-up matching (#31)
      // will each call. None of them exist yet; what this guards is that the
      // curriculum side hands them nothing shaped differently.
      const custom = await getBook(await createBook(TEST_OWNER, parables));
      const seeded = await getBook((await listBooks()).find((book) => book.number === 8)!.id);

      expect(Object.keys(custom!).sort()).toEqual(Object.keys(seeded!).sort());
      expect(Object.keys(custom!.sessions[0]).sort()).toEqual(
        Object.keys(seeded!.sessions[0]).sort(),
      );
      expect(custom!.sessions).toHaveLength(custom!.sessionCount);
      expect(custom!.sessions.map((session) => session.number)).toEqual([1, 2, 3]);
    });
  });
});
