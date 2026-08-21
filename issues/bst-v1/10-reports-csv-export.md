---
issue: 10
title: Reports (Person / Group / Roll-up) + CSV Export
status: open
blocked-by: [6, 9]
type: afk
---

# Reports + CSV Export

## Goal
The Reports tab works: Person sheet, Group history, and Roll-up views behind a segmented control, each exportable as CSV. For Jericho's eyes only — there is no external recipient.

## Scope
- "As the leader, I view a person sheet, a group history, and a roll-up report, and export CSV…"

## Notes
- Three reports (#21): **person sheet** (contact + status + progress + attendance history), **group history** (meetings held/cancelled, attendance, guest visits shown per #31), **roll-up** (ministry-wide counts: members, groups, progress, quiet, baptized). Jericho-only — no share/send path, no external recipient (rejected: reporting engine).
- Roll-up counting honors #31: guest completions credit the person; home-group and roll-up counts unchanged; host group history shows the visit.
- The word is **Export** = CSV out (#66/#72). ⛔ Never "back up", never "Sync" — those are retired. Board's "Export & back up" CTA is stale vocabulary; the board also predates #62 (no tab bar) — the CTA must not fight the tab bar.
- Spelling: "**baptized**" (#66) — the Reports board has "baptised", which is wrong.
- Reports may be information-dense (#30's one exception), still English (#29). Stat tiles use situation language — "Stepped away", never "Closed" (#66).
- CSV: served from a route handler; plain UTF-8; columns stable enough to re-import into a spreadsheet. Tombstoned/soft-deleted rows excluded from exports (they exist for history, not reporting).
- Tests: server boundary, test Postgres, TDD red first. Fixture: roll-up counts with a guest visit and a stepped-away member; CSV golden-file for each report.
- Normative on any gap: `/home/jericho/biblestudy-tracker/DESIGN-CONCEPT.md`.

## Looks like
- `/home/jericho/biblestudy-tracker/design/Reports.dc.html` — governs layout, tiles, density; overridden on the stale points named above (tab bar, "Export" wording, "baptized").
- Render: `node /home/jericho/biblestudy-tracker/design/preview/build.js Reports '[{}]'`. Human comparison required before done.
