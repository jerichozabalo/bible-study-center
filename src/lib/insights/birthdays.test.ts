import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { TEST_OWNER, dbConfigured, ensureSchema, resetRoster } from "../../../tests/fixtures";
import { createPerson, removePerson, setSteppedAway } from "../roster/people";
import { celebrantsThisWeek, getBirthdayCelebrants } from "./birthdays";

/**
 * bst-v1.1 issue 3 — Home's birthday card. "This week" is the calendar week,
 * Sunday to Saturday, read in Manila (#46's week convention), and the whole
 * derivation is pure so the seams (year boundary, Feb 29, ordering) are
 * provable without a database.
 */
describe("celebrantsThisWeek", () => {
  function person(name: string, birthday: string, nickname: string | null = null) {
    return { personId: `p-${name}`, name, nickname, birthday };
  }

  it("names the week's celebrants, soonest first — Sunday to Saturday", () => {
    const week = celebrantsThisWeek(
      [
        person("Ana Reyes", "1990-09-19"),
        person("Ben Cruz", "1990-09-13"),
        person("Cara Dio", "1990-09-12"), // the Saturday before
        person("Dan Lim", "1990-09-20"), // the Sunday after
        person("Eve Santos", "1990-09-16"),
      ],
      "2026-09-16",
    );

    expect(week.map((c) => [c.name, c.celebratingOn, c.turns])).toEqual([
      ["Ben Cruz", "2026-09-13", 36],
      ["Eve Santos", "2026-09-16", 36],
      ["Ana Reyes", "2026-09-19", 36],
    ]);
  });

  it("keeps the same week when today is the Sunday, and when it is the Saturday", () => {
    const people = [person("Ben Cruz", "1990-09-13"), person("Ana Reyes", "1990-09-19")];

    expect(celebrantsThisWeek(people, "2026-09-13").map((c) => c.celebratingOn)).toEqual([
      "2026-09-13",
      "2026-09-19",
    ]);
    expect(celebrantsThisWeek(people, "2026-09-19").map((c) => c.celebratingOn)).toEqual([
      "2026-09-13",
      "2026-09-19",
    ]);
  });

  it("crosses the year boundary — a January birthday in the last week of December", () => {
    const week = celebrantsThisWeek(
      [
        person("Nena Villamor", "1985-01-01"),
        person("Ben Cruz", "1985-12-27"),
        person("Cara Dio", "1985-12-26"), // the Saturday before
      ],
      "2026-12-30",
    );

    expect(week.map((c) => [c.name, c.celebratingOn, c.turns])).toEqual([
      ["Ben Cruz", "2026-12-27", 41],
      ["Nena Villamor", "2027-01-01", 42],
    ]);
  });

  it("counts a Feb 29 birthday on Feb 28 in a common year", () => {
    const week = celebrantsThisWeek([person("Cara Dio", "2000-02-29")], "2026-02-25");

    expect(week).toMatchObject([{ celebratingOn: "2026-02-28", turns: 26 }]);
  });

  it("keeps the real Feb 29 in a leap year, and does not double-count it on the 28th", () => {
    const week = celebrantsThisWeek(
      [person("Cara Dio", "2000-02-29"), person("Dan Lim", "2000-02-28")],
      "2028-02-27",
    );

    expect(week.map((c) => [c.name, c.celebratingOn, c.turns])).toEqual([
      ["Dan Lim", "2028-02-28", 28],
      ["Cara Dio", "2028-02-29", 28],
    ]);
  });

  it("carries the nickname, so the card shows the name they are called by", () => {
    const week = celebrantsThisWeek([person("Nena Villamor", "1990-09-16", "Nena")], "2026-09-16");

    expect(week).toMatchObject([{ nickname: "Nena" }]);
  });

  it("breaks a same-day tie by name, and reads an empty or birthday-less roster as nobody", () => {
    const week = celebrantsThisWeek(
      [person("Zara Uy", "1990-09-16"), person("Ana Reyes", "1990-09-16")],
      "2026-09-16",
    );
    expect(week.map((c) => c.name)).toEqual(["Ana Reyes", "Zara Uy"]);

    expect(celebrantsThisWeek([], "2026-09-16")).toEqual([]);
  });
});

describe.skipIf(!dbConfigured)("getBirthdayCelebrants", () => {
  beforeAll(async () => {
    await ensureSchema();
  });

  beforeEach(async () => {
    await resetRoster();
  });

  it("reads the week from the roster: removed people out, stepped-away people in", async () => {
    const ana = await createPerson(TEST_OWNER, {
      name: "Ana Reyes",
      nickname: "Ana",
      birthday: "1990-09-15",
    });
    await createPerson(TEST_OWNER, { name: "Ben Cruz", birthday: "1990-09-20" });
    const cara = await createPerson(TEST_OWNER, { name: "Cara Dio", birthday: "1990-09-16" });
    await removePerson(TEST_OWNER, cara);
    const dan = await createPerson(TEST_OWNER, { name: "Dan Lim", birthday: "1990-09-17" });
    await setSteppedAway(TEST_OWNER, dan, true);
    await createPerson(TEST_OWNER, { name: "Eve Santos" });

    const week = await getBirthdayCelebrants(TEST_OWNER, "2026-09-16");

    expect(week.map((c) => [c.name, c.nickname])).toEqual([
      ["Ana Reyes", "Ana"],
      ["Dan Lim", null],
    ]);
    expect(week.map((c) => c.personId)).toEqual([ana, dan]);
  });
});
