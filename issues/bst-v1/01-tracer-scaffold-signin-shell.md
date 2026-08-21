---
issue: 1
title: "Tracer: scaffold + Google sign-in + PWA shell + tab bar"
status: in-progress
blocked-by: []
type: hitl
---

> **State as of 2026-08-21.** Everything buildable without external accounts is
> built, tested and committed; two visual/QA passes over the sign-in screen are
> clean against the board. What is left is the `hitl` part itself and only
> Jericho can do it:
>
> 1. Fill the five `FILL-ME` values in `.env.local` (Neon project + `test`
>    branch, Google OAuth client id + secret, `ALLOWED_EMAILS`).
> 2. Create the Vercel project on **his own** account (the CLI on this machine
>    is already signed in as `jerichozabalo0301-2088`), set the same env vars
>    there, deploy.
> 3. Register **both** redirect URIs on the OAuth client —
>    `http://localhost:3111/auth/callback` and the Vercel one.
> 4. Do a real Google round-trip and confirm a non-allowlisted account is
>    refused.
> 5. Install the PWA on Android Chrome from the deployed URL.
>
> Until 1 is done the 4 database tests in `src/lib/db.test.ts` skip rather than
> run; until 4 and 5 are done this issue is not `done`.

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
- Test at the server boundary against a test Postgres DB; TDD, red observed first. **Settled 08-21:** there is no Postgres on this VM and Docker is reserved for SilidTahanan, so the test DB is a **Neon branch named `test`** in the same project — `TEST_DATABASE_URL`, which `tests/setup.ts` swaps over `DATABASE_URL` so a test cannot reach production even by importing the ordinary module.
- **Next pinned to 16.3.1, not the fleet's 16.2.12** (08-21): 16.2.12 pulls postcss and sharp versions carrying 3 high advisories. Greenfield repo, so it starts clean; `npm audit` is 0.

## Looks like
- `/home/jericho/biblestudy-tracker/design/SignIn.dc.html` — the sign-in screen.
- `/home/jericho/biblestudy-tracker/design/Main.dc.html` — tab bar + Home framing only (Home's content is issue 8).
- ⚠️ Opening `.dc.html` directly shows raw `{{…}}` (canvas runtime not in repo — not a bug). Render with `node /home/jericho/biblestudy-tracker/design/preview/build.js SignIn '[{}]'`.
- Done requires a human comparing the built screens against these boards — green tests are not evidence of visual match.
