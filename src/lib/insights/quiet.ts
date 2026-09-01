/**
 * The quiet list (#10/#64) — Home's "Needs you" attention list.
 *
 * The read-only half of the app again (PRD module 6): nothing here is stored.
 * "Quiet" is what a set of completions means against a group's held meetings,
 * recomputed every time Home is drawn. The rules, all from the decision log:
 *
 * 1. **The unit is held meetings, never weeks (#64).** A member is quiet when
 *    they have missed their HOME group's last N held meetings in a row, counting
 *    back from the most recent one. N is that group's own `quiet_threshold`
 *    (#10 — per-group, default 3).
 * 2. **Cancelled and never-scheduled nights never tick the counter (#50/#64).**
 *    Only `status = 'held'` meetings are in the window, so a cancelled month
 *    freezes the streak rather than growing it — the app's most pastoral
 *    feature must not fire on the leader's own cancellation.
 * 3. **Any completion row breaks the streak (#26/#65).** A crediting session
 *    tick and a NULL-session presence (a fellowship night, or 'present only')
 *    both mean the member was in the room, which is what #64 counts. No row is
 *    what "missed it" looks like.
 * 4. **"Stepped away" is a separate state (#10/#66).** Those members are
 *    excluded from the flag entirely — they still appear on the roster, but
 *    Quiet and Stepped-away never become synonyms.
 *
 * Guests / ride-alongs (#31): the streak runs against the person's HOME group's
 * held meetings only. A ride-along at another BGroup is still contact — it is
 * the person's most recent `lastSeen` — but it is not one of their home group's
 * nights, so it does not reset the home-group streak. (Judgement call where #64
 * is silent; see the issue-8 report.)
 *
 * A group that stops meeting entirely flags nobody new — there are no fresh
 * held meetings to miss. #52's past-due flags surface that, not this (#64).
 *
 * Mid-book joiners (#28): the window is only the held meetings on or after the
 * day a member joined their home group. A night the group held before they were
 * in it is not one they "missed", so someone added to a running group does not
 * land on Home's attention list the moment they are typed in — the same seam
 * `insights/progress` draws its joined-at markers from.
 */
import { query } from "../db";

/** One member on the attention list, with the situation described, not graded. */
export type QuietMember = {
  personId: string;
  name: string;
  homeGroupId: string;
  homeGroupName: string;
  /** Missed held meetings in a row, counting back from the most recent. */
  consecutiveMissed: number;
  /** That group's threshold (#10) — `consecutiveMissed` has reached it. */
  threshold: number;
  /** `YYYY-MM-DD` of their most recent completion anywhere; null if never. */
  lastSeen: string | null;
};

/**
 * Every member across the leader's groups who has gone quiet, most missed
 * first, then alphabetical — the order a "Needs you" list wants.
 */
export async function getQuietMembers(ownerId: string): Promise<QuietMember[]> {
  const rows = await query<{
    person_id: string;
    name: string;
    home_group_id: string;
    home_group_name: string;
    consecutive_missed: number;
    threshold: number;
    last_seen: string | null;
  }>(
    `WITH held AS (
       SELECT m.id,
              m.group_id,
              m.date,
              row_number() OVER (
                PARTITION BY m.group_id
                ORDER BY m.date DESC, m.start_time DESC, m.id DESC
              ) AS recency
         FROM meetings m
        WHERE m.owner_id = $1 AND m.status = 'held'
     ),
     attendance AS (
       SELECT p.id AS person_id,
              p.name,
              g.id AS group_id,
              g.name AS group_name,
              g.quiet_threshold,
              h.recency,
              EXISTS (
                SELECT 1 FROM completions c
                 WHERE c.owner_id = $1
                   AND c.person_id = p.id
                   AND c.meeting_id = h.id
              ) AS attended
         FROM people p
         JOIN groups g ON g.id = p.home_group_id AND g.owner_id = $1
         -- #28 — only nights the member could have been at: their current
         -- membership's join date onward. A group held meeting before they
         -- joined is not one they missed.
         LEFT JOIN group_memberships gm
           ON gm.person_id = p.id AND gm.group_id = g.id AND gm.ended_on IS NULL
         JOIN held h ON h.group_id = g.id
          AND (gm.joined_on IS NULL OR h.date >= gm.joined_on)
        WHERE p.owner_id = $1
          AND p.removed_at IS NULL
          AND p.stepped_away_on IS NULL
     ),
     streaks AS (
       SELECT person_id,
              name,
              group_id,
              group_name,
              quiet_threshold,
              (COALESCE(min(recency) FILTER (WHERE attended), max(recency) + 1) - 1)::int
                AS consecutive_missed
         FROM attendance
        GROUP BY person_id, name, group_id, group_name, quiet_threshold
     )
     SELECT s.person_id,
            s.name,
            s.group_id AS home_group_id,
            s.group_name AS home_group_name,
            s.consecutive_missed,
            s.quiet_threshold AS threshold,
            (
              SELECT to_char(max(m2.date), 'YYYY-MM-DD')
                FROM completions c2
                JOIN meetings m2 ON m2.id = c2.meeting_id
               WHERE c2.owner_id = $1
                 AND c2.person_id = s.person_id
                 AND m2.status <> 'cancelled'
            ) AS last_seen
       FROM streaks s
      WHERE s.consecutive_missed >= s.quiet_threshold
      ORDER BY s.consecutive_missed DESC, lower(s.name) ASC`,
    [ownerId],
  );

  return rows.map((row) => ({
    personId: row.person_id,
    name: row.name,
    homeGroupId: row.home_group_id,
    homeGroupName: row.home_group_name,
    consecutiveMissed: row.consecutive_missed,
    threshold: row.threshold,
    lastSeen: row.last_seen,
  }));
}
