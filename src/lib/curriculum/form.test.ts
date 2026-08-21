import { describe, expect, it } from "vitest";

import { bookFormValuesFrom, parseBookForm } from "./form";

/**
 * The book editor posts one `sessionId` and one `sessionTitle` per row, paired
 * by position — an existing session carries its id, a new one posts an empty
 * string. Everything here is about that pairing, and it needs no database.
 */
function formData(
  title: string,
  rows: Array<[id: string, sessionTitle: string]>,
): FormData {
  const form = new FormData();
  form.set("title", title);
  for (const [id, sessionTitle] of rows) {
    form.append("sessionId", id);
    form.append("sessionTitle", sessionTitle);
  }
  return form;
}

describe("parseBookForm", () => {
  it("pairs each row's id with its title, in order", () => {
    const parsed = parseBookForm(
      formData("Kingdom Parables", [
        ["e7cf9f0e-4a4a-4c3c-9b2a-2b4a2a5f0001", "The Sower"],
        ["e7cf9f0e-4a4a-4c3c-9b2a-2b4a2a5f0002", "The Mustard Seed"],
      ]),
    );

    expect(parsed).toEqual({
      title: "Kingdom Parables",
      sessions: [
        { id: "e7cf9f0e-4a4a-4c3c-9b2a-2b4a2a5f0001", title: "The Sower" },
        { id: "e7cf9f0e-4a4a-4c3c-9b2a-2b4a2a5f0002", title: "The Mustard Seed" },
      ],
    });
  });

  it("reads a row with no id as a session being added", () => {
    const parsed = parseBookForm(formData("Kingdom Parables", [["", "The Sower"]]));

    expect(parsed.sessions).toEqual([{ id: null, title: "The Sower" }]);
  });

  it("drops the spare rows nobody typed into", () => {
    // The form always offers empty rows at the end so a session can be added
    // without JavaScript. Untouched, they are not sessions.
    const parsed = parseBookForm(
      formData("Kingdom Parables", [
        ["", "The Sower"],
        ["", "   "],
        ["", ""],
      ]),
    );

    expect(parsed.sessions).toEqual([{ id: null, title: "The Sower" }]);
  });

  it("keeps an existing session whose title was emptied", () => {
    // Blanking a session that exists is a mistake, not a removal — it has to
    // reach the validator and come back as a sentence.
    const parsed = parseBookForm(
      formData("Kingdom Parables", [["e7cf9f0e-4a4a-4c3c-9b2a-2b4a2a5f0001", "  "]]),
    );

    expect(parsed.sessions).toEqual([{ id: "e7cf9f0e-4a4a-4c3c-9b2a-2b4a2a5f0001", title: "  " }]);
  });

  it("survives a form with no session rows at all", () => {
    expect(parseBookForm(formData("Kingdom Parables", []))).toEqual({
      title: "Kingdom Parables",
      sessions: [],
    });
  });
});

describe("bookFormValuesFrom", () => {
  it("hands back what was typed, so a refusal costs nothing", () => {
    const values = bookFormValuesFrom(
      formData("Kingdom Parables", [
        ["e7cf9f0e-4a4a-4c3c-9b2a-2b4a2a5f0001", "The Sower"],
        ["", "The Mustard Seed"],
      ]),
    );

    expect(values).toEqual({
      title: "Kingdom Parables",
      sessions: [
        { id: "e7cf9f0e-4a4a-4c3c-9b2a-2b4a2a5f0001", title: "The Sower" },
        { id: null, title: "The Mustard Seed" },
      ],
    });
  });
});
