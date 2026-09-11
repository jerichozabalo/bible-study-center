import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { TEST_OWNER, dbConfigured, ensureSchema, resetRoster } from "../../../tests/fixtures";
import { addHeldMeeting, resetMeetings } from "../../../tests/meeting-fixtures";
import { createGroup } from "../roster/groups";
import {
  type PhotoUploadFile,
  ConsentRequiredError,
  deletePhoto,
  listCoverThumbnails,
  listPhotosForSession,
  uploadPhotos,
} from "./photos";
import type { PhotoStorage } from "./storage";

/**
 * bst-v1.1 issue 4 — session photos. The spec's test boundary: a MOCK R2 client
 * (nothing here talks to Cloudflare) plus BST's Neon test branch. What is under
 * test is the module's rules: no consent tick, no batch; a batch stores every
 * file plus its thumbnail variant; the tick is recorded; delete removes the row
 * and both objects; the list is owner-scoped.
 */
describe.skipIf(!dbConfigured)("session photos", () => {
  let group: string;
  let meeting: string;

  beforeAll(async () => {
    await ensureSchema();
  });

  beforeEach(async () => {
    await resetMeetings();
    await resetRoster();
    group = await createGroup(TEST_OWNER, {
      name: "Tuesday BGroup",
      weekday: 2,
      startTime: "19:00",
      durationMinutes: 90,
      currentBookId: null,
    });
    meeting = await addHeldMeeting(TEST_OWNER, group, "2026-09-08");
  });

  /** The mock R2 client — records every call so the test can assert on them. */
  function mockStorage() {
    const puts: { key: string; bytes: number; contentType: string }[] = [];
    const removed: string[] = [];
    const storage: PhotoStorage = {
      put: async (key, body, contentType) => {
        puts.push({ key, bytes: body.byteLength, contentType });
      },
      remove: async (keys) => {
        removed.push(...keys);
      },
      signedUrl: async (key) => `https://r2.test/${key}`,
    };
    return { storage, puts, removed };
  }

  function file(overrides: Partial<PhotoUploadFile> = {}): PhotoUploadFile {
    return {
      photo: new Uint8Array([1, 2, 3, 4]),
      thumb: new Uint8Array([9, 9]),
      caption: null,
      takenOn: "2026-09-08",
      ...overrides,
    };
  }

  it("refuses a batch without the consent tick — nothing stored, nothing written", async () => {
    const { storage, puts } = mockStorage();

    await expect(
      uploadPhotos(TEST_OWNER, meeting, [file()], false, storage),
    ).rejects.toBeInstanceOf(ConsentRequiredError);

    expect(puts).toEqual([]);
    expect(await listPhotosForSession(TEST_OWNER, meeting)).toEqual([]);
  });

  it("stores every file plus its thumbnail variant, and records the batch tick", async () => {
    const { storage, puts } = mockStorage();

    const rows = await uploadPhotos(
      TEST_OWNER,
      meeting,
      [file({ caption: "First night", takenOn: "2026-09-08" }), file({ takenOn: "2026-09-08" })],
      true,
      storage,
    );

    expect(rows).toHaveLength(2);
    // Two files, two variants each: the archive copy and the public variant.
    expect(puts).toHaveLength(4);
    for (const put of puts) {
      expect(put.key).toMatch(
        new RegExp(`^sessions/${group}/2026-09-08/[0-9a-f-]{36}(-thumb)?\\.jpg$`),
      );
      expect(put.contentType).toBe("image/jpeg");
    }

    const listed = await listPhotosForSession(TEST_OWNER, meeting);
    expect(listed.map((photo) => [photo.caption, photo.takenOn])).toEqual([
      [null, "2026-09-08"],
      ["First night", "2026-09-08"],
    ]);
    // The tick is a recorded moment, not an unchecked assumption.
    for (const photo of listed) {
      expect(photo.consentConfirmedAt).toBeInstanceOf(Date);
      expect(photo.r2ThumbKey).toBe(`${photo.r2Key.replace(/\.jpg$/, "")}-thumb.jpg`);
    }
  });

  it("lists a session's photos newest first, and only its own", async () => {
    const { storage } = mockStorage();
    const other = await addHeldMeeting(TEST_OWNER, group, "2026-09-01");

    await uploadPhotos(TEST_OWNER, meeting, [file({ caption: "Later", takenOn: "2026-09-08" })], true, storage);
    await uploadPhotos(TEST_OWNER, other, [file({ caption: "Earlier", takenOn: "2026-09-01" })], true, storage);

    const listed = await listPhotosForSession(TEST_OWNER, other);
    expect(listed.map((photo) => photo.caption)).toEqual(["Earlier"]);

    const both = await uploadPhotos(
      TEST_OWNER,
      meeting,
      [file({ caption: "Earliest", takenOn: "2026-09-01" })],
      true,
      storage,
    );
    expect(both).toHaveLength(1);
    const ordered = await listPhotosForSession(TEST_OWNER, meeting);
    // Newest first, and only this meeting's: "Earlier" lives on the other one.
    expect(ordered.map((photo) => [photo.takenOn, photo.caption])).toEqual([
      ["2026-09-08", "Later"],
      ["2026-09-01", "Earliest"],
    ]);
  });

  it("deletes the row and both objects — and is owner-scoped", async () => {
    const { storage, removed } = mockStorage();
    const [row] = await uploadPhotos(TEST_OWNER, meeting, [file()], true, storage);

    // Somebody else's request deletes nothing.
    expect(await deletePhoto("someone.else@example.com", row.id, storage)).toBe(false);
    expect(removed).toEqual([]);
    expect(await listPhotosForSession(TEST_OWNER, meeting)).toHaveLength(1);

    expect(await deletePhoto(TEST_OWNER, row.id, storage)).toBe(true);
    expect(removed).toEqual([row.r2Key, row.r2ThumbKey]);
    expect(await listPhotosForSession(TEST_OWNER, meeting)).toEqual([]);
  });

  it("draws one cover thumbnail per meeting — the newest photo on each (bst-v1.2 #1)", async () => {
    const { storage } = mockStorage();
    const earlier = await addHeldMeeting(TEST_OWNER, group, "2026-09-01");

    await uploadPhotos(TEST_OWNER, meeting, [file({ caption: "Older", takenOn: "2026-09-07" })], true, storage);
    const [newer] = await uploadPhotos(TEST_OWNER, meeting, [file({ caption: "Newer", takenOn: "2026-09-08" })], true, storage);
    await uploadPhotos(TEST_OWNER, earlier, [file({ takenOn: "2026-09-01" })], true, storage);

    const covers = await listCoverThumbnails(TEST_OWNER, [meeting, earlier], storage);

    expect(covers.size).toBe(2);
    // The newest photo of the night, exactly as the record draws it first.
    expect(covers.get(meeting)).toBe(`https://r2.test/${newer.r2ThumbKey}`);
    expect(covers.get(earlier)).toContain("-thumb.jpg");
  });

  it("leaves photo-less nights out, and keeps other owners' photos out", async () => {
    const { storage } = mockStorage();
    const bare = await addHeldMeeting(TEST_OWNER, group, "2026-09-01");
    await uploadPhotos(TEST_OWNER, meeting, [file()], true, storage);

    const otherGroup = await createGroup("someone.else@example.com", {
      name: "Other BGroup",
      weekday: 3,
      startTime: "19:00",
      durationMinutes: 60,
      currentBookId: null,
    });
    const otherMeeting = await addHeldMeeting("someone.else@example.com", otherGroup, "2026-09-02");
    await uploadPhotos("someone.else@example.com", otherMeeting, [file()], true, storage);

    const covers = await listCoverThumbnails(TEST_OWNER, [meeting, bare, otherMeeting], storage);

    expect([...covers.keys()]).toEqual([meeting]);
  });

  it("returns nothing for no meetings at all", async () => {
    const { storage } = mockStorage();
    expect((await listCoverThumbnails(TEST_OWNER, [], storage)).size).toBe(0);
  });
});
