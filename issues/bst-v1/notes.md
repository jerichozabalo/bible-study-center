# Notes

True observations that did not clear the bar for a numbered issue: nobody is
blocked or harmed by them at today's scale. One line each — what was seen,
where, and when. Promote to an issue the day one actually bites.

- **2026-08-27 — Issue 5 browser QA pass: 17/18 checks PASS, no functional
  failures.** Ghost taps + idempotency, past-due resolve, cancelled rendering,
  the attendance route (tap card → sheet → save → held), Week/Month layout and
  paging all verified against a seeded test DB. Fixed on the spot: agenda now
  tracks period paging; past-due card got its amber well + blue bar back; resolve
  buttons made equal-width; held-link copy softened. Seed/session helpers live
  at `scripts/qa-{seed-calendar,mint-session}.mts` (need `SESSION_SECRET` +
  `DATABASE_URL=$TEST_DATABASE_URL`).
- **2026-08-27 — Issue 5 coverage gaps the QA pass could not exercise:** the
  same-hour column split and the "+N" collapse (#58) never rendered (seed has
  one meeting per group per day); schedule-change shifting future PROPOSED
  meetings (#48b) is adjacent to issue 5 and untested end-to-end; offline cache
  read (#61/#70) waits on issue 11. Worth a targeted seed when someone next
  touches the calendar.
- **2026-08-25 — Mobile tabs scroll away if `h-dvh` has no `h-screen` fallback.**
  `src/app/(shell)/layout.tsx` and all full-height pages (`signin`, `offline`,
  `PinPad`). `dvh` (dynamic viewport height) is unsupported on some browsers —
  notably iOS Safari < 16.4 and standalone PWA mode — causing the unit to resolve
  to `auto` and the TabBar to scroll off with the page. Fixed by adding
  `h-screen` (=`100vh`) before `h-dvh` everywhere, so browsers that don't
  understand `100dvh` fall back to `100vh` and keep the tab bar pinned.
  Browsers that do support it still get the dynamic height; either way the
  container has a real height and `overflow-hidden` on the outer flex contains
  the scroll to the inner `.scroll` div.

- **2026-08-21 — Turning the app lock OFF asks for nothing.** `LockSettings.tsx`.
  Anyone holding an already-unlocked phone can disable it. Under the bar because
  #19's threat model is a borrowed or lost phone, and someone holding it
  unlocked can already read the whole roster — disabling the lock gains them
  nothing they do not already have. Requiring the current PIN there is a
  defensible tightening if Jericho ever wants it.
- **2026-08-21 — Biometric unlock never auto-prompts.** `LockScreen.tsx`. It is
  a button the leader taps, not a prompt that fires when the pad appears. That
  is a UX preference, not a defect; one line to change if Jericho expects
  Face/Touch to fire on open.
- **2026-08-21 — While locked, the shell is hidden but hydrated**, and the
  current screen's RSC payload is in the page source. `AppLock.tsx` says so in a
  comment. Correct for #19 (a UI gate, explicitly not encryption); the note
  exists so nobody later mistakes "locked" for "protected from devtools".
- **2026-08-21 — `src/lib/db.test.ts` carries its own `configured` constant**
  duplicating `dbConfigured` in `tests/fixtures.ts`. Converge them whenever
  something else touches that file.
- **2026-08-21 — Vercel's env pull writes QUOTED values into `.env.local`.**
  `dotenv` strips the quotes, so the app is fine — but anything that greps the
  file instead of parsing it gets a value wrapped in `"`, and the Neon driver
  then fails with `ERR_INVALID_URL` naming a connection string that looks
  perfectly correct in the log. Cost ten minutes of chasing a phantom 500.

- **2026-08-21 — `unarchiveGroup` and `archiveGroup` skip the UUID guard.**
  `src/lib/roster/groups.ts`. Both pass `id` straight into SQL without the
  `UUID_PATTERN` test that `getGroup`/`updateGroup` apply, so a junk id raises a
  Postgres cast error (500) instead of a clean no-op. Only reachable by the
  signed-in leader with a stale tab or a hand-crafted POST. Fix the pair
  together whenever something else touches them.
- **2026-08-21 — Archiving a BGroup leaves no trail.** `unarchiveGroup` writes
  no tombstone, whereas `restorePerson` records a `"restored"` correction. #24
  covers person corrections; groups have no correction table at all. Nothing
  observable while there is one leader; it would matter at v1.1's multi-leader.
- **2026-08-21 — `listPersonCorrections` has no screen.** Tombstones accumulate
  and nothing renders them, so there is no "what did this record say before"
  view. Correct for #24 (nothing is erased); the gap is only that nobody can
  read them.
- **2026-08-21 — Removed people are reachable only from the section at the
  bottom of `/people`**, which sits below the roster and is not covered by the
  search box.
- **2026-08-21 — `listPickerGroups` issues a prefill query pair per group**
  (parallelised). `src/lib/meetings/prefill.ts`. A handful of round trips at
  Jericho's scale; wants a set-based rewrite only if the group list passes ~10.
- **2026-08-21 — Home renders "Held" for any meeting that is not proposed**,
  which would be wrong for `cancelled`. `src/app/(shell)/page.tsx`. **Resolved
  by exclusion (2026-08-27, issue 5):** `listUpcomingMeetings` filters
  `status <> 'cancelled'`, so a cancelled meeting never reaches `MeetingRow`.
  The ternary is still `proposed ? "Proposed" : "Held"`; if the Home list ever
  starts showing cancelled nights, that line needs a third branch.
- **2026-08-21 — `src/lib/migrate.test.ts` asserts a global truth about a
  shared branch** (`appliedMigrations() === migrationFiles()`). Every parallel
  worktree sees it red, because the one test database's ledger holds migrations
  whose files exist only in a sibling tree. It goes green the moment everything
  is merged. Cost three agents an investigation each; kept as a note rather than
  an issue because the assertion is correct for the single-tree case that is
  normal.
- **2026-08-21 — `listCompletionCorrections` has no screen either.**
  `src/lib/attendance/completions.ts`. The same shape as the
  `listPersonCorrections` line above: attendance corrections are tombstoned per
  #24 and nothing renders them, so the leader cannot read what a sheet said
  before he changed it.
- **2026-08-21 — Typing a walk-in's name and then tapping "Save attendance"
  discards the typed name** and saves + holds the sheet.
  `src/components/attendance/AttendanceSheet.tsx` — one form, two submits.
  Low harm (retype), but it happens mid-meeting. Observed by reading the form
  semantics, not in a browser.
- **2026-08-27 — Week time grid was missing its 34px hour-label column** (fixed
  same day). `a3da049` rendered the hour labels as `position:absolute right-0`
  over the Saturday column instead of in a leading 34px column like the board,
  so the 7 day columns sat 34px left of their day-strip headers and every
  meeting block appeared under the wrong day. The board (`Calendar.dc.html`
  lines 62–84) puts the axis in its own `width:34px` flex child.
- **2026-08-27 — The calendar agenda's "New meeting on <day>" button is inert.**
  `CalendarView.tsx` `NewMeetingButton` — a `<button type="button">` with no
  handler. The [+] tab (`/new`) is the real create path, but it takes no date
  param, so wiring this button to it would drop the day the leader tapped.
  Wants either a `?date=` on `/new` or an in-place create. Low harm — the [+]
  tab works — but the button looks broken. Found while fixing the attendance
  nav gap below.
- **2026-08-27 — Held meeting cards no longer show an attendance count.**
  `MeetingCard` used to render a hardcoded `"8 of 8 marked"` for every held
  meeting (fake — `getCalendar` fetches no completion counts). Replaced with a
  plain "Attendance taken — review" link. A real "N of M" needs the count in
  the calendar query or a per-card fetch; that belongs with issue 8/9's
  derivations, not here.
- **2026-08-21 — `getSheet` costs two round trips** (`getMeeting`, then the
  roster read). `src/lib/attendance/sheet.ts`. Irrelevant at one BGroup's
  scale; noted beside the `listPickerGroups` line above.

- **2026-09-01 — `getCatchUpTargets` names an upcoming night but the app records
  no intent**, so the same target keeps showing on a person's screen until that
  night is held. `src/lib/attendance/catchup.ts`. Expected in v1 — invite drafts
  are v1.1 (#31, closed 2026-08-20) — noted because it will read as nagging once
  several BGroups run in parallel.
- **2026-09-01 — issue 7 adds two DB round trips per attendance-page load**
  (`getSheet` + `getCatchUpCandidates`) and one per person-page load
  (`getCatchUpTargets`). Fine at today's roster size; on a cold Neon branch the
  person page now pays a second wake-up round trip. Set-based merge only if it
  ever bites.
- **2026-09-01 — issue 9 judgement calls (subagent crashed before reporting;
  supervisor reviewed the diff):** `setCurrentBook` does NOT tombstone — there
  is still no group corrections table (issue-14 gap), so advancing leaves no
  trail beyond `updated_at`; a group on a **custom book** (#22) gets no "Advance"
  button at all (`getNextBook` returns null with no number/program) — the only
  way on is "Change book"; the member-row `behind` flag is measured against what
  the *group* has held, not the whole book; the Person Progress section
  auto-opens the one in-progress book and lists every published book as "Not
  started" whether touched or not. All defensible, all commented in code —
  flagged here in case Jericho wants any of it different.
- **2026-09-01 — #68 dot-wrap layout is still only unit-tested.** `columnsFor`
  proves six columns; nobody has *looked* at Book 8's 12 dots as two rows at
  390px, or the group segment bars at that width. Promote to an issue only if
  the render is actually wrong on Jericho's phone.
- **2026-09-01 — issue 7 judgement calls not spelled out in the issue:**
  stepped-away people (#10) and people with no home BGroup are excluded from
  both the catch-up list and guest derivation; a fellowship night and an
  all-caught-up night render no catch-up section at all (silence over an empty
  state). Flagged here in case Jericho wants any of them shown.
