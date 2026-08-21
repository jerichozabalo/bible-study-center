---
issue: 1
title: "Tracer: scaffold + Google sign-in + PWA shell + tab bar"
status: done
blocked-by: []
type: hitl
---

> **State as of 2026-08-21.** Infrastructure is provisioned and the app is
> deployed; two visual QA passes over the sign-in screen are clean against the
> board, and the full suite (56 tests, database included) is green.
>
> **Live:** https://bible-study-tayo.vercel.app
>
> Provisioned on Jericho's own Vercel team `jericho-s-projects6` (CLI signed in
> as `jerichozabalo0301-2088`), all on the Neon **Free** plan (`free_v3`):
>
> | | |
> |---|---|
> | Vercel project | `bible-study-tayo` — `prj_flsj7WgjhqsNSrpnyUnQw3rJhAx1` |
> | Production DB | Neon `bible-study-tayo`, **sin1** |
> | Test DB | Neon `bible-study-tayo-test`, **sin1** |
> | Allowlist | `jerichozabalo0301@gmail.com` (his own, not the harness login) |
>
> ⚠️ **The Vercel CLI never asks for a region** — it provisioned the first
> production database into `us-east-1` silently. It was caught and re-created in
> `sin1` while still empty. Pass `-m region=sin1` on any future
> `vercel integration add neon`; the valid keys are cle1, iad1, pdx1, fra1,
> lhr1, syd1, sin1, gru1. `vercel.json` pins functions to `sin1` for the same
> reason.
>
> **CLOSED 2026-08-21.** Human verification, as actually performed:
>
> 1. ✅ **Real Google round-trip** — Jericho signed in on the deployed URL and
>    landed on Home ("Hello, Jericho").
> 2. ✅ **Non-allowlisted account refused** — confirmed with a second Google
>    account.
> 3. ⚠️ **Android install — NOT OBSERVED.** Closed on evidence rather than on a
>    performed install: Jericho did not have his phone, and chose to close the
>    issue rather than stall the backlog behind it (his call, 08-21, made
>    against a recommendation to split it out). What *was* verified, by browser:
>    HTTPS, valid manifest with `name`/`short_name`/`start_url`/
>    `display: standalone`, 192px and 512px icons returning real PNGs, maskable
>    variants at both sizes, and a service worker registered and active at scope
>    `/` — i.e. every criterion Chrome uses to offer an install. **If the install
>    ever misbehaves, this is the check that was never run** — raise it as a new
>    issue, do not reopen this one.
> 4. ✅ **Human visual pass** — and it earned its place: Jericho caught the
>    People tab icon rendering a headless figure. Cause was the artboards
>    themselves dropping Lucide's fourth subpath, so the build, two QA browser
>    passes and a computed-style diff all compared the app to a reference
>    carrying the same defect. Fixed in the app and in `Main.dc.html` /
>    `Calendar.dc.html` (commit `73bfeea`). ⚠️ The **published canvas artifact
>    still has the old glyph** — re-seeding the boards from it would bring the
>    bug back.

# Tracer: scaffold + Google sign-in + PWA shell + tab bar

## Goal
A deployed, installable Bible Study Tayo PWA on Vercel: Google sign-in (required — no anonymous path), an empty Home screen behind `requireUser()`, and the 5-slot tab bar `Home · Calendar · [+] · People · Reports`. Signing in with Jericho's Google account lands on Home; any other account is rejected. End-to-end proof the stack works.

## Scope
- "As the leader, I sign in with Google (required — the records live in the account)…" (PIN/biometric lock is issue 12, NOT here.)
- App shell every other issue builds inside.

## Notes
- **hitl because of external accounts:** needs a Google OAuth client, a Neon Postgres project, and a Vercel project — Jericho creates these. ⚠️ Account separation is a standing rule: the harness login is Caren's — BST's OAuth client and Vercel/Neon projects belong on **Jericho's own** accounts; confirm with him at setup, never create on whatever account is ambient.
- App code lives in `~/biblestudy-tracker/` beside `design/` and `issues/`. **The folder is not yet a git repo — `git init` first**; stage explicit paths (never `git add -A`); commit author email must match the GitHub account or Vercel blocks the deploy; commit as part of every ship (Vercel deploys the working tree, git drifts otherwise).
- Stack: Next.js (App Router) + Neon + Vercel — the pattern behind OurChurch/TimeTrax/Print Invox/SilidTahanan. ⛔ Neon over WebSocket needs the `ws` package, not global WebSocket. IPv4-first + retry/backoff mandatory (Jericho's network); Neon autosuspend throws `fetch failed` on first hit — retries are the normal case. ⚠️ `next dev` OOMs this VM and fakes DB outages — prefer `next build && next start` or test at the module boundary.
- Google sign-in: ~~copy the **OurChurch** pattern (`~/ourchurch`)~~ — **corrected 2026-08-21 during implementation.** OurChurch does Google through **Supabase Auth**; BST is Neon + Vercel with no Supabase, so there is nothing there to copy. Decided instead (Jericho, 08-21): **hand-rolled OIDC** in `src/lib/auth/` — PKCE + state, code exchanged at Google's token endpoint, `id_token` claims checked (issuer/audience/expiry/`email_verified`), identity signed into an HttpOnly JWT cookie with `jose`. No `next-auth` (still beta-tagged, rough on Next 16). What *did* carry over from OurChurch is its `sameOriginPath` helper on the callback (open-redirect fix, 08-19) — `src/lib/safe-path.ts`. Sign-in is REQUIRED (#71); single-user v1 (#1) — allowlist Jericho's Google account, reject all others with a plain English message.
- PWA: manifest + real service worker, the SilidTahanan pattern (real-SW fix 08-11). Installable on Android Chrome.
- Fonts self-hosted via `next/font`: **Bricolage Grotesque + Figtree**. ⛔ Never the mockups' stylesheet link; ⛔ never Fraunces/Public Sans (that's OurChurch).
- Logo assets from `/home/jericho/biblestudy-tracker/design/logo3d/out/kit/` — respect `usage.html` minimums (stacked lockup ≥130px, emblem ≥32px, icon PNGs 16px; step DOWN a version below a threshold, never shrink past it).
- All UI a leader reads is English (#29/#66). The SignIn tagline is the one Taglish exception, as drawn on the board.
- Test at the server boundary against a test Postgres DB; TDD, red observed first. **Settled 08-21:** there is no Postgres on this VM and Docker is reserved for SilidTahanan, so the test DB is remote. ~~a Neon branch named `test` in the same project~~ — **corrected during provisioning:** Neon here is provisioned through the **Vercel marketplace integration**, and that CLI can only create whole resources, not branches. So the test database is a **second Neon resource**, `bible-study-tayo-test`, rather than a branch. Stronger isolation, same guarantee: `TEST_DATABASE_URL` is swapped over `DATABASE_URL` in `tests/setup.ts`, so a test cannot reach production even by importing the ordinary module.
- **Next pinned to 16.3.1, not the fleet's 16.2.12** (08-21): 16.2.12 pulls postcss and sharp versions carrying 3 high advisories. Greenfield repo, so it starts clean; `npm audit` is 0.

## Looks like
- `/home/jericho/biblestudy-tracker/design/SignIn.dc.html` — the sign-in screen.
- `/home/jericho/biblestudy-tracker/design/Main.dc.html` — tab bar + Home framing only (Home's content is issue 8).
- ⚠️ Opening `.dc.html` directly shows raw `{{…}}` (canvas runtime not in repo — not a bug). Render with `node /home/jericho/biblestudy-tracker/design/preview/build.js SignIn '[{}]'`.
- Done requires a human comparing the built screens against these boards — green tests are not evidence of visual match.
