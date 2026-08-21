# PRD: Bible Study Tayo — v1

App name is **Bible Study Tayo** ("BST"), never "Bible Study Tracker". Personal ministry tool for Jericho: tracks who attends which Bible study session and how far they've gotten. No lesson content. Not a SaaS, not a client build.

## Sources

Every artifact below fed this design. VISUAL sources govern the look directly and are never summarized here — open them.

- `/home/jericho/biblestudy-tracker/DESIGN-CONCEPT.md` — **the normative decision log**: 74 numbered decisions with rejected alternatives, the data model, vocabulary rules, v1.1 backlog, and the §SUPPORT COPY spec artifact. On any gap or ambiguity in this PRD, that file wins. Load it before implementing anything non-trivial.
- **VISUAL:** `/home/jericho/biblestudy-tracker/design/*.dc.html` — the 11 screen artboards that govern every screen's look: `Main` (Home), `Calendar`, `People`, `Groups`, `GroupDetail`, `Person`, `NewMeeting`, `Attendance`, `Reports`, `Settings`, `SignIn` (plus `canvas.json` layout). Published canvas: https://claude.ai/code/artifact/3b6da5db-11e0-4ae7-9b84-accbe1ca1a72. ⚠️ Opening a `.dc.html` directly in a browser shows raw `{{…}}` — the canvas runtime (`support.js`) is not in the repo; that is not a bug. To review a board as a plain page, use `node design/preview/build.js <Board> '<states-json>'`.
  - **Conflict rule (decided in the 08-21 sessions):** where a board predates a later decision, the decision log wins on structure and behavior — known cases: tab bar composition (#62), Meeting time-override + notes on the create form (#36/#55), vocabulary (#66: "Stepped away", "CATCH-UP", "Upload"/"Export"), progress dots wrapping at 6 (#68), "baptized" spelling. The boards still govern visual idiom: layout, spacing, palette, typography, tone of copy.
- **VISUAL:** `/home/jericho/biblestudy-tracker/design/logo3d/out/kit/` — the logo kit (lockup F variants: `lockup-f{,-rev,-blue,-stacked,-stacked-rev,-stacked-blue}.svg`), plus `out/vector/roundel-r5.svg` (L1 illustration) and the hand-built emblem (`emblem.js`, L2/L3). Usage rules with measured minimum sizes: `/home/jericho/biblestudy-tracker/design/logo3d/usage.html` (proof `out/kit/usage-proof.png`). Text in lockups is outlined — re-run `build-lockup.js` to change wording, never hand-edit paths.
- `/home/jericho/biblestudy-tracker/AUDIT-FABLE-2026-08-21.md` — design audit. Findings A–E were closed the same day by decisions #64–#74 (the decision log wins where the audit describes the older state). Findings I/J (boards missing settled decisions; mock data drift, no board renders a >6-session book) remain true of the boards and are covered by the conflict rule + #68.
- `/home/jericho/glc-books/GLC-SESSIONS.md` — the curriculum seed data: 8 books, 50 sessions, exact published titles. Seed from this file, not from board mock data (boards invent "Book 3 — Christian Beliefs"; real Book 3 is The Holy Spirit, 4 sessions).
- `/home/jericho/outreach/VOICE.md` — Taglish register for the few member-facing lines (sign-in tagline exists already on the SignIn board; the rest is v1.1).

## Problem

Jericho leads multiple BGroups (Belong Groups) through the CCF GLC curriculum. Tracking who attended which session, who is behind, who has gone quiet, and when each group meets currently lives in his head and on paper. Attendance is taken in rooms that may have no signal.

## Solution

A phone-first PWA (Next.js + Neon + Vercel — the stack behind his four shipped apps, per #70 server-first) with Google sign-in, holding Person / Group / Meeting / Completion records. The group carries the current book; meetings are proposed → held → cancelled; progress is a per-person set of session completions; the quiet list and catch-up matching are derived, never stored. One offline exception: an attendance outbox. History is never rewritten — corrections tombstone.

## User Stories

- As the leader, I sign in with Google (required — the records live in the account) and set an app PIN/biometric lock, so the roster isn't open on a lost phone.
- As the leader, I add people with name + at least one of phone/email (plus birthday, address, civil status, 4E spiritual status, baptized + date, invited by, notes, joined date), so I have a real roster.
- As the leader, I create BGroups with a weekly schedule (day + time + duration) and a current book, so the app can propose meetings and prefill agendas.
- As the leader, I see 8 weeks of proposed meetings materialised and ghost slots beyond, on a Month/Week calendar (Week default, Sunday first), so the schedule is visible without me creating every night by hand.
- As the leader, I create a one-off meeting from the [+] tab — group picker showing 3 cards most-recently-met-first, date, prefilled book + next session, optional time override and notes (the venue lives in notes) — and it is always PROPOSED, so "held" stays a deliberate act.
- As the leader, I take attendance on my phone with one tick = attended + completed, a "present only" option, and name-only walk-in capture, so recording a room takes seconds even with strangers present.
- As the leader, I take attendance with no signal and it uploads when I reconnect, so a brownout never sends me back to paper.
- As the leader, on a meeting's attendance screen I see people from other BGroups missing that exact book+session, and a person's view names the meeting where they can catch up, so ride-alongs fill gaps instead of being lost.
- As the leader, I see who has missed N consecutive held meetings (default 3, per-group configurable) on my Home attention list, so quiet people surface before they disappear.
- As the leader, when a group finishes a book I get a checkpoint listing left-behind members before confirming the next book, so nobody is silently abandoned.
- As the leader, I resolve past-due proposed meetings with one tap (held/cancelled), so the calendar never rots.
- As the leader, I view a person sheet, a group history, and a roll-up report, and export CSV, so I can see the ministry on paper when I need to.
- As the leader, I edit and backdate freely, but every correction tombstones, so history is never rewritten.
- As the leader, I can add my own books and sessions beyond the GLC seed, so the app outlives the curriculum.

## Modules

All new; one repo at `~/biblestudy-tracker/` (app code lands beside `design/` and `issues/`). Server modules expose server actions + query functions and are tested at that boundary; screens are thin over them.

1. **auth-shell** — Google sign-in (required, #71), app PIN/biometric lock (#19), installable PWA shell (same pattern as OurChurch/TimeTrax/SilidTahanan/Print Invox), tab bar `Home · Calendar · [+] · People · Reports` (#62), self-hosted fonts via `next/font`: Bricolage Grotesque + Figtree (⛔ never the mockups' stylesheet link; ⛔ never OurChurch's Fraunces/Public Sans). Interface: root layout + `requireUser()` guard. Owns the SignIn screen (Taglish tagline as drawn — brand surface, the #29/#66 exception).
2. **curriculum** — Program/Book/Session rows; seed GLC 1 (Books 1–4) + GLC 2 (Books 5–8) from `GLC-SESSIONS.md` (#33); user-created books/sessions (#22); no create-program UI (#33). Interface: read queries + `createBook`/`createSessions`.
3. **roster** — Person + Group CRUD; contact rule name + phone-or-email with walk-in deferral flag (#9/#67); archive (never delete) with bulk-move offer (#27); home-group transfer leaving completions untouched (#27); "Stepped away" manual override (#66); group current-book + advance checkpoint listing left-behind members (#17/#18). Interface: server actions + queries. Owns People, Groups (segmented inside the People tab), GroupDetail, Person screens.
4. **meetings** — the deep module. Group recurrence = the group's schedule, one per group, editable from group or create-form (#48); schedule change moves future PROPOSED only (#48b); 8-week materialiser + ghosts drawn beyond, ghosts are never rows (#49/#59); idempotency = partial unique index on `(group_id, date) WHERE origin='generated'`, every generation path writes `ON CONFLICT DO NOTHING` (#73); proposed → held (session optional) → cancelled (#7/#26); creating always yields PROPOSED (#47); past-due flag + one-tap resolve (#52); prefill = group's current book + session after last **held** meeting (#53); group picker: 3 cards most-recently-met (by last held) first, "See N more", meta line `N members · last met …` (#63); cancelled shown greyed + struck (#50); archived groups generate no ghosts and can't be picked (#60); local date + time stored, `Asia/Manila` semantics (#56). Interface: `getCalendar(range)`, `createMeeting`, `resolveMeeting`, `setGroupSchedule`, `cancelMeeting`. Owns Calendar + NewMeeting screens (Month/Week toggle, Week default, Sunday first, #46; same-hour split / "+N" collapse, #58; no drag-to-move, #57).
5. **attendance** — Completion rows: one per (person, meeting), `session` nullable — a session row = covered it, NULL = present at a no-session meeting, credits nothing toward books (#25/#26/#65); "present only" option; walk-in add from the sheet, name-only (#67); catch-up matching: list people from other BGroups missing that exact book+session; guests derived (`meeting.group != person.home_group`), rendered "Nico (BGroup Linggo)", completion credits the person, home-group roll-ups unchanged, host history shows the visit (#31); free edit/backdate with tombstones (#24). Interface: `getSheet(meetingId)`, `record(...)`, `getCatchUpCandidates(meetingId)`. Owns the Attendance screen.
6. **insights-reports** — read-only derivations: quiet list = N consecutive missed **held** meetings, cancelled/never-scheduled never tick it, default 3, per-group setting (#10/#64); Home = next meeting + attention list (#20); strict book completion = ALL sessions (#5); mid-book joiners carry "joined at" markers (#28); person sheet / group history / roll-up + CSV **Export** (#21, Jericho-only). Owns Home, Reports, Settings screens.
7. **outbox** (client-side) — the single offline exception (#72): attendance ticks and meeting creation queue on-device and upload on reconnect, replayed in order, server assigns timestamps; everything else requires a connection and says so; the word is **Upload** (#66/#72); calendar reads from cache offline (#61 as narrowed by #70). Interface: `enqueue()`, `flush()`, pending count for the UI.

## Implementation Decisions

Concrete values from the grill sessions (decision numbers cite `DESIGN-CONCEPT.md`; on any tension, that file wins):

- **Stack: Next.js + Neon Postgres + Vercel, server-first (#70).** No local-first sync engine, no LWW, no CRDT — retired unbuilt. Soft deletes survive for history (#24), not for sync. ⛔ Neon over WebSocket needs the `ws` package; IPv4-first + retry/backoff mandatory on Jericho's network; Neon autosuspend throws `fetch failed` on first hit — retried writes are the normal case (that is why #73's index exists). ⚠️ `next dev` OOMs this VM and fakes DB outages.
- **Model:** Person (contacts, home_group, joined-at) · Group (schedule day+time+duration, current book, archived) · Meeting (group, date, time inherited-overridable, book+session optional, notes free-text optional, proposed/held/cancelled, `origin` 'generated'|'created', `led_by`) · Completion (person, meeting, session **nullable**, attended|present-only, unique on person+meeting) · Program (id, name, order; Book points at it). No enrollment entity (#16); no location field, venue in notes (#54); no guest entity, derived at render (#31).
- **v1.1 hooks stamped now (#32/#33):** `owner_id` on Person/Group/Meeting/Completion and `led_by` on Meeting, always Jericho; Program seeded but no create UI. Not a permission system — the point is that v1.1 leader accounts don't migrate live data.
- **Vocabulary (#66, fixed one word per thing):** BGroup never DGroup (except CCF's printed titles quoted as published); "Stepped away" never "Closed"; "CATCH-UP" never "BEHIND"; **Upload** = pending attendance leaving the phone, **Export** = CSV out; "Sync"/"back up" retired; "baptized" spelling.
- **Language (#29/#66):** everything a leader reads is English, sign-in included. Taglish in exactly two places: the app name, and copy a member reads (v1.1).
- **UI facts:** phone-first, large targets, high contrast, blue palette, warm tone (#30) — the artboards govern the rest; progress dots wrap at 6 per row (Book 8 has 12 sessions — no board renders it, layout must hold, #68); Reports may be dense (#30).
- **Numbers:** materialise 8 weeks, ghost horizon fixed at 8 weeks not a setting (#49/#59); quiet default 3 missed held meetings (#64); giving is v1.1 — nothing money-touching in v1.
- **Curriculum seed:** 8 books / 50 sessions exactly as titled in `GLC-SESSIONS.md`; GLC 1 = Books 1–4 (20 sessions), GLC 2 = Books 5–8 (30 sessions).
- **Ops (from standing feedback, not the grill):** commit as part of every ship; stage explicit paths, never `git add -A`; commit author email must match GitHub or Vercel blocks the deploy; code/comments/commits in English.

## Testing Decisions

(Proposed at module confirmation 2026-08-21 and accepted; not from the grill itself.)

- Each server module is tested at its server-action/query boundary against a **test Postgres database** — the OurChurch/TimeTrax pattern. TDD per the issue pipeline: red observed first.
- The **meetings** module's idempotency gets explicit tests: double-materialise, materialise-after-schedule-change, ghost-tap retry — all must not duplicate (#73), and a human-created meeting on the same date as a generated one must succeed.
- The **attendance/insights** seam gets fixture-driven tests: quiet-list counting across cancelled meetings (#64), strict book completion including a 12-session book (#5/#68), catch-up matching across groups (#31).
- **outbox** is tested client-side with a faked transport: in-order replay, retry after failure, no duplicate server rows (leaning on #73).
- Before deploy: a **qa-agent browser pass** over the built screens against the artboards (standing feedback) — this is the check that catches "tests green, product looks nothing like the mockup".

## Out of Scope

Explicitly decided against — this defines done. Rejected alternatives for every decision live in `DESIGN-CONCEPT.md`; the load-bearing ones:

- **Local-first + sync engine** (#70 reversed #12/#14) — retired unbuilt; the outbox is the only offline write path, and only for attendance + meeting creation.
- **Optional sign-in / offline mode** (#71) — no app without an account.
- **Multi-leader, multi-tenant, member accounts** (#1) — single user; hooks stamped, nothing more.
- **Enrollment entity / current-book-on-person** (#16/#17) — the group carries the book.
- **Credited/override sessions** (#5) — strict completion only.
- **Structured location field** (#54) — venue in notes; accepted: no tap-to-navigate ever, v1.1 invite drafts have no place.
- **Drag-to-move on the calendar** (#57) — tap then edit; a mis-drag has no undo in this model.
- **Auto-marking past meetings held** (#47/#52) — held is always deliberate.
- **Hard deletes / permanent group deletion** (#24/#27) — tombstones and archive only.
- **Any SMS gateway or send server** (v1.1 reminders decision) — and Claude never has a send path (standing rule).
- **Google Calendar push in v1** (#45) — designed (#34–#44) but deliberately v1.1; see Deferred.
- **Configurable ghost horizon** (#59) — fixed 8 weeks.
- **Taglish leader UI** (#29) — English everywhere a leader reads.

## Deferred

Neither built nor rejected — in a source but not in v1. Nobody said no to these, so nobody will notice them missing unless they're named:

- **Google Calendar one-way push** (DESIGN-CONCEPT #34–#44, fully designed): leader's own primary calendar, `led_by`-scoped, 1:1 events tagged with `extendedProperty`, BST-wins reconciliation notice, reminders off, delete-future-keep-past on disconnect, title `BST: {Group} · {Book} S{n}`. v1 must store nothing for it beyond what's decided; v1.1 adds `google_event_id` on Meeting.
- **Certificates on PROGRAM completion** (v1.1 backlog): GLC 1 + GLC 2 first, generic data-driven render, program becomes user-creatable. Still open there: print vs share-image; signatory.
- **Leader accounts** (v1.1 backlog): upline/downline tree, recursive read-only subtree (notes carved out per #74 — root-only exception, label must name its readers), Book-1-complete hard prerequisite, deactivation/moving-upline tree-repair rules. **Open residual from the audit: members are never told notes about them exist or who reads them — must be decided before leader accounts ship.**
- **Member accounts** (v1.1 backlog): one app, role-based shell, server-enforced scoping. Open: what a member can actually do.
- **Reminders** (v1.1 backlog, decided): on-device local notification + leader tap-to-send draft fallback; quiet follow-up assisted-only, app never sends; per-group timing default 6pm evening before; sender = the group's own leader.
- **Giving / Support card** (v1.1 backlog, fully designed): PayMongo Checkout Sessions copying `~/timetrax/src/lib/paymongo.ts`, `["qrph"]` only, tap-time ledger row keyed by unique `checkout_session_id`, Jericho-only visibility carve-out, 4th Reports tab, §SUPPORT COPY draft in DESIGN-CONCEPT.md **still needs a grill before it ships**. Recipient is always Jericho's own ministry — permanent rule.
- **Subtree meetings toggle on the calendar** (#51) — v1.1, default off, colour-coded by leader.
- **Photos on contact records** (v1.1 backlog, #9b).
- **Catch-up invite drafts** (v1.1, closed under the reminders rule: app drafts, leader sends).
- **From the audit (source: AUDIT-FABLE-2026-08-21.md):** finding J's re-mock — boards never render a >6-session book and mock rosters drift between boards; #68 settles the layout rule, but the boards themselves were not redrawn. The build must satisfy #68 even though no visual reference shows it.
- **From the logo work (source: memory/logo kit):** L1 illustration is AI-derived (murky copyright); the hand-built emblem is the originally-authored mark — prefer it if ownership ever matters. No decision was made about which appears where inside the app beyond usage.html's size thresholds.
