---
issue: 5
title: Calendar page (Month/Week, materialiser + ghosts, past-due resolve)
status: open
blocked-by: [4]
type: afk
---

# Calendar page

## Goal
The Calendar tab works: Week view (default, Sunday first) and Month toggle; 8 weeks of proposed meetings materialised from group schedules; ghost slots drawn beyond; tapping a ghost creates that one meeting; past-due proposed meetings flagged with one-tap resolve; cancelled meetings shown greyed and struck through.

## Scope
- "As the leader, I see 8 weeks of proposed meetings materialised and ghost slots beyond, on a Month/Week calendar…"
- "As the leader, I resolve past-due proposed meetings with one tap (held/cancelled)…"

## Notes
- Materialiser (#7/#49): generates PROPOSED meetings 8 weeks out from each live group's schedule, `origin='generated'`, written with **`ON CONFLICT DO NOTHING`** against the partial unique index from issue 4 (#73) — retries are the NORMAL case on this network (Neon autosuspend `fetch failed` first hit; IPv4-first + retry/backoff mandatory). Every generation path is idempotent: the materialiser, a schedule change, a ghost tap.
- Ghosts (#49/#59): drawn from the group's schedule beyond 8 weeks — **not rows, not stored**. Tapping a ghost creates exactly that one meeting (via issue 4's `createMeeting`, still PROPOSED per #47). Horizon fixed at 8 weeks, not a setting. Archived groups generate no ghosts (#60).
- Schedule change (#48b): moves future **PROPOSED** meetings to the new day; **HELD meetings are never touched** (#24 — history never rewrites).
- Past-due (#52): a proposed meeting whose date has passed is flagged on the calendar with one-tap held/cancelled resolve. (Board copy idiom: "This date has passed. Did it push through?")
- Cancelled (#50): shown greyed + struck through, never hidden — an empty Sunday must read differently from a cancelled one (feeds #64's quiet list later).
- Views (#46): Month/Week toggle, **Week default, SUNDAY first**. Week view: two meetings in the same hour split the column; three+ collapse to "+N" with detail in the day list (#58). ⛔ No drag-to-move (#57) — tap, then edit the date. Times display in `Asia/Manila` semantics (#56).
- The calendar **reads from cache offline** (#61 as narrowed by #70) — issue 11 wires the cache; here, don't hard-fail the page shell when the network read fails.
- Tests (explicit per PRD): double-materialise → no duplicates; materialise-after-schedule-change → no duplicates, held rows untouched; ghost-tap retried → one row; human-created meeting same day as generated one → succeeds. Server boundary, test Postgres, TDD red first.
- Normative on any gap: `/home/jericho/biblestudy-tracker/DESIGN-CONCEPT.md`.

## Looks like
- `/home/jericho/biblestudy-tracker/design/Calendar.dc.html` — governs both views.
- ⚠️ Known board gap: only Month explains "not created yet"; Week (the default) has no ghost representation drawn — carry the ghost affordance into Week following the board's idiom.
- Render: `node /home/jericho/biblestudy-tracker/design/preview/build.js Calendar '[{"view":"week","day":16}]'` (a prebuilt preview exists at `design/preview/Calendar-preview.html`). Human comparison required before done.
