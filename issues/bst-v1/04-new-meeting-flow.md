---
issue: 4
title: "New-meeting flow: [+] tab with group picker, prefill, always-PROPOSED"
status: done
blocked-by: [2]
type: afk
---

# New-meeting flow

## Goal
The [+] tab opens the New Meeting sheet: pick a group (3 cards, most-recently-met first), get date + prefilled book/session, optionally override time, add notes, optionally set the group's recurring schedule — and a PROPOSED meeting exists, visible somewhere immediately (a simple next-meetings list on Home is enough until issues 5/8 land).

## Scope
- "As the leader, I create a one-off meeting from the [+] tab — group picker showing 3 cards most-recently-met-first, date, prefilled book + next session, optional time override and notes (the venue lives in notes) — and it is always PROPOSED…"

## Notes
- Meeting schema lands here, complete: group, date, time (inherited from group, overridable, #36), book + session **optional** (#26 — a no-session fellowship night is legal), notes free-text optional (#55 — ⛔ no structured location field, the venue lives in notes, #54), status proposed/held/cancelled (#7), `origin` 'generated'|'created' (#73), `led_by` + `owner_id` stamped always-Jericho (#32). Local date + time, `Asia/Manila` semantics — never a bare device-relative timestamp (#56).
- Create the **partial unique index now**: `(group_id, date) WHERE origin='generated'` (#73). Human-created meetings are exempt — a same-day make-up meeting must succeed. The materialiser (issue 5) relies on this index existing.
- **Creating always yields PROPOSED, whatever the date** (#47) — no future/past split, no prompt. *Held* means attendance was taken and stays a deliberate act.
- Prefill (#53): group's current book + the session after that group's last **held** meeting. This is the group's agenda, never anyone's progress.
- Group picker (#63): 3 group cards, ordered by last **held** meeting desc; never-met groups last; "See N more" expands (state persists while the sheet is open); a selected group is never hidden by collapsing — it takes the last visible slot. Card line 1 = schedule + book; line 2 = `N members · last met Aug 17` (or `no meetings yet`). Archived groups cannot be picked (#60).
- Recurring option **sets the GROUP's schedule** — one recurrence per group, editable from either place (#48). (Moving future proposed meetings on a schedule change is issue 5, #48b.)
- Tests: server boundary, test Postgres. Cover: always-PROPOSED regardless of date; prefill after a held meeting; same-day human-created meeting beside a generated one succeeds; picker ordering with a never-met group.
- Normative on any gap: `/home/jericho/biblestudy-tracker/DESIGN-CONCEPT.md`.

## Looks like
- `/home/jericho/biblestudy-tracker/design/NewMeeting.dc.html`.
- ⚠️ The board predates #36/#55: it has **no time-override and no notes field — both are settled v1 and must be added**, following the board's form idiom. #54 makes notes non-optional on this form (it's where the venue goes).
- Render: `node /home/jericho/biblestudy-tracker/design/preview/build.js NewMeeting '[{}]'`. Human comparison required before done.
