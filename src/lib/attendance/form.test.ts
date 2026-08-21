import { describe, expect, it } from "vitest";

import { markChipLabel, parseSheetForm } from "./form";

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
