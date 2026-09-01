import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  TEST_OWNER,
  bookIdByNumber,
  dbConfigured,
  ensureSchema,
  resetRoster,
} from "../../../tests/fixtures";
import {
  addCancelledMeeting,
  addHeldMeeting,
  resetMeetings,
  sessionIdByNumber,
} from "../../../tests/meeting-fixtures";
import { recordSheet } from "../attendance/completions";
import { seedCurriculum } from "../curriculum/seed";
import { createGroup, setQuietThreshold } from "../roster/groups";
import { createPerson, removePerson, setSteppedAway } from "../roster/people";
import { getQuietMembers } from "./quiet";

/**
 * The quiet list (#10/#64), at the seam Home's "Needs you" list reads from.
 *
 * The unit is consecutive missed HELD meetings of the person's HOME group,
 * counting back from the most recent held meeting — never weeks. Cancelled
 * (#50) and never-scheduled nights never tick the counter; any completion row
 * for the person on one of those meetings — a fellowship-night NULL-session
 * presence included (#26/#65) — breaks the streak.
 */
describe.skipIf(!dbConfigured)("getQuietMembers", () => {
  let bookOne: string;
  let sessions: string[];

  let tuesdayGroup: string;
  let maria: string;

  beforeAll(async () => {
    await ensureSchema();
    await seedCurriculum();
    bookOne = await bookIdByNumber(1);
    sessions = await Promise.all(
      [1, 2, 3, 4, 5, 6].map((number) => sessionIdByNumber(bookOne, number)),
    );
  });

  beforeEach(async () => {
    await resetMeetings();
    await resetRoster();

    tuesdayGroup = await createGroup(TEST_OWNER, {
      name: "Tuesday BGroup",
      weekday: 2,
      startTime: "19:00",
      durationMinutes: 90,
      currentBookId: bookOne,
    });
    maria = await createPerson(TEST_OWNER, {
      name: "Maria Santos",
      homeGroupId: tuesdayGroup,
      joinedOn: "2026-05-01",
    });
  });

  /** A held night on the group's book, one session per date. */
  async function held(groupId: string, date: string, sessionIndex: number | null): Promise<string> {
    return addHeldMeeting(TEST_OWNER, groupId, date, {
      bookId: sessionIndex === null ? null : bookOne,
      sessionId: sessionIndex === null ? null : sessions[sessionIndex],
    });
  }

  async function tick(
    meetingId: string,
    personId: string,
    mark: "attended" | "present-only" = "attended",
  ): Promise<void> {
    await recordSheet(TEST_OWNER, { meetingId, marks: [{ personId, mark }], hold: true });
  }

  it("flags a member who missed the last 3 held meetings of their home group", async () => {
    const one = await held(tuesdayGroup, "2026-06-02", 0);
    const two = await held(tuesdayGroup, "2026-06-09", 1);
    await held(tuesdayGroup, "2026-06-16", 2);
    await held(tuesdayGroup, "2026-06-23", 3);
    await held(tuesdayGroup, "2026-06-30", 4);
    await tick(one, maria);
    await tick(two, maria);

    const quiet = await getQuietMembers(TEST_OWNER);

    expect(quiet).toHaveLength(1);
    expect(quiet[0]).toMatchObject({
      personId: maria,
      name: "Maria Santos",
      homeGroupId: tuesdayGroup,
      homeGroupName: "Tuesday BGroup",
      consecutiveMissed: 3,
      threshold: 3,
      lastSeen: "2026-06-09",
    });
  });

  it("does not flag a member who was at the most recent held meeting", async () => {
    await held(tuesdayGroup, "2026-06-02", 0);
    await held(tuesdayGroup, "2026-06-09", 1);
    await held(tuesdayGroup, "2026-06-16", 2);
    const latest = await held(tuesdayGroup, "2026-06-23", 3);
    await tick(latest, maria);

    expect(await getQuietMembers(TEST_OWNER)).toEqual([]);
  });

  it("lets a NULL-session presence reset the streak (#26/#65)", async () => {
    await held(tuesdayGroup, "2026-06-02", 0);
    const fellowship = await held(tuesdayGroup, "2026-06-09", null);
    await held(tuesdayGroup, "2026-06-16", 2);
    // Present at the fellowship night, covered nothing — still contact.
    await tick(fellowship, maria, "present-only");

    // Only the two nights after the fellowship one are missed: 2 < 3.
    expect(await getQuietMembers(TEST_OWNER)).toEqual([]);
  });

  it("never ticks the counter across a cancelled month (#50/#64)", async () => {
    const one = await held(tuesdayGroup, "2026-06-02", 0);
    const two = await held(tuesdayGroup, "2026-06-09", 1);
    const three = await held(tuesdayGroup, "2026-06-16", 2);
    await tick(one, maria);
    await tick(two, maria);
    await tick(three, maria);
    // A cancelled month: four nights called off, none held.
    await addCancelledMeeting(TEST_OWNER, tuesdayGroup, "2026-06-23");
    await addCancelledMeeting(TEST_OWNER, tuesdayGroup, "2026-06-30");
    await addCancelledMeeting(TEST_OWNER, tuesdayGroup, "2026-07-07");
    await addCancelledMeeting(TEST_OWNER, tuesdayGroup, "2026-07-14");

    expect(await getQuietMembers(TEST_OWNER)).toEqual([]);
  });

  it("uses each group's own threshold", async () => {
    const groupA = await createGroup(TEST_OWNER, {
      name: "BGroup A",
      weekday: 1,
      startTime: "19:00",
      durationMinutes: 90,
      currentBookId: bookOne,
    });
    const groupB = await createGroup(TEST_OWNER, {
      name: "BGroup B",
      weekday: 3,
      startTime: "19:00",
      durationMinutes: 90,
      currentBookId: bookOne,
    });
    await setQuietThreshold(TEST_OWNER, groupA, 2);
    await setQuietThreshold(TEST_OWNER, groupB, 4);

    const ana = await createPerson(TEST_OWNER, {
      name: "Ana Reyes",
      homeGroupId: groupA,
      joinedOn: "2026-05-01",
    });
    const bea = await createPerson(TEST_OWNER, {
      name: "Bea Lim",
      homeGroupId: groupB,
      joinedOn: "2026-05-01",
    });

    // Same attendance history for both: three held nights, all missed.
    for (const date of ["2026-06-01", "2026-06-08", "2026-06-15"]) {
      await held(groupA, date, 0);
      await held(groupB, date, 0);
    }

    const quiet = await getQuietMembers(TEST_OWNER);

    // A flags at 2 missed; B needs 4 and has only 3 held nights.
    expect(quiet.map((member) => member.personId)).toEqual([ana]);
    expect(bea).toBeDefined();
  });

  it("does not flag a member for meetings held before they joined the group (#28)", async () => {
    // Three held nights the group ran before Ben was ever in it.
    await held(tuesdayGroup, "2026-06-02", 0);
    await held(tuesdayGroup, "2026-06-09", 1);
    await held(tuesdayGroup, "2026-06-16", 2);

    const ben = await createPerson(TEST_OWNER, {
      name: "Ben Cruz",
      homeGroupId: tuesdayGroup,
      joinedOn: "2026-06-20",
    });

    // Ben has missed nothing yet — those nights are not his to miss.
    const quiet = await getQuietMembers(TEST_OWNER);
    expect(quiet.map((member) => member.personId)).not.toContain(ben);

    // Once the group holds three nights he could have been at and skips them all,
    // he is quiet like anyone else.
    await held(tuesdayGroup, "2026-06-23", 3);
    await held(tuesdayGroup, "2026-06-30", 4);
    await held(tuesdayGroup, "2026-07-07", 5);

    const later = await getQuietMembers(TEST_OWNER);
    expect(later.find((member) => member.personId === ben)).toMatchObject({
      consecutiveMissed: 3,
      threshold: 3,
    });
  });

  it("never flags a stepped-away member (#10/#66)", async () => {
    await held(tuesdayGroup, "2026-06-02", 0);
    await held(tuesdayGroup, "2026-06-09", 1);
    await held(tuesdayGroup, "2026-06-16", 2);
    await setSteppedAway(TEST_OWNER, maria, true);

    expect(await getQuietMembers(TEST_OWNER)).toEqual([]);
  });

  it("reports last-seen from the most recent completion anywhere, ride-alongs included (#31)", async () => {
    const saturdayGroup = await createGroup(TEST_OWNER, {
      name: "Saturday BGroup",
      weekday: 6,
      startTime: "16:00",
      durationMinutes: 90,
      currentBookId: bookOne,
    });

    await held(tuesdayGroup, "2026-06-02", 0);
    await held(tuesdayGroup, "2026-06-09", 1);
    // A ride-along at another group, between the home group's nights.
    const visit = await addHeldMeeting(TEST_OWNER, saturdayGroup, "2026-06-11", {
      bookId: bookOne,
      sessionId: sessions[2],
    });
    await tick(visit, maria);
    await held(tuesdayGroup, "2026-06-16", 3);
    await held(tuesdayGroup, "2026-06-23", 4);

    const quiet = await getQuietMembers(TEST_OWNER);

    // The ride-along is still contact (last seen), but it is not a night of her
    // home group, so it does not reset the home-group streak.
    expect(quiet).toHaveLength(1);
    expect(quiet[0]).toMatchObject({
      personId: maria,
      consecutiveMissed: 4,
      lastSeen: "2026-06-11",
    });
  });

  it("ignores removed people and people with no home group", async () => {
    await held(tuesdayGroup, "2026-06-02", 0);
    await held(tuesdayGroup, "2026-06-09", 1);
    await held(tuesdayGroup, "2026-06-16", 2);

    await createPerson(TEST_OWNER, { name: "No Group", homeGroupId: null });
    const gone = await createPerson(TEST_OWNER, { name: "Gone Away", homeGroupId: tuesdayGroup });
    await removePerson(TEST_OWNER, gone);

    const quiet = await getQuietMembers(TEST_OWNER);
    expect(quiet.map((member) => member.name)).toEqual(["Maria Santos"]);
  });
});
