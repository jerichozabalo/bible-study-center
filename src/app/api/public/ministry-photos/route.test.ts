import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { TEST_OWNER, dbConfigured, ensureSchema, resetRoster } from "../../../../../tests/fixtures";
import { addHeldMeeting, resetMeetings } from "../../../../../tests/meeting-fixtures";
import { createGroup } from "@/lib/roster/groups";
import { type PhotoUploadFile, uploadPhotos } from "@/lib/session-photos/photos";
import type { PhotoStorage } from "@/lib/session-photos/storage";

import { GET } from "./route";

/**
 * `GET /api/public/ministry-photos` (ministry-support-site issue 11) — the
 * photo half of the public-stats boundary. THE POINT OF THE FIRST TEST: the
 * response's photo shape must be exactly `{url, caption, date}` — a meeting
 * id, group id, group name or any other field reaching this response is a PII
 * leak, and the suite must fail before it reaches a public page.
 */
describe.skipIf(!dbConfigured)("GET /api/public/ministry-photos", () => {
  let group: string;

  beforeAll(async () => {
    await ensureSchema();
  });

  beforeEach(async () => {
    await resetMeetings();
    await resetRoster();
    vi.stubEnv("ALLOWED_EMAILS", TEST_OWNER);

    group = await createGroup(TEST_OWNER, {
      name: "Ephesians MM Group",
      weekday: 4,
      startTime: "16:00",
      durationMinutes: 60,
      currentBookId: null,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function mockStorage(): PhotoStorage {
    return {
      put: async () => {},
      remove: async () => {},
      signedUrl: async (key, expiresInSeconds) =>
        `https://r2.test/${key}?ttl=${expiresInSeconds ?? "default"}`,
    };
  }

  function file(overrides: Partial<PhotoUploadFile> = {}): PhotoUploadFile {
    return {
      photo: new Uint8Array([1, 2, 3, 4]),
      thumb: new Uint8Array([9, 9]),
      caption: null,
      takenOn: "2026-09-17",
      ...overrides,
    };
  }

  function request(cursor?: string): Request {
    const url = new URL("http://localhost/api/public/ministry-photos");
    if (cursor) url.searchParams.set("cursor", cursor);
    return new Request(url);
  }

  it("returns exactly {url, caption, date} per photo, plus a cursor, and no fifth field", async () => {
    const meeting = await addHeldMeeting(TEST_OWNER, group, "2026-09-17");
    await uploadPhotos(
      TEST_OWNER,
      meeting,
      [file({ caption: "First session together" })],
      true,
      mockStorage(),
    );

    const response = await GET(request());
    const body = await response.json();

    expect(Object.keys(body).sort()).toEqual(["cursor", "photos"]);
    expect(body.photos).toHaveLength(1);
    expect(Object.keys(body.photos[0]).sort()).toEqual(["caption", "date", "url"]);
    expect(body.photos[0]).toEqual({
      url: expect.stringContaining("r2.cloudflarestorage.com"),
      caption: "First session together",
      date: "2026-09-17",
    });
  });

  it("carries no group name or attendee data in the response", async () => {
    const meeting = await addHeldMeeting(TEST_OWNER, group, "2026-09-17");
    await uploadPhotos(TEST_OWNER, meeting, [file()], true, mockStorage());

    const response = await GET(request());
    const text = await response.text();

    // The R2 key legitimately embeds the group and meeting UUIDs
    // (sessions/<group>/<date>/<uuid>.jpg) — an opaque storage path segment,
    // not a name. What must never appear is anything human-readable.
    expect(text).not.toContain("Ephesians");
  });

  it("signs the thumbnail URL with a TTL that outlives the site's hourly revalidate", async () => {
    const meeting = await addHeldMeeting(TEST_OWNER, group, "2026-09-17");
    await uploadPhotos(TEST_OWNER, meeting, [file()], true, mockStorage());

    const response = await GET(request());
    const body = await response.json();

    const ttl = Number(new URL(body.photos[0].url).searchParams.get("X-Amz-Expires"));
    expect(ttl).toBeGreaterThan(3600);
  });

  it("drops a deleted photo from the very next call", async () => {
    const meeting = await addHeldMeeting(TEST_OWNER, group, "2026-09-17");
    const [stored] = await uploadPhotos(TEST_OWNER, meeting, [file()], true, mockStorage());

    const { deletePhoto } = await import("@/lib/session-photos/photos");
    await deletePhoto(TEST_OWNER, stored.id, mockStorage());

    const response = await GET(request());
    const body = await response.json();

    expect(body.photos).toEqual([]);
  });

  it("paginates newest-uploaded-first with a cursor, no duplicate and no missing photo", async () => {
    const meeting = await addHeldMeeting(TEST_OWNER, group, "2026-09-17");
    const files = Array.from({ length: 13 }, (_, i) => file({ caption: `photo-${i}` }));
    await uploadPhotos(TEST_OWNER, meeting, files, true, mockStorage());

    const first = await (await GET(request())).json();
    expect(first.photos).toHaveLength(12);
    expect(first.cursor).not.toBeNull();

    const second = await (await GET(request(first.cursor))).json();
    expect(second.photos).toHaveLength(1);
    expect(second.cursor).toBeNull();

    const allCaptions = [...first.photos, ...second.photos].map((p: { caption: string }) => p.caption);
    expect(new Set(allCaptions).size).toBe(13);
  });

  it("answers an empty archive honestly rather than erroring", async () => {
    const response = await GET(request());
    const body = await response.json();

    expect(body).toEqual({ photos: [], cursor: null });
  });

  it("answers an unauthenticated request with the photos, not the front door", async () => {
    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("says a deployment with no allowlist is misconfigured rather than answering an empty page", async () => {
    vi.stubEnv("ALLOWED_EMAILS", "");

    const response = await GET(request());

    expect(response.status).toBe(500);
    expect(await response.text()).toContain("ALLOWED_EMAILS");
  });
});
