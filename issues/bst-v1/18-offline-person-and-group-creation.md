---
issue: 18
title: Person and group creation work offline (outbox extension)
status: in-progress
blocked-by: [11]
type: afk
---

# Offline person and group creation

## Goal
Creating a person and creating a group work with no signal: the write queues
on-device and Uploads on reconnect, replayed in order after any meetings and
attendance already ahead of it in the queue. The People and Groups screens show
a per-row pending state ("Uploads when you have signal") and a failed state that
the leader can retry. Settings and Reports stay online-only and say so.

## Why this exists
DESIGN-CONCEPT.md #72 was amended 2026-09-02 (Jericho): the outbox was
attendance-ticks + meeting-creation only, on the assumption that roster and
group setup happens at home with signal. Jericho does that setup in the field on
the same phone, so "add them now, Upload later" is the same need. This issue is
the amendment; issue 11 built the outbox foundation this extends.

## Scope
- **In:** create a person (name-only path included, #9/#67); create a group
  (with its current book + schedule as the create form already collects).
- **In:** pending/failed row states on the People list and the Groups segment;
  a retry affordance on a failed row.
- **In:** the replay **dependency graph** — a person or group created offline
  gets a client-temp id; anything queued after it that references that id
  (an offline group's members, an offline meeting's group, an offline sheet's
  walk-in) replays only after its parent has a server id, and the client-temp
  id is rewritten to the server id on success. This generalises issue 11's
  flat meeting→completions ordering.
- **Out:** editing or archiving a person/group offline (#27 archive, home-group
  transfer, "Stepped away" override) — online-only, say so.
- **Out:** Settings and Reports — online-only, unchanged, no pending states.
- **Out:** anything multi-device / v1.1 (#1 single writer, one phone).

## Notes
- Idempotency on replay: person and group creation need the same
  `ON CONFLICT DO NOTHING` / retry-safe guarantee issue 11's meeting creation
  leans on (#73's pattern). If the roster tables have no natural key that makes
  a replayed insert a no-op, add one (a client-supplied idempotency key column
  is acceptable — a new numbered `migrations/NNN_*.sql`, additive only). Decide
  this at the server boundary and write the test against the test Postgres.
- Client-temp ids: pick a scheme that cannot collide with a server UUID
  (prefix, or a separate field) so a half-flushed queue is never ambiguous
  about which ids are real.
- Storage: extend issue 11's IndexedDB queue; wrap every read/write in
  try/catch (same as #11).
- Vocabulary (#66/#72 as amended): **Upload** = pending local writes leaving
  the phone. Never "Sync" or "back up". **Export** = CSV only.
- Network reality unchanged: IPv4-first + retry/backoff mandatory; Neon
  autosuspend throws `fetch failed` on first hit — the flush retry path is the
  normal path (`src/lib/retry.ts`).
- Normative on any gap: `/home/jericho/biblestudy-tracker/DESIGN-CONCEPT.md`
  (#72 as amended 2026-09-02, #1, #9/#67, #27, #73).

## Tests (per PRD testing decisions)
- Client-side with a faked transport: a person created offline replays before a
  group that lists them, which replays before a meeting for that group, which
  replays before that meeting's attendance — full dependency order from one
  flush.
- Retry after a mid-flush failure resumes without duplicate server rows
  (asserted against the test Postgres).
- Client-temp id → server id rewrite: a downstream queued item picks up the real
  id after its parent flushes.
- Pending count and per-row pending/failed state accurate across an app restart
  (IndexedDB reload).
- Server boundary: a replayed person/group insert is a no-op, not a duplicate.

## Looks like
- No dedicated artboard. The People list is `design/People.dc.html`, the Groups
  segment lives in the same board; the Home outbox card is on
  `design/Main.dc.html`. Follow issue 11's pending/Upload idiom — same copy
  register ("Uploads when you have signal"), same word. ⚠️ any board copy
  saying "Syncs" is stale — the word is "Uploads" (#66/#72).
