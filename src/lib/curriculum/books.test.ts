import { beforeAll, describe, expect, it } from "vitest";

import { bookIdByNumber, dbConfigured, ensureSchema } from "../../../tests/fixtures";
import { resetCustomBooks } from "../../../tests/curriculum-fixtures";
import { bookLabel, getNextBook } from "./books";
import { createBook } from "./custom";
import { seedCurriculum } from "./seed";

/**
 * How a book is named on screen. The number and the title are separate columns
 * (a custom book has no number), and every screen that names a book renders
 * them through here so the em dash and the "Book n" prefix cannot drift.
 */
describe("bookLabel", () => {
  it("prefixes a published book with its number", () => {
    expect(bookLabel({ number: 1, title: "One By One" })).toBe("Book 1 — One By One");
  });

  it("leaves a custom book as its own title", () => {
    expect(bookLabel({ number: null, title: "Kingdom Parables" })).toBe("Kingdom Parables");
  });

  it("quotes CCF's printed title as published, DGroup and all (#66)", () => {
    expect(bookLabel({ number: 5, title: "Starting Point for Small Groups / DGroup 101" })).toBe(
      "Book 5 — Starting Point for Small Groups / DGroup 101",
    );
  });
});

/**
 * What follows a book, which is the only thing "advance" (#4/#18) has to know.
 *
 * The published order is the curriculum's own: GLC 1's four books, then GLC 2's
 * (#33). Finishing Book 4 is finishing GLC 1, and the book after it is Book 5 —
 * the programs are a boundary for certificates (v1.1), not a wall the leader
 * has to climb over by hand.
 */
describe.skipIf(!dbConfigured)("getNextBook", () => {
  beforeAll(async () => {
    await ensureSchema();
    await seedCurriculum();
    await resetCustomBooks();
  });

  it("hands back the next book by its published number", async () => {
    expect(await getNextBook(await bookIdByNumber(1))).toMatchObject({
      number: 2,
      title: "Spiritual Disciplines",
    });
  });

  it("carries on into GLC 2 at the end of GLC 1 (#33)", async () => {
    expect(await getNextBook(await bookIdByNumber(4))).toMatchObject({ number: 5 });
  });

  it("has nothing after the last book of the curriculum", async () => {
    expect(await getNextBook(await bookIdByNumber(8))).toBeNull();
  });

  it("has nothing after a book Jericho wrote himself (#22)", async () => {
    // A custom book has no number and no program, so nothing can be "next"
    // after it — the group changes book by hand instead.
    const custom = await createBook("leader@example.com", {
      title: "Kingdom Parables",
      sessions: [{ id: null, title: "The Sower" }],
    });

    expect(await getNextBook(custom)).toBeNull();
    await resetCustomBooks();
  });

  it("never offers a custom book as what comes next", async () => {
    const custom = await createBook("leader@example.com", {
      title: "Kingdom Parables",
      sessions: [{ id: null, title: "The Sower" }],
    });

    expect(await getNextBook(await bookIdByNumber(8))).toBeNull();
    expect(custom).toBeTruthy();
    await resetCustomBooks();
  });

  it("has nothing to say about an id that is not one", async () => {
    expect(await getNextBook("not-a-uuid")).toBeNull();
  });
});
