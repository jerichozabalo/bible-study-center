import { describe, expect, it } from "vitest";

import {
  VISIBLE_GROUPS,
  formatLastMet,
  moreLabel,
  pickerMetaLine,
  pickerScheduleLine,
  visibleGroups,
} from "./picker";

describe("the picker card's two lines (#63)", () => {
  it("names the schedule and the book on line one", () => {
    expect(
      pickerScheduleLine({ weekday: 2, startTime: "19:00:00", currentBookNumber: 1 }),
    ).toBe("Tuesdays 7:00 PM · Book 1");
  });

  it("says so on line one when no book has been chosen yet", () => {
    expect(
      pickerScheduleLine({ weekday: 0, startTime: "16:00:00", currentBookNumber: null }),
    ).toBe("Sundays 4:00 PM · No book yet");
  });

  it("explains the ordering on line two", () => {
    expect(pickerMetaLine(6, "2026-08-17")).toBe("6 members · last met Aug 17");
    expect(pickerMetaLine(1, null)).toBe("1 member · no meetings yet");
    expect(pickerMetaLine(0, null)).toBe("No members yet · no meetings yet");
  });

  it("formats the last-met date the way the board draws it", () => {
    expect(formatLastMet("2026-08-17")).toBe("last met Aug 17");
    expect(formatLastMet("2026-01-05")).toBe("last met Jan 5");
    expect(formatLastMet(null)).toBe("no meetings yet");
  });
});

describe("which groups the sheet shows (#63)", () => {
  const groups = ["a", "b", "c", "d", "e"].map((id) => ({ id }));

  it("shows three, with the rest behind See N more", () => {
    expect(VISIBLE_GROUPS).toBe(3);
    expect(visibleGroups(groups, null, false).map((g) => g.id)).toEqual(["a", "b", "c"]);
    expect(moreLabel(groups.length, false)).toBe("See 2 more");
  });

  it("shows every group once expanded", () => {
    expect(visibleGroups(groups, null, true)).toHaveLength(5);
    expect(moreLabel(groups.length, true)).toBe("See less");
  });

  it("never hides the selected group when the list collapses", () => {
    expect(visibleGroups(groups, "e", false).map((g) => g.id)).toEqual(["a", "b", "e"]);
  });

  it("leaves the order alone when the selected group is already visible", () => {
    expect(visibleGroups(groups, "b", false).map((g) => g.id)).toEqual(["a", "b", "c"]);
  });

  it("offers no See-more row when there is nothing behind it", () => {
    expect(moreLabel(3, false)).toBeNull();
    expect(moreLabel(2, false)).toBeNull();
  });
});
