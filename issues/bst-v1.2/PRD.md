# PRD: BST v1.2 — the Meeting page

Decided with Jericho **2026-09-11**. Sources: this repo's `CLAUDE.md` and
`DESIGN-CONCEPT.md`, the memory file
`~/.claude/projects/-home-jericho/memory/project-bible-study-tayo.md`, and the
2026-09-11 conversation in which Jericho named the ask and chose the list's
scope (past + tonight, newest first — his pick).

v1 is complete and deployed (18/18, 2026-09-04, commit `01a6a98`); v1.1 shipped
and closed 2026-09-11 (issues 1–4, commits `7df05a9`→`f32ebbb`, prod schema
through `011`). This is the first v1.2 item.

## Settled decisions (2026-09-11)

- **The Calendar page becomes the Meeting page** — tab label and page heading.
  The **route slug `/calendar` is kept** (names are the app's, slugs are
  history — the same call the folder slug `~/biblestudy-tracker` carries); no
  redirect, no revalidate/SW plumbing churn. A `/meetings` rename, if ever
  wanted, is its own chore.
- **Two views inside the page, one segmented control** (the #62 People/Groups
  idiom — real links, so the back button works): **List** and **Calendar**.
  **List is the default on every open** — no remembered view, the same call
  #46 made for Week/Month.
- **The List is the meeting log: every meeting dated today or earlier, Manila
  (#56), newest first.** Future-dated rows never appear (they live on the
  Calendar view and Home); ghosts (#49) stay a calendar-only affordance. All
  three statuses appear — cancelled greyed and struck through (#50), past-due
  proposed with their one-tap resolve (#52), held with the way into the sheet.
- **The cards are the calendar agenda's own card**, extracted into a shared
  component so list and calendar draw one card and cannot drift.
- **Calendar view: exactly what the page does today** — Week default (#46),
  Month toggle, ghosts, past-due flags, day agenda. No behaviour changes.
- **The page keeps its offline-readable role** (#61 as narrowed by #70), both
  views; the service worker stash becomes per-view and the cache takes
  `bst-v4`.
- When it lands: append a **v1.2 section to `DESIGN-CONCEPT.md`** and update
  `project-bible-study-tayo.md`.

## Proposed — confirm or flip at review

- None open. The one genuinely Jericho-shaped call (list scope/order) was
  asked and answered 2026-09-11; everything else above is this folder's own
  call, written down to be vetoed on sight.

## Slices

| # | Issue | Type | Migration |
|---|-------|------|-----------|
| 01 | Meeting page — List default + Calendar view, tab renamed from Calendar | afk (Jericho's eye) | — |

One slice; no `blocked-by` edges. A migration, if one ever appears here, takes
the next free number at the time it is written.

## Standing constraints

- TDD, red observed first; full loops (`npm run test`, `typecheck`, `lint`,
  `build`) before done; one commit per issue referencing `bst-v1.2 #<n>`;
  commit but **never push** — pushing is Jericho's step.
- A bare `npm run db:migrate` writes **PRODUCTION** (no dev DB). Test branch:
  `DATABASE_URL="$TEST_DATABASE_URL" npm run db:migrate`. No migration is
  planned here.
- Deploy: `npx vercel deploy --prod`, only after `.vercel/project.json` reads
  `"projectName":"bible-study-tayo"` — and only with Jericho's go.
- ⚠️ `next dev` OOMs this VM and fakes DB outages — look at the app with
  `npm run build && npx next start -p <deliberate port>`.
- Vocabulary (#66): BGroup · Stepped away · CATCH-UP · Upload · Export.
  Leader-facing UI is English (#29).
- No board draws the list view; the looks-like gate is the calendar board's
  card idiom plus Jericho's eyeball (see the issue).
- When the work lands: append the settled items to `DESIGN-CONCEPT.md` (new
  v1.2 section) and update the memory file `project-bible-study-tayo.md`.

## Non-goals

- No `/meetings` route rename (slug stays `/calendar`).
- No behaviour change to the calendar view itself (Week/Month, ghosts, agenda,
  resolves all as-is).
- No pagination on the log; no attendance counts on log cards (both parked in
  `notes.md`).
- Nothing else from the wider v1.1 backlog (certificates, leader accounts,
  reminders) is in scope.
