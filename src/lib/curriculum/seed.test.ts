import { beforeAll, describe, expect, it } from "vitest";

import { dbConfigured, ensureSchema } from "../../../tests/fixtures";
import { getBook, listBooks, listPrograms } from "./books";
import { seedCurriculum } from "./seed";

/**
 * The seed is reference data, so what these tests guard is fidelity, not
 * behaviour: 8 books and 50 sessions exactly as CCF publishes them
 * (`~/glc-books/GLC-SESSIONS.md`, #33), and the same rows however many times
 * the seed runs.
 *
 * The titles are asserted here in full rather than compared to the module the
 * seed reads, because a test that only says "the database matches the constant"
 * passes just as happily when the constant is wrong. These are copied from the
 * published index by hand, which is the only check that catches a drifted seed.
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

  it("seeds 8 books and 50 sessions", async () => {
    const books = await listBooks();

    expect(books).toHaveLength(8);
    expect(books.reduce((total, book) => total + book.sessionCount, 0)).toBe(50);
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
      ["One By One", 6],
      ["Spiritual Disciplines", 6],
      ["The Holy Spirit", 4],
      ["CCF DNA", 4],
      // #66's exception: CCF's own printed title keeps "DGroup", which the app
      // never uses for anything of its own.
      ["Starting Point for Small Groups / DGroup 101", 4],
      ["Basic Doctrines", 6],
      ["Family Life", 8],
      ["Bible Survey", 12],
    ]);
  });

  it("has no book the artboards invented", async () => {
    // The boards' mock data says "Book 3 — Christian Beliefs". The real Book 3
    // is The Holy Spirit, four sessions. This assertion exists because that
    // mock is the likeliest thing a later change re-seeds from.
    const books = await listBooks();

    expect(books.map((book) => book.title)).not.toContain("Christian Beliefs");
  });

  it("carries a book's sessions in their published order", async () => {
    const books = await listBooks();
    const holySpirit = books.find((book) => book.number === 3)!;

    const detail = await getBook(holySpirit.id);

    expect(detail?.sessions.map((session) => [session.number, session.title])).toEqual([
      [1, "Who Is the Holy Spirit?"],
      [2, "The Works of the Holy Spirit"],
      [3, "The Gifts and the Fruits of the Holy Spirit"],
      [4, "Walking in the Spirit"],
    ]);
  });

  it("carries all twelve sessions of Book 8", async () => {
    // The book #68's dot-wrapping rule exists for, and the one no artboard
    // renders.
    const books = await listBooks();
    const survey = books.find((book) => book.number === 8)!;

    const detail = await getBook(survey.id);

    expect(detail?.sessions.map((session) => session.title)).toEqual([
      "The Importance of the Bible Survey",
      "The Pentateuch",
      "Historical Books 1: The Rise to the Monarchy",
      "Historical Books 2: The Fall of the Monarchy",
      "Wisdom Literature & Poetry",
      "Major Prophets",
      "Minor Prophets",
      "The New Testament Gospels",
      "The Acts of the Apostles",
      "The Pauline Epistles",
      "The General Epistles",
      "Revelation",
    ]);
  });

  it("adds nothing when it runs again", async () => {
    const before = await listBooks();

    await seedCurriculum();
    const after = await listBooks();

    // Same rows, same ids: a group's current_book_id survives a re-seed.
    expect(after.map((book) => book.id)).toEqual(before.map((book) => book.id));
    expect(after.reduce((total, book) => total + book.sessionCount, 0)).toBe(50);
  });
});
