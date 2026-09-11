# notes — BST v1.1

Discovered-but-under-the-bar findings go here, one line each: what was
observed, where, the date. Anything that clears the bar becomes a numbered
issue in this folder instead.

- **2026-09-11 — issue 1: the attendance sheet's client-side ride-along filter
  now matches nickname or name. It is display logic in a client component, and
  this repo has no component-test harness — it rides the issue's Looks-like
  gate rather than a unit test.**
- **2026-09-11 — issue 2: the salvation prayer shows on the person's page and in
  the form only — the Reports person sheet still carries Baptized and not this.
  Say the word if you want it in the export.**
- **2026-09-11 — local QA: `qa-mint-session.mts` mints for `leader@example.com`,
  which the local allowlist refuses (`requireUser` re-checks `ALLOWED_EMAILS`
  every request and redirects to /signin). Mint for the allowlisted owner
  address instead; `qa-seed-birthdays.mts` defaults to that address, override
  with `QA_OWNER`.**
