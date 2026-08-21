import { describe, expect, it } from "vitest";

import { parseMeetingForm } from "./form";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.append(name, value);
  return data;
}

const GROUP = "6d1f4c8e-9a3b-4c2d-8e5f-1a2b3c4d5e6f";
const SESSION = "1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d";
const BOOK = "2b3c4d5e-6f7a-4b9c-8d0e-2f3a4b5c6d7e";

describe("parseMeetingForm", () => {
  it("reads the whole form", () => {
    expect(
      parseMeetingForm(
        form({
          groupId: GROUP,
          date: "2026-08-23",
          startTime: "18:30",
          durationMinutes: "60",
          bookId: BOOK,
          sessionId: SESSION,
          notes: "Sa bahay nina Ben",
          repeatWeekly: "on",
        }),
      ),
    ).toEqual({
      groupId: GROUP,
      date: "2026-08-23",
      startTime: "18:30",
      durationMinutes: 60,
      bookId: BOOK,
      sessionId: SESSION,
      notes: "Sa bahay nina Ben",
      repeatWeekly: true,
    });
  });

  it("leaves the time to the group when nothing was overridden (#36)", () => {
    const input = parseMeetingForm(form({ groupId: GROUP, date: "2026-08-23" }));

    expect(input.startTime).toBeNull();
    expect(input.durationMinutes).toBeNull();
  });

  it("reads a night with no lesson and no notes as exactly that (#26/#55)", () => {
    const input = parseMeetingForm(
      form({ groupId: GROUP, date: "2026-08-23", bookId: "", sessionId: "", notes: "   " }),
    );

    expect(input).toMatchObject({ bookId: null, sessionId: null, notes: null });
  });

  it("treats an unticked recurring box as no", () => {
    expect(parseMeetingForm(form({ groupId: GROUP, date: "2026-08-23" })).repeatWeekly).toBe(false);
  });
});
