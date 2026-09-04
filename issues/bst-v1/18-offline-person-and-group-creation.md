---
issue: 18
title: Person and group creation work offline (outbox extension)
status: done
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

## Status — DONE. Tier 1 `5396841` (2026-09-03), Tier 2 2026-09-04.

### Tier 2 — shipped 2026-09-04
1. **`"failed"` status + `retry()`.** `OutboxItem.status` is now
   `"pending" | "failed" | "done"` with an `error?` note. A *non-transient*
   throw from a handler (the server refusing the write — a deleted parent, a
   name clash) marks the item `failed`, records the message, and stops the
   flush; a *transient* throw (`isTransient`) still leaves it `pending` so the
   reconnect flush resumes on its own — that distinction is the whole design.
   `Outbox.retry()` resets every `failed → pending`, clears the note, and
   flushes; `OutboxProvider` exposes it as `retry()`. `refresh()` now keeps
   failed rows in `itemsSnapshot()` (the lists/forms need them) but *out* of the
   pending count (`snapshot()` / `pending()` stay pending-only — a failed row is
   waiting on a tap, not a connection).
2. **Pending / failed rows on People and the Groups segment.**
   `src/lib/outbox/pending.ts` (new — split from `transport.ts` so it has no
   `server-only` in its import graph and a node test can reach it) holds the
   write-type constants, the payload types, `pendingGroups`, and the new
   `pendingRosterRows(items, type)`. `PendingRosterRows` (client) renders those
   above the server list on `/people` (hidden while searching) and
   `/people/groups`: a dashed "Uploads when you have signal" row for pending, an
   amber row with the server's reason + a "Try again" button (→ `retry()`) for
   failed. `pending.test.ts` covers the derivation.
3. **Settings + Reports online-only note.** `OnlineOnlyNote` (client) —
   `navigator.onLine`, renders nothing when online, a plain line under the `<h1>`
   when offline. No pending state, per #72 as amended.

**Known cosmetic gap (for phone QA):** on `/people` with an empty server roster
and a queued offline person, the "Nobody on the roster yet" card still renders
below the pending row. Honest (nobody is on the *server* roster yet) but reads
oddly — left for Jericho to judge on the phone.

### Tier 1 — shipped 2026-09-03 (`5396841`)
**Done and tested:** the offline write path and its dependency graph, end to end.
`createPerson` / `createGroup` take an optional `clientId` used as the row PK
(`COALESCE($n::uuid, gen_random_uuid())` + `ON CONFLICT (id) DO NOTHING`, replay
re-selects — mirrors `createMeeting`, no migration needed); `uploadPerson` /
`uploadGroup` server actions; `PERSON_WRITE` / `GROUP_WRITE` transport handlers;
`PersonPayload.homeGroupRef` and `MeetingPayload.groupRef` resolve through
`ctx.resolve()` like `SheetPayload.meetingRef`; `GroupForm` / `PersonForm` /
`NewMeetingForm` enqueue offline and offer still-queued BGroups as options;
`outbox.itemsSnapshot()` / `OutboxProvider.pendingWrites` expose the queue to
forms. Integration test covers `group → person → meeting → sheet` replaying from
one flush in dependency order, once each, resuming after a mid-flush failure
with no duplicate rows. 504 tests green.

**What was LEFT (now done — see "Tier 2" above):**
1. ~~`"failed"` `OutboxItem` status + retry.~~
2. ~~Pending / failed row states on `/people` and the Groups segment.~~
3. ~~Settings + Reports say "online-only" when offline.~~

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
