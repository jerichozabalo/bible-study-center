import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { TEST_OWNER, dbConfigured, ensureSchema, resetRoster } from "../../../tests/fixtures";
import {
  addCancelledMeeting,
  addGeneratedMeeting,
  addHeldMeeting,
  resetMeetings,
} from "../../../tests/meeting-fixtures";
import { addDays, manilaToday } from "../dates";
import { archiveGroup, createGroup } from "../roster/groups";
import { createPerson, removePerson, updatePerson } from "../roster/people";
import { getMinistryStats, ministryOwnerId } from "./public-stats";

/**
 * The four public numbers (ministry-support-site issue 2), at the query
 * boundary the public route reads from.
 *
 * The load-bearing assertion is the key set: this is the one query in the app
 * whose answer leaves the sign-in behind, so a fifth field appearing here has
 * to break the suite rather than reach a web page.
 */
describe.skipIf(!dbConfigured)("getMinistryStats", () => {
  const OTHER_OWNER = "someone-else@example.com";

  let today: string;
  let tuesdayGroup: string;

  beforeAll(async () => {
    await ensureSchema();
  });

  beforeEach(async () => {
    await resetMeetings();
    await resetRoster();

    today = manilaToday();
    tuesdayGroup = await createGroup(TEST_OWNER, {
      name: "Tuesday BGroup",
      weekday: 2,
      startTime: "19:00",
      durationMinutes: 90,
      currentBookId: null,
    });
  });

  it("returns exactly the four locked fields and nothing else", async () => {
    const stats = await getMinistryStats(TEST_OWNER);

    expect(Object.keys(stats).sort()).toEqual([
      "members_total",
      "new_this_month",
      "sessions_held",
      "studies_active",
    ]);
  });

  it("answers zero for a ministry with nothing in it yet", async () => {
    await archiveGroup(TEST_OWNER, tuesdayGroup);

    expect(await getMinistryStats(TEST_OWNER)).toEqual({
      studies_active: 0,
      members_total: 0,
      new_this_month: 0,
      sessions_held: 0,
    });
  });

  it("counts the BGroups still meeting, never the archived ones", async () => {
    const thursdayGroup = await createGroup(TEST_OWNER, {
      name: "Thursday BGroup",
      weekday: 4,
      startTime: "19:00",
      durationMinutes: 90,
      currentBookId: null,
    });
    await archiveGroup(TEST_OWNER, thursdayGroup);

    expect((await getMinistryStats(TEST_OWNER)).studies_active).toBe(1);
  });

  it("counts people once each, however many BGroups they have been in", async () => {
    const thursdayGroup = await createGroup(TEST_OWNER, {
      name: "Thursday BGroup",
      weekday: 4,
      startTime: "19:00",
      durationMinutes: 90,
      currentBookId: null,
    });
    const maria = await createPerson(TEST_OWNER, {
      name: "Maria Santos",
      homeGroupId: tuesdayGroup,
      joinedOn: addDays(today, -200),
    });
    // The transfer (#27) closes one membership row and opens another, so a
    // count of `group_memberships` would report Maria twice.
    await updatePerson(TEST_OWNER, maria, {
      name: "Maria Santos",
      homeGroupId: thursdayGroup,
      joinedOn: addDays(today, -200),
    });
    await createPerson(TEST_OWNER, {
      name: "Ramon Cruz",
      homeGroupId: thursdayGroup,
      joinedOn: addDays(today, -200),
    });

    expect((await getMinistryStats(TEST_OWNER)).members_total).toBe(2);
  });

  it("leaves removed people out of the head count (#24)", async () => {
    const walkIn = await createPerson(TEST_OWNER, {
      name: "Someone Typed By Mistake",
      homeGroupId: tuesdayGroup,
      joinedOn: addDays(today, -1),
    });
    await removePerson(TEST_OWNER, walkIn);

    const stats = await getMinistryStats(TEST_OWNER);
    expect(stats.members_total).toBe(0);
    expect(stats.new_this_month).toBe(0);
  });

  it("counts the people who joined the ministry in the last 30 days", async () => {
    await createPerson(TEST_OWNER, {
      name: "Joined Today",
      homeGroupId: tuesdayGroup,
      joinedOn: today,
    });
    // The window is the 30 days ending today, inclusive of both ends.
    await createPerson(TEST_OWNER, {
      name: "Joined On The Edge",
      homeGroupId: tuesdayGroup,
      joinedOn: addDays(today, -29),
    });
    await createPerson(TEST_OWNER, {
      name: "Joined Just Before",
      homeGroupId: tuesdayGroup,
      joinedOn: addDays(today, -30),
    });

    const stats = await getMinistryStats(TEST_OWNER);
    expect(stats.new_this_month).toBe(2);
    expect(stats.members_total).toBe(3);
  });

  it("counts held sessions only — proposed and cancelled nights are not sessions", async () => {
    await addHeldMeeting(TEST_OWNER, tuesdayGroup, addDays(today, -14));
    await addHeldMeeting(TEST_OWNER, tuesdayGroup, addDays(today, -7));
    await addGeneratedMeeting(TEST_OWNER, tuesdayGroup, addDays(today, 7));
    await addCancelledMeeting(TEST_OWNER, tuesdayGroup, addDays(today, -21));

    expect((await getMinistryStats(TEST_OWNER)).sessions_held).toBe(2);
  });

  it("counts one leader's ministry, never everything in the database", async () => {
    const theirGroup = await createGroup(OTHER_OWNER, {
      name: "Not Jericho's BGroup",
      weekday: 1,
      startTime: "19:00",
      durationMinutes: 90,
      currentBookId: null,
    });
    await createPerson(OTHER_OWNER, {
      name: "Their Member",
      homeGroupId: theirGroup,
      joinedOn: today,
    });
    await addHeldMeeting(OTHER_OWNER, theirGroup, addDays(today, -7));

    expect(await getMinistryStats(TEST_OWNER)).toEqual({
      studies_active: 1,
      members_total: 0,
      new_this_month: 0,
      sessions_held: 0,
    });
  });
});

/**
 * Whose ministry the public endpoint reports. v1 is single-user (#1), so the
 * allowlist's first entry IS the owner — the endpoint takes no parameters and
 * must never let a caller name someone else's roster.
 */
describe("ministryOwnerId", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is the first allowlisted address, normalised the way sign-in normalises it", () => {
    vi.stubEnv("ALLOWED_EMAILS", " Leader@Example.com , second@example.com ");

    expect(ministryOwnerId()).toBe("leader@example.com");
  });

  it("is null when the deployment has no allowlist at all", () => {
    vi.stubEnv("ALLOWED_EMAILS", "");

    expect(ministryOwnerId()).toBeNull();
  });
});
