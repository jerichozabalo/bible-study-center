import { describe, expect, it } from "vitest";

import { toCsv } from "./csv";

/**
 * The hand-rolled CSV serialiser (#66 — "Export", never "back up"/"Sync").
 *
 * RFC 4180 shape: comma between fields, CRLF between rows, and a field that
 * carries a comma, a quote or a newline is wrapped in quotes with its own
 * quotes doubled. Nothing here reaches the database — it turns a grid of values
 * into the exact bytes the download carries, which is what the golden-file
 * report tests pin.
 */
describe("toCsv", () => {
  it("joins plain fields with commas and rows with CRLF", () => {
    expect(
      toCsv([
        ["Date", "BGroup", "Attendance"],
        ["2026-08-12", "Tuesday BGroup", "5"],
      ]),
    ).toBe("Date,BGroup,Attendance\r\n2026-08-12,Tuesday BGroup,5");
  });

  it("quotes a field with a comma and one with a quote", () => {
    expect(toCsv([["Ana, Reyes", 'said "hi"']])).toBe('"Ana, Reyes","said ""hi"""');
  });

  it("quotes a field that spans lines", () => {
    expect(toCsv([["line one\nline two"]])).toBe('"line one\nline two"');
  });

  it("renders null and undefined as an empty field, not the word", () => {
    expect(toCsv([[null, undefined, 0, false]])).toBe(",,0,false");
  });

  it("returns an empty string for no rows", () => {
    expect(toCsv([])).toBe("");
  });
});
