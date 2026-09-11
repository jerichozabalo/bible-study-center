# notes — BST v1.2

Discovered-but-under-the-bar findings go here, one line each: what was
observed, where, the date. Anything that clears the bar becomes a numbered
issue in this folder instead.

- **2026-09-11 — scope calls made while slicing #1, deliberate so nobody
  re-decides silently:** the log has **no LIMIT/pagination** (single user,
  weekly cadence — hundreds of rows max; add "load more" only if it ever
  bites); the route slug **stays `/calendar`** (a `/meetings` rename is its own
  chore; nothing depends on it); log cards show **no attendance count** ("12
  attended" was considered — the sheet is the detail surface; say the word if
  the log should carry it); the tab **icon stays the calendar glyph**.
- **2026-09-11 — not in #1's scope:** nothing else from the v1.1 backlog
  (certificates, leader accounts, reminders) rides along; the calendar view's
  own behaviour is frozen (no Week/Month/ghost/agenda changes).
- **2026-09-11 — #1's browser QA pass came back clean** (list default, day
  order, all statuses, resolve-from-list, both offline stashes; local
  Chromium over CDP, test branch). Local-QA plumbing fixed in the same
  commit: `qa-seed-calendar.mts` seeds the log's history and takes
  `QA_OWNER`, defaulting to the allowlisted owner — seeding for the
  placeholder address signs in to an empty app (v1.1's finding, now fixed
  in-repo).
