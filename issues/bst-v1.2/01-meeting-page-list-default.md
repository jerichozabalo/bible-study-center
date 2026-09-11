---
issue: 1
title: Meeting page — List default + Calendar view (tab renamed from Calendar)
status: in-progress
blocked-by: []
type: afk
---

# Meeting page — List default + Calendar view

## Goal
The Calendar tab is the **Meeting** tab. Opening it lands on the **List** — the
meeting log: every meeting dated today or earlier (Manila, #56), newest first,
scrolling back through history — with the existing calendar one segment away.
The rename is user-facing; the route slug stays `/calendar`.

## Read first
`CLAUDE.md`, `DESIGN-CONCEPT.md` (esp. #46, #47, #49, #50, #52, #56, #61/#70,
#62, #66), this folder's `PRD.md`, then `src/components/TabBar.tsx`,
`src/app/(shell)/calendar/{page,CalendarView}.tsx`,
`src/lib/meetings/meetings.ts` (+ its `meetings.test.ts` harness).

## Scope
- "As the leader, opening the Meeting tab lands me on the log — the most recent
  night first, every meeting I've recorded behind it…"
- "As the leader, I switch to the Calendar segment and get the usual
  month/week view, and back returns me to the list…"
- "As the leader, I resolve a past-due night, or open any night's sheet,
  straight from the log…"

## Notes
- **Rename** — tab label (`TabBar`) and page `<h1>` become "Meeting".
  `design/Main.dc.html` predates this; the decision log wins on copy (the #62
  merge set the precedent). Icon unchanged (the calendar glyph still reads as
  the section) — vetoable on sight. Code comments that call this "the calendar
  page" refresh in passing; the *view* inside keeps the word calendar.
- **Views** — one `SegmentedControl` (Links, so back works and a view can be
  linked): **List** = `/calendar` (bare, default), **Calendar** =
  `/calendar?view=calendar` (parse like Reports does `?view=`). Missing or
  unknown `view` ⇒ List. No remembered view (#46's rejection stands).
- **The log read** — new `listMeetingLog(ownerId, { to })` in
  `src/lib/meetings/meetings.ts`, beside `listUpcomingMeetings`:
  `WHERE m.owner_id = $1 AND m.date <= $2::date`,
  **`ORDER BY m.date DESC, m.start_time ASC`** — days newest-first, a day's own
  nights in evening order. ALL statuses: the log is the record (#50 cancelled
  never hidden; #52 past-due resolve stays reachable; #47 held stays
  deliberate). No LIMIT — single user, weekly cadence, hundreds of rows is the
  ceiling (parked in `notes.md` if it ever grows).
- **The page** — server component keeps its page-level reads (one
  `materializeSchedule` pass, the calendar window, ghosts — small queries,
  single user) and adds the log read. `CalendarView` keeps its week/month
  state (#46); the page `<h1>` now sits above the segments for both views. The
  calendar view keeps its Today + Week/Month controls — layout follows the
  boards' spacing idiom, Jericho's eye settles it. Empty log (nothing on or
  before today): one quiet line in the idiom of Home's "Nothing scheduled yet."
- **The card** — extract `MeetingCard` (+ `PastDueActions`) out of
  `CalendarView.tsx` into a shared component both views import; its rendered
  output must be identical in the calendar (no visual change there). The list
  groups days under a small day header using the existing `formatWeekdayDate`
  idiom, a day's cards under it in `start_time` order. Future-dated rows and
  ghosts (#49) never enter the list.
- **Offline (#61/#70)** — `/calendar` keeps its `OFFLINE_READABLE` role; the
  stash keys on `pathname + search` so each view serves its own last render,
  falling back to the bare path's stash, then `/offline`; `CACHE` bump
  `bst-v3` → `bst-v4`. Still network-first — an online open is always fresh.
- **Tests** (red observed first, server boundary, Neon test branch — the
  `meetings.test.ts` harness + `tests/meeting-fixtures.ts`): log returns
  today-or-earlier only (today's row included, tomorrow's excluded — the #56
  boundary); newest-first including the within-day `start_time` order; all
  three statuses present; owner-scoped (`someone.else@example.com` sees none);
  empty case returns `[]`.
- **Loops** — `npm run test` / `typecheck` / `lint` / `build`, all green
  before done. No migration, so no `db:migrate` step.
- **Before Jericho's pass** — an automated browser QA pass on the test branch
  (minted session for the allowlisted owner address — `qa-mint-session.mts`
  defaults to a placeholder the guard refuses; serve with
  `npm run build && npx next start -p <deliberate port>`): default lands on
  List, segment switch + back, log order on seeded data, resolve-from-list,
  offline stash for both views. `scripts/qa-seed-calendar.mts` seeds this
  page's world.
- One commit, `(bst-v1.2 #1)`; commit but **never push**.

## Status 2026-09-11

**Built, browser-QA'd, committed and DEPLOYED — the last gate is Jericho's
phone pass.**

- The log read (`listMeetingLog` + 6 tests, red observed first), the shared
  card (`components/meetings/MeetingCard`, extracted so the List and the
  agenda draw one), `MeetingLogView`, the page's List/Calendar segments, the
  tab rename, and the per-view SW stash (`bst-v4`). **543 tests green**;
  typecheck / lint / build clean.
- **Browser QA pass** (local Chromium over CDP, test branch, seeded): default
  lands on the List; day headers read exactly newest-first; held, cancelled
  (grey + struck) and the past-due NEEDS CONFIRMING all render; resolving
  from the list flips the card in place; the Calendar segment still matches
  `design/Calendar.dc.html` (only the deliberate header changes); both views
  serve their own stashed render offline; zero runtime exceptions. Shots:
  `/tmp/bst-qa/*.png` (local, disposable).
- Assumption recorded: the calendar's window/ghost reads run only when the
  Calendar view is landed — a List open costs one read; the materialiser
  stays unconditional (#5 horizon).
- The QA seeder now seeds the log's history and takes `QA_OWNER` (default:
  the allowlisted owner — the placeholder address is refused by the local
  allowlist; v1.1's note). Stale placeholder-owner rows remain on the test
  branch; owner-scoped reads ignore them.
- **Deployed 2026-09-11** — `dpl_6WCJCqrNx9VBPK7ReMavmYYoevDv`, alias verified
  307 → `/signin` → 200; the live `sw.js` carries `bst-v4`; commit `9d33112`
  pushed. Still owed: Jericho's phone pass; the DESIGN-CONCEPT v1.2 entry and
  the memory update land with this record.

## Looks like
- No board draws the list view. Gate: (1) the cards are
  `design/Calendar.dc.html`'s agenda cards — the extracted component must
  render them identically in both views; (2) the segmented control is the
  drawn `SegmentedControl` (Groups.dc.html / Reports idiom); (3) Jericho's
  eyeball on the whole page, tab rename included.
- Calendar-view regression check:
  `node design/preview/build.js Calendar '[{"view":"week","day":16}]'`
  (prebuilt at `design/preview/Calendar-preview.html`) — the calendar side
  must still match it.
- Boards stay as-is on landing (they predate the rename, same as the #62
  merge); the decision log's v1.2 entry is the correction.
