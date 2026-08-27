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
- ⛔ **The logo kit beats the boards on what the logo IS.**
  `design/logo3d/out/kit/` + `design/logo3d/usage.html` are normative. Every
  board draws a blue squircle containing a Lucide open-book glyph — that is a
  **placeholder** from before the mark was settled, not the logo, and it is
  still in the boards. The real mark is the ring with two men and an open book.
  **2026-08-27: Jericho chose `design/logo3d/out/vector/roundel-full.svg`** —
  the detailed retro-ink illustration — as the app's logo, over the hand-built
  `emblem-mark` (which read as a generic "users" glyph at every size).
  `src/components/Emblem.tsx` now serves `public/logo/roundel{,-blue,-rev}.svg`
  (ink / brand-blue / sand-reversed colour variants of that one path); the
  favicon + PWA icons (`public/icons/*`) are rendered from the same file by
  `design/logo3d/app-icons.mjs` (run from repo root, needs `sharp`). Known,
  accepted deviation: the kit's usage sheet floors this illustration at ~120px;
  the app uses it at 32px in the header and 16px in the tab because the blob
  mark said nothing. Colour variants and icons are generated, **never
  hand-edited** — re-run `app-icons.mjs` after any change to the source SVG.
  The old `emblem-*.svg` are left in `public/logo/` unused.
- ⚠️ **The artboards are not infallible, and automated checks cannot tell you
  so** — every diff compares the app *to* them. Two defects reached production
  this way and both were caught by eye: the People tab icon missing a subpath of
  Lucide's `users` glyph (boards fixed), and the placeholder logo above (boards
  left as-is; this file is the correction). If a board looks wrong, say so
  instead of reproducing it faithfully.

## Stack

Next.js (App Router) + Neon Postgres + Vercel. Server-first (#70): no local-first
sync engine. The single offline write path is the attendance outbox (#72).

## Where it lives

Live at **https://bible-study-tayo.vercel.app**, on Jericho's own Vercel team
`jericho-s-projects6`. Two Neon databases, both `sin1`, both Free:
`bible-study-tayo` (production) and `bible-study-tayo-test` (the suite).

⛔ **There are two Vercel projects on the team: `bible-study-tayo` (the real
one — has every production env var, owns the `bible-study-tayo.vercel.app`
alias) and `biblestudy-tracker` (a dead pre-rename husk with no env vars —
anything deployed there 500s with `SESSION_SECRET is not set`).** Before
deploying, confirm `.vercel/project.json` reads `"projectName":"bible-study-tayo"`;
if not, `npx vercel link --project bible-study-tayo --yes`. Never repoint the
`bible-study-tayo.vercel.app` alias at a deployment until that deployment
answers 307/200 rather than 500.

Deploy with `npx vercel deploy --prod`. There **is** a git remote
(`origin` → `github.com:jerichozabalo/bible-study-center` — the repo name does
not match the project name), but **no git-integrated auto-deploy**: a deploy is
always the explicit CLI command. Vercel deploys the **working tree**, so commit
as part of the ship; `git push` is a separate step, only when asked.

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
npm run db:migrate  # apply migrations/*.sql, then seed the GLC curriculum
npm run build:icons # only when design/logo3d/out/kit changes
```

⚠️ The schema is `migrations/*.sql`, numbered and applied once each — never
renamed and never edited after they have run; a correction is a new file
(`src/lib/migrate.ts` says why). `db:migrate` is safe to run repeatedly and
must be run against **production** before deploying anything that needs a table
it does not have yet.

⛔ **A bare `npm run db:migrate` writes to PRODUCTION.** `scripts/migrate.mts`
reads `DATABASE_URL` from `.env.local`, and that is the production branch —
`TEST_DATABASE_URL` is the test one. There is no dev database. This is the
intended behaviour (it is how production gets migrated), but it means the
command is a production write, not a local one, and it does not look like it at
the call site. An agent told otherwise applied `003` to production on
2026-08-21; the migration was additive and the roster tables were empty, so
nothing was lost, but the next one might not be. To migrate the **test** branch,
override explicitly: `DATABASE_URL="$TEST_DATABASE_URL" npm run db:migrate`.
The suite does not need it either way — `ensureSchema()` in `tests/fixtures.ts`
migrates the test branch on every run.

⚠️ **`next dev` OOMs this VM** and fakes database outages while it does. Use
`npm run build && npx next start -p 3111` to look at the app, or test at the
module boundary. ⚠️ Pick a port deliberately if another session might be up —
an agent's smoke test silently hit a *different* session's server on 3111 and
read 404s for routes it had just built.

⚠️ **Agent worktrees: `node_modules` must be a hardlink copy, never a symlink.**
`cp -al ../../node_modules node_modules`. Turbopack refuses a symlink pointing
above the project root (`Symlink [project]/node_modules is invalid, it points
out of the filesystem root`) and `npm run build` panics. Copy `.env.local` in
too — both are gitignored, so a fresh worktree has neither and nothing runs.

⚠️ **Parallel worktrees share the one test branch**, and `resetRoster()` deletes
people and groups unscoped. Concurrent suites delete each other's fixtures: a
run showing 14 failures passed 22/22 seconds later. Re-run before investigating
a failure that looks like rows vanishing, and only believe one that reproduces.
`src/lib/migrate.test.ts` is red in every worktree until the branches merge —
it compares the shared ledger against the files in one tree.

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
- **`dvh` needs an `h-screen` fallback.** Every full-height container uses
  `h-screen h-dvh` (or `min-h-screen min-h-dvh`) so browsers that don't support
  the dynamic viewport unit (`dvh`) fall back to `100vh` instead of `auto`.
  Without the fallback the outer flex has no height, `overflow-hidden` contains
  nothing, and the TabBar (#62) scrolls away with the page on mobile. (iOS < 16.4
  and standalone PWA mode.)
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
