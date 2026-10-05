import { beforeAll, describe, expect, it } from "vitest";

import { dbConfigured, ensureSchema } from "../../../tests/fixtures";
import { query } from "../db";
import { getBook, listBooks, listPrograms } from "./books";
import { seedCurriculum } from "./seed";

/**
 * The seed is reference data, so what these tests guard is fidelity, not
 * behaviour: 8 books and 41 sessions exactly as CCF publishes them in the
 * 2025–26 editions (#77), and the same rows however many times the seed runs.
 *
 * The titles are asserted here in full rather than compared to the module the
 * seed reads, because a test that only says "the database matches the constant"
 * passes just as happily when the constant is wrong. These are copied from the
 * new editions' own contents pages by hand (`~/glc-books/glc-latest-2026-10-05`),
 * which is the only check that catches a drifted seed.
 */
describe.skipIf(!dbConfigured)("curriculum seed", () => {
  beforeAll(async () => {
    await ensureSchema();
    await seedCurriculum();
  });

  it("seeds the two GLC programs in order", async () => {
    expect(await listPrograms()).toEqual([
      expect.objectContaining({ name: "GLC 1", position: 1 }),
      expect.objectContaining({ name: "GLC 2", position: 2 }),
    ]);
  });

  it("seeds 8 books and 41 sessions", async () => {
    const books = await listBooks();

    expect(books).toHaveLength(8);
    expect(books.reduce((total, book) => total + book.sessionCount, 0)).toBe(41);
  });

  it("splits the books between the programs — GLC 1 is 1-4, GLC 2 is 5-8", async () => {
    const books = await listBooks();

    expect(books.map((book) => [book.programName, book.number])).toEqual([
      ["GLC 1", 1],
      ["GLC 1", 2],
      ["GLC 1", 3],
      ["GLC 1", 4],
      ["GLC 2", 5],
      ["GLC 2", 6],
      ["GLC 2", 7],
      ["GLC 2", 8],
    ]);
  });

  it("carries the published titles and session counts", async () => {
    const books = await listBooks();

    expect(books.map((book) => [book.title, book.sessionCount])).toEqual([
      ["One By One", 5],
      ["Spiritual Disciplines", 5],
      ["The Holy Spirit", 3],
      ["CCF DNA", 2],
      // #66's exception: CCF's own printed title keeps "DGroup", which the app
      // never uses for anything of its own.
      ["DGroup 101", 3],
      ["Basic Doctrines", 6],
      ["Family Life", 5],
      ["Bible Survey", 12],
    ]);
  });

  it("has no book the artboards invented", async () => {
    // The boards' mock data says "Book 3 — Christian Beliefs". The real Book 3
    // is The Holy Spirit, three sessions. This assertion exists because that
    // mock is the likeliest thing a later change re-seeds from.
    const books = await listBooks();

    expect(books.map((book) => book.title)).not.toContain("Christian Beliefs");
  });

  it("carries a book's sessions in their published order", async () => {
    const books = await listBooks();
    const holySpirit = books.find((book) => book.number === 3)!;

    const detail = await getBook(holySpirit.id);

    expect(detail?.sessions.map((session) => [session.number, session.title])).toEqual([
      [1, "The Person And Works of the Holy Spirit"],
      [2, "The Gifts of the Holy Spirit"],
      [3, "Walking in the Spirit"],
    ]);
  });

  it("carries all twelve sessions of Book 8", async () => {
    // The book #68's dot-wrapping rule exists for, and the one no artboard
    // renders.
    const books = await listBooks();
    const survey = books.find((book) => book.number === 8)!;

    const detail = await getBook(survey.id);

    expect(detail?.sessions.map((session) => session.title)).toEqual([
      "The Importance of Bible Survey",
      "The Pentateuch",
      "Historical Books 1: The Rise to Monarchy",
      "Historical Books 2: The Fall of The Monarchy",
      "Wisdom Literature and Poetry",
      "Major Prophets",
      "Minor Prophets",
      "The New Testament Gospels",
      "The Acts of The Apostles",
      "The Pauline Epistles",
      "General Epistles",
      "Revelation",
    ]);
  });

  it("carries Book 1 the way the 5th edition prints it (#77)", async () => {
    const books = await listBooks();
    const oneByOne = books.find((book) => book.number === 1)!;

    const detail = await getBook(oneByOne.id);

    expect(detail?.sessions.map((session) => [session.number, session.title])).toEqual([
      [1, "One Truth — The Gospel"],
      [2, "One Way — The Savior"],
      [3, "One Proof — Our New Life in Christ"],
      [4, "One Promise — The Assurance of Salvation"],
      [5, "One Pursuit — Living Victoriously in Christ"],
    ]);
  });

  it("tombstones the sessions the new editions removed — nothing is deleted (#77)", async () => {
    // The nine sessions the 2025–26 editions dropped, as (book, session)
    // numbers. The shared test branch has the pre-sync seed in it (the same
    // assumption `migrate.test.ts` makes about its ledger), so every one of
    // these exists as a retired row: kept for whatever already points at it,
    // no longer part of its book.
    const removed = [
      [1, 6],
      [2, 6],
      [3, 4],
      [4, 3],
      [4, 4],
      [5, 4],
      [7, 6],
      [7, 7],
      [7, 8],
    ];

    const rows = await query<{
      book_number: number;
      session_number: number;
      title: string;
      retired: boolean;
    }>(
      `SELECT b.number AS book_number,
              s.number AS session_number,
              s.title,
              (s.retired_at IS NOT NULL) AS retired
         FROM sessions s
         JOIN books b ON b.id = s.book_id
        WHERE b.owner_id IS NULL AND b.program_id IS NOT NULL
        ORDER BY b.number, s.number`,
    );

    const retired = rows.filter((row) => row.retired);

    expect(retired.map((row) => [row.book_number, row.session_number])).toEqual(removed);

    // The tombstone still carries the earlier edition's title, so what already
    // points at it resolves to what was actually covered.
    const oneSix = rows.find((row) => row.book_number === 1 && row.session_number === 6)!;
    expect(oneSix.title).toBe("One Pursuit — Growing in Our Relationship with Christ");

    // 41 live + nine tombstones = the 50 the old editions had.
    expect(rows.filter((row) => !row.retired)).toHaveLength(41);
    expect(rows).toHaveLength(50);
  });

  it("adds nothing when it runs again", async () => {
    const before = await listBooks();

    await seedCurriculum();
    const after = await listBooks();

    // Same rows, same ids: a group's current_book_id survives a re-seed.
    expect(after.map((book) => book.id)).toEqual(before.map((book) => book.id));
    expect(after.reduce((total, book) => total + book.sessionCount, 0)).toBe(41);
  });
});
