---
issue: 12
title: Settings screen + PIN/biometric app lock
status: done
blocked-by: [1]
type: afk
---

# Settings screen + app lock

## Goal
The Settings screen exists (reached per the boards' navigation, not a sixth tab) and the app locks behind a PIN with biometric unlock where the device supports it: reopening the app after sign-in asks for PIN/biometric before showing any roster data.

## Scope
- Google sign-in + **app PIN/biometric lock** (#19) — the lock half; sign-in shipped in issue 1.
- Settings surface that later issues hang rows on (issue 8 adds the quiet threshold row).

## Notes
- Lock (#19): protects a signed-in session on a lost/borrowed phone — it gates the UI, it is NOT encryption (end-to-end encryption was rejected). PIN set at first run after sign-in; biometric via WebAuthn platform authenticator (`userVerification: 'required'`) with PIN fallback; a forgotten PIN is recoverable by re-authenticating with Google (the account, not the PIN, is the identity).
- Lock triggers on app open and on return-to-foreground after a grace interval; pick a sensible default (e.g. 1 minute) and note it in the session report — it wasn't specified.
- Settings content per the board: the lock controls, plus placeholders ONLY for rows the board shows that belong to other issues (quiet threshold = issue 8 — leave a clean seam, don't build a disabled fake row).
- English UI (#29/#66); vocabulary rules apply (no "Sync"/"back up" anywhere — if the board shows them, the words changed: **Upload** / **Export**).
- Tests: lock-state logic unit-tested (grace interval, wrong PIN, Google re-auth reset); WebAuthn mocked. TDD red first.
- Normative on any gap: `/home/jericho/biblestudy-tracker/DESIGN-CONCEPT.md`.

## Looks like
- `/home/jericho/biblestudy-tracker/design/Settings.dc.html` — governs layout and copy tone; stale vocabulary overridden per #66.
- Render: `node /home/jericho/biblestudy-tracker/design/preview/build.js Settings '[{}]'`. Human comparison required before done.
