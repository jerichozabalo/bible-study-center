import { describe, expect, it } from "vitest";

import {
  advanceIntroLine,
  bookStatusLine,
  dotState,
  groupBookLine,
  missingSessionsLine,
  quietLine,
  sessionWhen,
} from "./display";
import type { BookProgress, GroupBookProgress, MemberProgress, SessionProgress } from "./progress";
import type { QuietMember } from "./quiet";

function session(overrides: Partial<SessionProgress> = {}): SessionProgress {
  return {
    sessionId: "00000000-0000-0000-0000-000000000001",
    number: 1,
    title: "One Truth — The Gospel",
    covered: false,
    date: null,
    beforeJoining: false,
    ...overrides,
  };
}

/** Nena on the Person board: joined at Session 3, owes 1 and 2, has done 3-5. */
function nenaBookOne(): BookProgress {
  const states: Partial<SessionProgress>[] = [
    { number: 1, beforeJoining: true },
    { number: 2, beforeJoining: true },
    { number: 3, covered: true, date: "2026-06-30" },
    { number: 4, covered: true, date: "2026-07-07" },
    { number: 5, covered: true, date: "2026-07-14" },
    { number: 6 },
  ];

  return {
    bookId: "00000000-0000-0000-0000-0000000000b1",
    bookNumber: 1,
    bookTitle: "One By One",
    sessions: states.map((state) => session(state)),
    coveredCount: 3,
    sessionCount: 6,
    complete: false,
    joinedAtSessionNumber: 3,
  };
}

function member(overrides: Partial<MemberProgress> = {}): MemberProgress {
  return {
    personId: "00000000-0000-0000-0000-0000000000p1",
    name: "Ben Cruz",
    coveredCount: 4,
    sessionCount: 6,
    complete: false,
    behind: true,
    missingSessionNumbers: [3, 4],
    joinedAtSessionNumber: null,
    ...overrides,
  };
}

/**
 * The words the progress screens print. Kept pure and tested on their own
 * because both boards' status lines are copy Jericho reads at a glance, and a
 * derivation test would not notice them drifting.
 */
describe("bookStatusLine", () => {
  it("names the joined-at marker and what it left owing (#28)", () => {
    expect(bookStatusLine(nenaBookOne())).toBe("3 of 6 · joined at Session 3, owes 1 and 2");
  });

  it("says nothing but the count when they were there from the start", () => {
    const book = { ...nenaBookOne(), joinedAtSessionNumber: null };
    book.sessions = book.sessions.map((s) => ({ ...s, beforeJoining: false }));
    expect(bookStatusLine(book)).toBe("3 of 6");
  });

  it("reads 'Not started' before the first session is covered", () => {
    const book = nenaBookOne();
    expect(
      bookStatusLine({
        ...book,
        sessions: book.sessions.map((s) => ({ ...s, covered: false, beforeJoining: false })),
        coveredCount: 0,
        joinedAtSessionNumber: null,
      }),
    ).toBe("Not started");
  });

  it("keeps the marker on a book they have not started (#28)", () => {
    const book = nenaBookOne();
    expect(
      bookStatusLine({
        ...book,
        sessions: book.sessions.map((s) => ({ ...s, covered: false })),
        coveredCount: 0,
      }),
    ).toBe("0 of 6 · joined at Session 3, owes 1 and 2");
  });

  it("calls a book complete only with every session on it (#5)", () => {
    const book = nenaBookOne();
    expect(
      bookStatusLine({
        ...book,
        sessions: book.sessions.map((s) => ({ ...s, covered: true, beforeJoining: false })),
        coveredCount: 6,
        complete: true,
        joinedAtSessionNumber: null,
      }),
    ).toBe("6 of 6 · complete");
  });

  it("says so when the whole book ran before they joined (#28)", () => {
    const book = nenaBookOne();
    expect(
      bookStatusLine({
        ...book,
        sessions: book.sessions.map((s) => ({ ...s, covered: false, beforeJoining: true })),
        coveredCount: 0,
        joinedAtSessionNumber: 7,
      }),
    ).toBe("0 of 6 · joined after this book, owes all 6");
  });

  it("counts a 12-session book by its own length (#68)", () => {
    const sessions = Array.from({ length: 12 }, (_, index) =>
      session({ number: index + 1, covered: index < 11 }),
    );
    expect(
      bookStatusLine({
        bookId: "00000000-0000-0000-0000-0000000000b8",
        bookNumber: 8,
        bookTitle: "Bible Survey",
        sessions,
        coveredCount: 11,
        sessionCount: 12,
        complete: false,
        joinedAtSessionNumber: null,
      }),
    ).toBe("11 of 12");
  });

  it("says so when a book has no sessions yet (#22)", () => {
    expect(
      bookStatusLine({
        bookId: "00000000-0000-0000-0000-0000000000c1",
        bookNumber: null,
        bookTitle: "Kingdom Parables",
        sessions: [],
        coveredCount: 0,
        sessionCount: 0,
        complete: false,
        joinedAtSessionNumber: null,
      }),
    ).toBe("No sessions yet");
  });
});

describe("dotState", () => {
  it("fills a covered session", () => {
    expect(dotState(session({ covered: true, date: "2026-06-30" }))).toBe("done");
  });

  it("marks a session their BGroup covered before they joined (#28)", () => {
    expect(dotState(session({ beforeJoining: true }))).toBe("before");
  });

  it("leaves a session nobody has reached empty", () => {
    expect(dotState(session())).toBe("none");
  });

  it("counts a covered session as done even if it ran before they joined", () => {
    // A ride-along fills it later (#31), and covered is covered (#5).
    expect(dotState(session({ covered: true, beforeJoining: true }))).toBe("done");
  });
});

describe("sessionWhen", () => {
  it("prints the night they covered it", () => {
    expect(sessionWhen(session({ covered: true, date: "2026-06-30" }))).toBe("30 June");
  });

  it("says a session ran before they joined, without guessing at gender", () => {
    expect(sessionWhen(session({ beforeJoining: true }))).toBe("before they joined");
  });

  it("leaves an untouched session as 'not yet'", () => {
    expect(sessionWhen(session())).toBe("not yet");
  });
});

describe("missingSessionsLine", () => {
  it("names every session the checkpoint is about", () => {
    expect(missingSessionsLine(member())).toBe("Missing Sessions 3 and 4");
  });

  it("stays singular for one session", () => {
    expect(missingSessionsLine(member({ missingSessionNumbers: [6] }))).toBe("Missing Session 6");
  });

  it("carries the joined-at marker so the list stays readable (#28)", () => {
    expect(
      missingSessionsLine(member({ missingSessionNumbers: [1, 2], joinedAtSessionNumber: 3 })),
    ).toBe("Missing Sessions 1 and 2 — joined at Session 3");
  });

  it("lists three the way it is said out loud", () => {
    expect(missingSessionsLine(member({ missingSessionNumbers: [1, 2, 5] }))).toBe(
      "Missing Sessions 1, 2 and 5",
    );
  });
});

describe("groupBookLine", () => {
  function progress(overrides: Partial<GroupBookProgress> = {}): GroupBookProgress {
    return {
      bookId: "00000000-0000-0000-0000-0000000000b1",
      bookNumber: 1,
      bookTitle: "One By One",
      sessions: Array.from({ length: 6 }, (_, index) => ({
        sessionId: `s${index}`,
        number: index + 1,
        title: "…",
        coveredByGroup: true,
      })),
      sessionCount: 6,
      coveredByGroupCount: 6,
      groupComplete: true,
      members: [member({ complete: true }), member({ complete: false })],
      completeMemberCount: 1,
      ...overrides,
    };
  }

  it("rolls the per-person facts up without inventing a group record (#2)", () => {
    expect(groupBookLine(progress())).toBe(
      "All 6 sessions covered by the group · 1 of 2 members complete",
    );
  });

  it("counts how far the group has got while it is still in the book", () => {
    expect(groupBookLine(progress({ coveredByGroupCount: 4, groupComplete: false }))).toBe(
      "4 of 6 sessions covered by the group · 1 of 2 members complete",
    );
  });

  it("drops the roll-up when nobody calls this BGroup home", () => {
    expect(groupBookLine(progress({ members: [], completeMemberCount: 0 }))).toBe(
      "All 6 sessions covered by the group",
    );
  });
});

/**
 * The checkpoint's first sentence (#18). It names the cost of advancing before
 * the button that pays it — and it is still a sentence when there is no cost.
 */
describe("advanceIntroLine", () => {
  it("counts the members the book would leave behind", () => {
    expect(advanceIntroLine(2, "One By One", "Book 2")).toBe(
      "2 members have not finished One By One. Advancing moves the group to Book 2 and puts them on the catch-up list.",
    );
  });

  it("stays singular for one", () => {
    expect(advanceIntroLine(1, "One By One", "Book 2")).toBe(
      "1 member has not finished One By One. Advancing moves the group to Book 2 and puts them on the catch-up list.",
    );
  });

  it("says the good news when the whole BGroup finished (#5)", () => {
    expect(advanceIntroLine(0, "One By One", "Book 2")).toBe(
      "Everyone has finished One By One. Advancing moves the group to Book 2.",
    );
  });
});

/**
 * The "Needs you" list line — the board's own phrasing, in the meetings unit
 * (#64), and never a grade on the person (#66).
 */
describe("quietLine", () => {
  function quiet(overrides: Partial<QuietMember> = {}): QuietMember {
    return {
      personId: "00000000-0000-0000-0000-0000000000q1",
      name: "Nena Villamor",
      homeGroupId: "00000000-0000-0000-0000-0000000000g1",
      homeGroupName: "BGroup Martes",
      consecutiveMissed: 3,
      threshold: 3,
      lastSeen: "2026-07-28",
      ...overrides,
    };
  }

  it("counts missed meetings and the day they were last seen", () => {
    expect(quietLine(quiet())).toBe("Missed 3 meetings in a row. Last seen 28 July.");
  });

  it("stays singular for one missed meeting", () => {
    expect(quietLine(quiet({ consecutiveMissed: 1 }))).toBe(
      "Missed 1 meeting in a row. Last seen 28 July.",
    );
  });

  it("says so plainly when there is no completion to point at", () => {
    expect(quietLine(quiet({ lastSeen: null }))).toBe(
      "Missed 3 meetings in a row. Not seen at a meeting yet.",
    );
  });
});
