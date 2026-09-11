import { describe, expect, it } from "vitest";

import { GROUP_WRITE, PERSON_WRITE, pendingRosterRows, unwrapUpload } from "./pending";
import type { OutboxItem } from "./store";

/**
 * `pendingRosterRows` (issue 18, Tier 2): what the People and Groups lists put
 * above the server-rendered rows for a person or BGroup created with no signal.
 */

function item(over: Partial<OutboxItem>): OutboxItem {
  return {
    id: "x",
    seq: 1,
    type: PERSON_WRITE,
    payload: {},
    deps: [],
    status: "pending",
    serverId: null,
    queuedAt: 0,
    ...over,
  };
}

describe("pendingRosterRows", () => {
  it("keeps only the un-uploaded rows of the asked-for kind", () => {
    const items = [
      item({ id: "p1", type: PERSON_WRITE, payload: { name: "Nena" } }),
      item({ id: "g1", type: GROUP_WRITE, payload: { name: "BGroup Bukas" } }),
      item({ id: "p2", type: PERSON_WRITE, status: "done", payload: { name: "Already up" } }),
    ];

    expect(pendingRosterRows(items, PERSON_WRITE).map((r) => r.name)).toEqual(["Nena"]);
    expect(pendingRosterRows(items, GROUP_WRITE).map((r) => r.name)).toEqual(["BGroup Bukas"]);
  });

  it("orders newest first — the order they sit above the list", () => {
    const items = [
      item({ id: "a", seq: 3, payload: { name: "Third" } }),
      item({ id: "b", seq: 1, payload: { name: "First" } }),
      item({ id: "c", seq: 2, payload: { name: "Second" } }),
    ];

    expect(pendingRosterRows(items, PERSON_WRITE).map((r) => r.name)).toEqual([
      "Third",
      "Second",
      "First",
    ]);
  });

  it("carries the failed status and the server's reason through", () => {
    const rows = pendingRosterRows(
      [item({ id: "p1", status: "failed", error: "name already taken", payload: { name: "Nena" } })],
      PERSON_WRITE,
    );

    expect(rows).toEqual([
      { queueId: "p1", name: "Nena", nickname: null, status: "failed", error: "name already taken" },
    ]);
  });

  it("shows a name-only walk-in with nothing typed as Unnamed, never blank", () => {
    const rows = pendingRosterRows([item({ id: "p1", payload: { name: "  " } })], PERSON_WRITE);
    expect(rows[0].name).toBe("Unnamed");
  });

  /**
   * bst-v1.1 issue 1 — a person created with no signal keeps its nickname
   * through the outbox: the queued row shows what the leader typed, and the
   * payload keeps it for the replay. A dropped field here fails silently.
   */
  it("carries the nickname a queued person was saved with", () => {
    const rows = pendingRosterRows(
      [item({ id: "p1", payload: { name: "Nena Villamor", nickname: "Nena" } })],
      PERSON_WRITE,
    );

    expect(rows).toEqual([
      { queueId: "p1", name: "Nena Villamor", nickname: "Nena", status: "pending", error: null },
    ]);
  });

  it("reads a blank nickname in a queued payload as none at all", () => {
    const rows = pendingRosterRows(
      [item({ id: "p1", payload: { name: "Nena Villamor", nickname: "   " } })],
      PERSON_WRITE,
    );

    expect(rows[0].nickname).toBeNull();
  });
});

describe("unwrapUpload", () => {
  it("returns the created row's id from a success result", () => {
    expect(unwrapUpload({ groupId: "g-123" }, "groupId")).toBe("g-123");
    expect(unwrapUpload({ personId: "p-9" }, "personId")).toBe("p-9");
  });

  it("throws the server's refusal as a plain, readable Error", () => {
    // Next redacts a raw server-action throw in production; the action hands
    // the sentence back as data and this is where it becomes an Error again —
    // non-transient, so the queue marks the item failed with this message.
    expect(() =>
      unwrapUpload({ error: "That BGroup is archived or no longer exists." }, "groupId"),
    ).toThrow("That BGroup is archived or no longer exists.");
  });
});
