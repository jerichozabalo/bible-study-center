/**
 * The four public numbers (ministry-support-site issue 2) — the only thing in
 * this app anyone can read without signing in.
 *
 * The support site's appeal page needs to say the ministry is real and moving,
 * and four integers do that. Everything else stays behind #71's sign-in, so
 * this module is written as a boundary rather than as another derivation:
 *
 * 1. **The shape is the contract, and it is exactly four keys.** They are
 *    snake_case because they are the wire, not TypeScript — another repo reads
 *    them over HTTP, and the route serialises this object unchanged rather than
 *    rebuilding it. A fifth field added here reaches a public web page, so the
 *    test asserts the key set and not merely the four values.
 * 2. **Aggregates only, no rows.** No name, nickname, phone, group name or date
 *    leaves this file. That is the whole reason the endpoint is allowed to be
 *    unauthenticated.
 * 3. **One leader's ministry, never the whole table.** v1 is single-user (#1)
 *    and the endpoint takes no parameters, so the owner comes from the
 *    allowlist (`ministryOwnerId`) and never from the request. Every count is
 *    scoped by `owner_id` like every other query in the app.
 * 4. **The roster's own definitions.** "Still meeting" is a BGroup with no
 *    `archived_at`; a member is a person with no `removed_at` (#24 — removal is
 *    a date, and a removed person is not someone to count in public); a session
 *    is a meeting that was HELD (#47), so a cancelled night (#50) or a merely
 *    proposed one (#73) is not one. People who have stepped away (#10) are
 *    still members, exactly as in the Reports roll-up.
 *
 * Nothing here is cached or stored. Freshness is the consuming site's business
 * (it revalidates hourly); this answers with what is true when it is asked.
 */
import { parseAllowlist } from "../auth/allowlist";
import { addDays, manilaToday } from "../dates";
import { query } from "../db";
import { allowedEmails } from "../env";

/** The response body, key for key. Widening this widens a public page. */
export type PublicMinistryStats = {
  /** BGroups currently meeting. */
  studies_active: number;
  /** People on the roster — counted once each, not once per membership (#27). */
  members_total: number;
  /** People whose `joined_on` (#9b) falls in the 30 days ending today. */
  new_this_month: number;
  /** Cumulative all-time HELD meetings (#47). */
  sessions_held: number;
};

/** How many days "new_this_month" looks back, counting today as one of them. */
const NEW_WINDOW_DAYS = 30;

/**
 * Whose ministry the public numbers describe.
 *
 * v1 is single-user (#1): the allowlist holds exactly one address, and that
 * address is the `owner_id` every row carries. Read through `parseAllowlist` so
 * the owner is normalised the same way sign-in normalises the email it stamps.
 * Null means the deployment has no allowlist — a deployment that is not
 * finished, which the route answers as an error rather than as four zeros.
 */
export function ministryOwnerId(): string | null {
  return parseAllowlist(allowedEmails())[0] ?? null;
}

/**
 * The four numbers, in one round trip — one public request should be one query.
 *
 * `today` is Manila's day (#56), passed in so the window is the one Jericho is
 * standing in rather than the one Vercel's UTC clock is in.
 */
export async function getMinistryStats(
  ownerId: string,
  today: string = manilaToday(),
): Promise<PublicMinistryStats> {
  const since = addDays(today, -(NEW_WINDOW_DAYS - 1));

  const [row] = await query<PublicMinistryStats>(
    `SELECT (SELECT count(*)
               FROM groups
              WHERE owner_id = $1 AND archived_at IS NULL)::int AS studies_active,
            (SELECT count(*)
               FROM people
              WHERE owner_id = $1 AND removed_at IS NULL)::int AS members_total,
            -- Both ends closed: a joined-on date that has not arrived yet is
            -- not someone who joined in the last 30 days.
            (SELECT count(*)
               FROM people
              WHERE owner_id = $1
                AND removed_at IS NULL
                AND joined_on BETWEEN $2::date AND $3::date)::int AS new_this_month,
            (SELECT count(*)
               FROM meetings
              WHERE owner_id = $1 AND status = 'held')::int AS sessions_held`,
    [ownerId, since, today],
  );

  // Rebuilt field by field rather than returned as selected: the row is what
  // the query happens to have asked for, and this object is the contract.
  return {
    studies_active: row.studies_active,
    members_total: row.members_total,
    new_this_month: row.new_this_month,
    sessions_held: row.sessions_held,
  };
}
