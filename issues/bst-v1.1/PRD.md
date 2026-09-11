# PRD: BST v1.1 — four additions

Decided with Jericho **2026-09-11**. Sources: this repo's `CLAUDE.md` and
`DESIGN-CONCEPT.md` (v1.1 section), the memory file
`~/.claude/projects/-home-jericho/memory/project-bible-study-tayo.md`, and — for
photos — the grilled spec at
`~/biblestudytayo-support/issues/ministry-support-site/10-bst-session-photos.md`.

v1 is complete and deployed (18/18 issues, 2026-09-04, commit `01a6a98`). These
four are the first v1.1 items Jericho asked for.

## Settled decisions (2026-09-11)

- **Nickname** — an optional field on every person. When set, it is the name
  shown **everywhere**, the person's own page included; the full name stays the
  stored record and remains what the edit form edits.
- **Birthday card on Home** — "this week" = the **current calendar week,
  Sunday → Saturday**, Manila. `people.birthday` already exists (#9b); the card
  is the new part.
- **Salvation prayer** — a toggle on the person record, mirroring `baptized`.
- **Session photos** — the grilled spec, adopted whole: R2 storage, one consent
  checkbox per upload batch, delete-to-retract, no per-photo toggle, no cap.

## Proposed — confirm or flip at review

- **Salvation prayer carries an optional date** (`prayed_salvation_on`), the
  way `baptized` carries `baptized_on`. The question was left blank.
- **Photos use a new R2 bucket dedicated to BST** rather than a prefix inside an
  existing bucket. The question was left blank.

## Slices

| # | Issue | Type | Migration |
|---|-------|------|-----------|
| 01 | Nickname | afk (Jericho's eye) | 009 |
| 02 | Salvation prayer | afk (Jericho's eye) | 010 |
| 03 | Birthday card on Home | afk (Jericho's eye) | — |
| 04 | Session photos | hitl | 011 |

No `blocked-by` edges — all four are independent. 009+ are the next free
numbers; if build order changes, a migration takes the next free number at the
time it is written. Migrations are applied once and never renumbered or edited
(`src/lib/migrate.ts` says why).

## Standing constraints (all four)

- TDD, red observed first; full loops (`npm run test`, `typecheck`, `lint`,
  `build`) before done; one commit per issue referencing the issue number;
  commit but **never push** — pushing is Jericho's step.
- A bare `npm run db:migrate` writes **PRODUCTION**. Test branch:
  `DATABASE_URL="$TEST_DATABASE_URL" npm run db:migrate`. Production migration
  is a deliberate ship step, taken with Jericho's go.
- Deploy: `npx vercel deploy --prod`, only after `.vercel/project.json` reads
  `"projectName":"bible-study-tayo"` — the `biblestudy-tracker` project is a
  dead husk that 500s. Vercel deploys the working tree.
- ⚠️ `next dev` OOMs this VM and fakes DB outages — look at the app with
  `npm run build && npx next start -p <deliberate port>`.
- Vocabulary (#66): BGroup · Stepped away · CATCH-UP · Upload = pending writes
  leaving the phone · Export = CSV out. Leader-facing UI is English (#29).
- Every screen touched has an artboard — each issue carries a `## Looks like`
  gate. Green tests are not evidence of a visual match.
- When the work lands: append the settled items to `DESIGN-CONCEPT.md`'s v1.1
  section, and update the memory file `project-bible-study-tayo.md`.

## Non-goals

Nothing else from the v1.1 backlog (certificates, leader/member accounts,
Google push, reminders) is in scope. The public photo surface belongs to
`biblestudytayo-support`, not here.
