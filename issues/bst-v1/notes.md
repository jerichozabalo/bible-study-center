# Notes

True observations that did not clear the bar for a numbered issue: nobody is
blocked or harmed by them at today's scale. One line each — what was seen,
where, and when. Promote to an issue the day one actually bites.

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
  which will be wrong for `cancelled` once issue 5 can cancel one.
  `src/app/(shell)/page.tsx`. Unreachable today: nothing sets `cancelled` yet.
  Issue 5 owns the greyed-and-struck-through rendering and should fix this line
  as it lands.
- **2026-08-21 — `src/lib/migrate.test.ts` asserts a global truth about a
  shared branch** (`appliedMigrations() === migrationFiles()`). Every parallel
  worktree sees it red, because the one test database's ledger holds migrations
  whose files exist only in a sibling tree. It goes green the moment everything
  is merged. Cost three agents an investigation each; kept as a note rather than
  an issue because the assertion is correct for the single-tree case that is
  normal.
