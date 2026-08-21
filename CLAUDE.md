# Bible Study Tayo (BST)

Personal ministry tool for Jericho: who attended which Bible study session, and
how far each person has gotten through the CCF GLC curriculum. Not a SaaS, not
a client build, no lesson content.

**The app is called "Bible Study Tayo", never "Bible Study Tracker"** — the
directory name is older than the decision.

## Read before implementing anything non-trivial

- `DESIGN-CONCEPT.md` — the normative decision log, 74 numbered decisions. On
  any gap or ambiguity in the PRD, **that file wins**. Decisions are cited in
  code comments as `#nn`.
- `issues/bst-v1/PRD.md` — the destination document and the module boundaries.
- `design/*.dc.html` — the 11 artboards. They govern the look.
  ⚠️ Opening one directly shows raw `{{…}}`; the canvas runtime is not in the
  repo and that is not a bug. Render one as a plain page with
  `node design/preview/build.js <Board> '<states-json>'`.
  ⚠️ **That JSON argument is component _state_, not props.** A board's props —
  the `data-props` block at the bottom of the file, which is what picks between
  a board's screens — come from the `DC_PROPS` environment variable. Getting
  this wrong renders the board's *default* screen while looking like it worked.
  `SignIn` defaults to the PIN pad, so the Google sign-in state is:
  `DC_PROPS='{"screen":"signin"}' node design/preview/build.js SignIn '[{}]'`
  The rendered `*-preview.html` files are gitignored output; rebuild rather
  than trusting a stale one.
- **Conflict rule:** where a board predates a later decision, the decision log
  wins on structure and behaviour; the board still governs visual idiom —
  layout, spacing, palette, typography, tone of copy.

## Stack

Next.js (App Router) + Neon Postgres + Vercel. Server-first (#70): no local-first
sync engine. The single offline write path is the attendance outbox (#72).

## Where it lives

Live at **https://bible-study-tayo.vercel.app**, on Jericho's own Vercel team
`jericho-s-projects6`. Two Neon databases, both `sin1`, both Free:
`bible-study-tayo` (production) and `bible-study-tayo-test` (the suite).

Deploy with `npx vercel deploy --prod` — there is no git remote and no
auto-deploy. Vercel deploys the **working tree**, so commit as part of the ship.

⚠️ `vercel integration add neon` **never asks for a region** and silently
defaults to `us-east-1`. Always pass `-m region=sin1`. Valid keys: cle1, iad1,
pdx1, fra1, lhr1, syd1, sin1, gru1. `vercel.json` pins functions to `sin1` so
they sit next to the database rather than across the Pacific from it.

⚠️ `vercel link` appends a blanket `.env*` to `.gitignore`, which would hide
`.env.example`. The `!.env.example` exception above it is deliberate — do not
remove it.

## Running it

```
npm run test        # vitest
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run build       # next build
npm run build:icons # only when design/logo3d/out/kit changes
```

⚠️ **`next dev` OOMs this VM** and fakes database outages while it does. Use
`npm run build && npx next start -p 3111` to look at the app, or test at the
module boundary.

Copy `.env.example` to `.env.local` and fill it in. Nothing runs without it.

## Things that will bite you

- **Neon needs `ws`.** `neonConfig.webSocketConstructor = ws` is set in
  `src/lib/db.ts`; without it every query fails with an error that names
  something else entirely.
- **Neon autosuspend.** The first query against an idle branch throws
  `fetch failed` while the compute wakes. That is the normal case, not an
  outage — `src/lib/retry.ts` sits through it. Never "fix" a `fetch failed` by
  assuming the database is down.
- **Never let a test reach the real database.** `tests/setup.ts` overwrites
  `DATABASE_URL` with `TEST_DATABASE_URL` (a Neon branch). Do not bypass it.
- **Vercel deploys the working tree, not git.** Commit as part of every ship or
  git silently drifts behind production.
- **Stage explicit paths** — never `git add -A`. Concurrent sessions share this
  working tree.
- **Commit author email must match the GitHub account** or Vercel blocks the
  deploy. It is set in this repo's `.git/config`; do not change it.
- Code, comments and commit messages are **English** (standing rule). Taglish
  appears in exactly two places: the app name, and copy a *member* reads (v1.1).
  Everything a *leader* reads is English (#29/#66).

## Vocabulary (#66 — one word per thing, do not synonym-shuffle)

**BGroup** never DGroup · **Stepped away** never "Closed" · **CATCH-UP** never
"BEHIND" · **Upload** = pending attendance leaving the phone · **Export** = CSV
out · "Sync" and "back up" are retired · **baptized**, that spelling.

## Auth

Hand-rolled Google OIDC — `src/lib/auth/`. Sign-in is **required** (#71); v1 is
single-user (#1), enforced by the `ALLOWED_EMAILS` allowlist, re-checked on
every request in `requireUser()`.

⚠️ The OAuth client, the Neon project and the Vercel project all live on
**Jericho's own accounts**. The harness login on this machine is Caren's —
never create or query BST infrastructure on whatever account is ambient.

Do not copy OurChurch's auth: it looks similar but is Supabase Auth, and there
is no Supabase here.

## Testing

Every server module is tested at its server-action/query boundary against the
Neon test branch. TDD, red observed first — a test written against code that
already exists proves nothing.
