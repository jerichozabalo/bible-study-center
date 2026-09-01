---
issue: 7
title: Catch-up matching + guest derivation
status: done
blocked-by: [6]
type: afk
---

# Catch-up matching + guest derivation

## Goal
A meeting's attendance sheet lists people from OTHER BGroups who are missing that exact book+session (invitable as ride-alongs); a person's detail view names the concrete upcoming meeting where they can fill their gap; visitors render as marked guests.

## Scope
- "As the leader, on a meeting's attendance screen I see people from other BGroups missing that exact book+session, and a person's view names the meeting where they can catch up…"

## Notes
- Matching (#31): candidates = people from other BGroups missing **that exact book+session** — NOT "anyone behind", NOT quiet-list candidates (both explicitly rejected). Two directions: sheet → who could ride along tonight; person view → which upcoming meeting (any group) covers their missing session.
- **Guests are derived, never stored** — no new entity: a guest visit is an ordinary Completion where `meeting.group != person.home_group`, computed at render time. Rendered as "Nico (BGroup Linggo)" — name + home group.
- Counting rules (#31): the completion credits the **person**; home group and roll-up counts unchanged; the **host** group's history shows the visit.
- Mid-book joiners (#28) carry their joined-at marker so the catch-up list stays readable — someone who joined at session 4 isn't "missing" 1–3 in a way that spams the list without context.
- Vocabulary: the state is "**CATCH-UP**", never "BEHIND" (#66) — it names the path, not a grade on the person. English UI; the drafted catch-up *invite* is v1.1 — no send/draft feature here.
- Tests: server boundary, test Postgres, TDD red first. Fixture spanning ≥2 groups on the same book at different sessions: candidate appears on the right sheet only; guest completion credits person but not home-group roll-up; host history shows the visit; joined-at marker respected.
- Normative on any gap: `/home/jericho/biblestudy-tracker/DESIGN-CONCEPT.md`.

## Looks like
- `/home/jericho/biblestudy-tracker/design/Attendance.dc.html` (guest rows + catch-up section on the sheet) and `/home/jericho/biblestudy-tracker/design/Person.dc.html` (the catch-up line naming a meeting).
- Render: `node /home/jericho/biblestudy-tracker/design/preview/build.js Attendance '[{}]'`. Human comparison required before done.
