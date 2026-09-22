import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  TEST_OWNER,
  dbConfigured,
  ensureSchema,
  resetRoster,
} from "../../../../../tests/fixtures";
import { addHeldMeeting, resetMeetings } from "../../../../../tests/meeting-fixtures";
import { addDays, manilaToday } from "@/lib/dates";
import { createGroup } from "@/lib/roster/groups";
import { createPerson } from "@/lib/roster/people";

import { GET } from "./route";

/**
 * `GET /api/public/ministry-stats` (ministry-support-site issue 2) — the one
 * response in this app that leaves the sign-in behind.
 *
 * The first test is the reason the endpoint has a module of its own: the body's
 * key set must be exactly the four integers, so widening the shape — a name, a
 * group, a date, anything — breaks the suite before it reaches a public page.
 */
describe.skipIf(!dbConfigured)("GET /api/public/ministry-stats", () => {
  let today: string;

  beforeAll(async () => {
    await ensureSchema();
  });

  beforeEach(async () => {
    await resetMeetings();
    await resetRoster();

    // The endpoint takes no parameters: the owner is the allowlist's one entry
    // (#1), which in the suite is the address every fixture stamps.
    vi.stubEnv("ALLOWED_EMAILS", TEST_OWNER);

    today = manilaToday();
    const group = await createGroup(TEST_OWNER, {
      name: "Tuesday BGroup",
      weekday: 2,
      startTime: "19:00",
      durationMinutes: 90,
      currentBookId: null,
    });
    await createPerson(TEST_OWNER, {
      name: "Maria Santos",
      nickname: "Ya",
      phone: "0917 000 0000",
      homeGroupId: group,
      joinedOn: addDays(today, -7),
    });
    await addHeldMeeting(TEST_OWNER, group, addDays(today, -7));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns exactly the four integers and no fifth field", async () => {
    const response = await GET();
    const body = await response.json();

    expect(Object.keys(body).sort()).toEqual([
      "members_total",
      "new_this_month",
      "sessions_held",
      "studies_active",
    ]);
    expect(body).toEqual({
      studies_active: 1,
      members_total: 1,
      new_this_month: 1,
      sessions_held: 1,
    });
    for (const value of Object.values(body)) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("answers an unauthenticated request with the numbers, not the front door", async () => {
    // No cookie, no session: public forever, deliberately. A `requireUser()`
    // added here would 307 to /signin and take the support site's numbers with
    // it.
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
  });

  it("carries no roster detail in the response body at all", async () => {
    const response = await GET();
    const text = await response.text();

    expect(text).not.toContain("Maria");
    expect(text).not.toContain("Ya");
    expect(text).not.toContain("0917");
    expect(text).not.toContain("Tuesday BGroup");
  });

  it("says a deployment with no allowlist is misconfigured rather than answering zeros", async () => {
    vi.stubEnv("ALLOWED_EMAILS", "");

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.text()).toContain("ALLOWED_EMAILS");
  });
});
