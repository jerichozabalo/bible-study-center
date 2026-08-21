---
issue: 8
title: Quiet list + Home attention list + per-group threshold
status: open
blocked-by: [6, 12]
type: afk
---

# Quiet list + Home attention list

## Goal
Home shows the next meeting and the attention list ("Needs you"): people who have missed N consecutive HELD meetings surface as Quiet, with the threshold configurable per group from Settings (default 3). "Stepped away" people are handled per their override, not the counter.

## Scope
- "As the leader, I see who has missed N consecutive held meetings (default 3, per-group configurable) on my Home attention list…"
- Home = next meeting + attention list (#20).

## Notes
- **The unit is consecutive missed HELD meetings, never weeks** (#64 — this settled a real contradiction; the Settings unit won). Cancelled (#50) and never-scheduled nights **never tick the counter**. Accepted consequence: a group that stops meeting entirely flags nobody — that failure surfaces through #52's past-due flags, not here.
- Attendance for the counter = any Completion row for that (person, meeting), including NULL-session presence (#26/#65) — a fellowship-night tick keeps someone off the quiet list.
- Threshold: per-group, default 3 (#10/#64). The control lives on the Settings screen (issue 12 builds that screen): "Flag someone after — missing this many meetings in a row" with 2/3/4 options, per the board.
- "**Stepped away**" (manual override from issue 3, #10/#66) is a separate state from Quiet — never "Closed". Quiet members are still shown (the v1.1 follow-up drafts against this list, but **no draft/send feature in v1**).
- Home (#20): next meeting card + attention list; roster stays in its own tab. Copy register describes situations, never grades people — the boards' "Quiet", "Needs you" idiom.
- Guests (#31): a person's quiet counter runs against their HOME group's held meetings; a ride-along visit still counts as contact (they have a Completion row — but note it's on another group's meeting: the counter asks "of my home group's last N held meetings, which did they miss" and any attendance anywhere in between is still visible contact — follow #64's text in DESIGN-CONCEPT.md; if genuinely ambiguous, report the question rather than inventing the rule).
- Tests: fixture-driven at the server boundary, test Postgres, TDD red first. Explicit cases from the PRD: counting across cancelled meetings (a cancelled month flags no one); threshold per-group; NULL-session presence resets the streak; stepped-away excluded from the flag.
- Normative on any gap: `/home/jericho/biblestudy-tracker/DESIGN-CONCEPT.md`.

## Looks like
- `/home/jericho/biblestudy-tracker/design/Main.dc.html` (Home: next meeting + "Needs you" list) and `/home/jericho/biblestudy-tracker/design/Settings.dc.html` (the threshold row).
- ⚠️ Home board copy says "No attendance in 3 weeks" — **stale**: #64 changed the unit to meetings. Keep the board's layout/tone, fix the unit in copy.
- ⚠️ **The same stale unit appears on a second board** (found while supervising issue 6, 2026-08-21): `design/Attendance.dc.html`'s mock sub-line reads `Quiet 3 weeks · joined at Session 3`. #64 counts **consecutive missed HELD meetings, never weeks**. This issue owns that sub-line wherever it renders — fix the unit on the sheet too, not just on Home.
- Render: `node /home/jericho/biblestudy-tracker/design/preview/build.js Main '[{}]'`. Human comparison required before done.
