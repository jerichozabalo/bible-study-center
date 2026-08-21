---
issue: 11
title: Attendance outbox (offline queue, in-order Upload)
status: open
blocked-by: [4, 6]
type: afk
---

# Attendance outbox

## Goal
Taking attendance and creating a meeting work with no signal: writes queue on-device and Upload on reconnect, replayed in order. The UI shows a pending count and "Saves offline. Uploads when you have signal." Everything else clearly states it needs a connection. The calendar reads from cache offline.

## Scope
- "As the leader, I take attendance with no signal and it uploads when I reconnect…"
- The single offline exception (#72); calendar offline read (#61 as narrowed by #70).

## Notes
- Scope is exactly **attendance ticks + meeting creation** — the two things done in a room with no signal (#72). People, groups, settings, reports stay online-only and **say so** when offline; no pending/failed states on those screens.
- Mechanics (#72): append-and-send queue, NOT a merge engine. Single writer (#1), replayed **in order**, **server assigns the timestamps**. Client storage: IndexedDB (survives app restarts; wrap reads/writes in try/catch).
- Idempotency: replayed meeting-creation leans on #73's partial unique index (`ON CONFLICT DO NOTHING`); attendance replay leans on Completion's (person, meeting) uniqueness — a retried flush must never duplicate rows.
- The word is **Upload** (#66/#72): pending attendance leaving the phone. ⛔ "Sync" and "back up" are retired; **Export** means CSV only.
- A queued item that references a not-yet-uploaded meeting (offline-created meeting + its attendance) must replay in dependency order — meeting first, then its completions.
- Calendar (#61): reads from cache offline — cache the last-fetched range (service worker or client cache) so the schedule is viewable without signal; ghosts still draw (schedule data cached with groups).
- Network reality: IPv4-first + retry/backoff mandatory; Neon autosuspend throws `fetch failed` on first hit — the flush retry path is the normal path, not the edge case.
- Tests (per PRD): client-side with a **faked transport** — in-order replay; retry after mid-flush failure resumes without duplicates (server rows asserted against test Postgres); offline-created meeting + attendance replay in dependency order; pending count accurate across restart.
- Normative on any gap: `/home/jericho/biblestudy-tracker/DESIGN-CONCEPT.md`.

## Looks like
- No dedicated artboard — the pending/Upload affordances appear on `/home/jericho/biblestudy-tracker/design/Attendance.dc.html` ("Saves offline…" copy) and the Home card on `/home/jericho/biblestudy-tracker/design/Main.dc.html`. Follow their idiom; ⚠️ any board copy saying "Syncs" is stale vocabulary — the word is "Uploads" (#66/#72).
