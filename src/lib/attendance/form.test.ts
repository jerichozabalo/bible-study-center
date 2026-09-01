import { describe, expect, it } from "vitest";

import { catchUpJoinedNote, guestLabel, markChipLabel, parseSheetForm } from "./form";

describe("parseSheetForm", () => {
  it("reads one mark per person, unticked people included", () => {
    const form = new FormData();
    form.set("meetingId", "meeting-1");
    form.set("intent", "save");
    form.set("mark:person-a", "attended");
    form.set("mark:person-b", "present-only");
    form.set("mark:person-c", "");

    expect(parseSheetForm(form)).toEqual({
      meetingId: "meeting-1",
      marks: [
        { personId: "person-a", mark: "attended" },
        { personId: "person-b", mark: "present-only" },
        // Posted and empty is what "not ticked" looks like — and it is what
        // takes back a tick that was saved before (#24).
        { personId: "person-c", mark: null },
      ],
      walkIn: null,
    });
  });

  it("reads the walk-in's name only when that is what was submitted (#67)", () => {
    const form = new FormData();
    form.set("meetingId", "meeting-1");
    form.set("intent", "walk-in");
    form.set("walkInName", "  Nico  ");

    expect(parseSheetForm(form).walkIn).toBe("Nico");

    form.set("intent", "save");
    expect(parseSheetForm(form).walkIn).toBeNull();
  });
});

describe("guestLabel", () => {
  it("names the visitor and the BGroup they came from (#31)", () => {
    expect(guestLabel("Nico", "BGroup Linggo")).toBe("Nico (BGroup Linggo)");
  });

  it("is the name alone when there is no other BGroup to name", () => {
    expect(guestLabel("Nico", null)).toBe("Nico");
  });
});

describe("catchUpJoinedNote", () => {
  /** #28 — behind, and the marker is what makes that readable. */
  it("says when they joined that BGroup and what it was on", () => {
    expect(
      catchUpJoinedNote({
        homeGroupName: "BGroup Linggo",
        joinedOn: "2026-07-05",
        joinedAtBookNumber: 1,
        joinedAtBookTitle: "One By One",
      }),
    ).toBe("Joined BGroup Linggo on 5 July 2026, while it was on Book 1 — One By One.");
  });

  it("leaves the book out when the BGroup had not picked one", () => {
    expect(
      catchUpJoinedNote({
        homeGroupName: "BGroup Linggo",
        joinedOn: "2026-07-05",
        joinedAtBookNumber: null,
        joinedAtBookTitle: null,
      }),
    ).toBe("Joined BGroup Linggo on 5 July 2026.");
  });

  it("says nothing at all without a marker", () => {
    expect(
      catchUpJoinedNote({
        homeGroupName: "BGroup Linggo",
        joinedOn: null,
        joinedAtBookNumber: null,
        joinedAtBookTitle: null,
      }),
    ).toBeNull();
  });
});

describe("markChipLabel", () => {
  it("names the session a tick completed (#25)", () => {
    expect(markChipLabel("attended", 4)).toBe("Completed Session 4");
  });

  /** #26 — nothing is credited, and the chip says what IS true instead. */
  it("says a tick at a no-session night is contact (#26/#65)", () => {
    expect(markChipLabel("attended", null)).toBe("Here — counts as contact");
  });

  it("names present only for what it is (#25)", () => {
    expect(markChipLabel("present-only", 4)).toBe("Present only");
    expect(markChipLabel("present-only", null)).toBe("Present only");
  });
});
