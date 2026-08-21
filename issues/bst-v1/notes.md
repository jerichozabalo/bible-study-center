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
