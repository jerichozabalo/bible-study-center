---
issue: 3
title: Birthday card on Home — this week's celebrants (Sunday → Saturday)
status: open
blocked-by: []
type: afk
---

# Birthday card on Home

## Goal
Home carries a card naming the people whose **birthday falls in this week —
Sunday to Saturday, Manila** — each with the day and the age they turn. It
renders nothing at all when nobody is celebrating.

## Scope
- As Jericho, opening Home shows who to greet this week.
- One line per person: display name (nickname when issue 1 has landed),
  the day ("Wed 17 Sep"), and the age they turn. Age stays derived, never
  stored (#9b).

## Notes
- **No migration.** `people.birthday` already exists (#9b) and age is derived
  (`ageOn` in `src/lib/dates.ts`).
- Week = the **current calendar week, Sunday first** (the calendar's week
  convention, #46), computed in Manila from `manilaToday()`. The window can
  cross a year boundary (December → January) — that is where a naive
  month/day compare breaks; it must not.
- **Feb 29 birthdays** in a non-leap year: treat as **Feb 28** (judgment call —
  flagged at review).
- Included: anyone not removed (#24 — `removed_at IS NULL`). **Stepped-away
  people are included** — say if you'd rather they weren't.
- Home loads its data in one `Promise.all` (`src/app/(shell)/page.tsx`); add
  the birthday read there. The derivation is a **pure function** (e.g.
  `src/lib/insights/birthdays.ts`) unit-tested for: Sunday start, a full week,
  year boundary, leap day, nickname fallback, no birthday set; plus a thin
  query tested at the boundary. Home is `force-dynamic` and not in the
  offline-readable set — no outbox/SW work here.
- Placement: above "Needs you" — time-bound for the week; the final position is
  part of the visual gate. Hidden when empty (silence over an empty state, the
  issue-7 precedent).
- Depends on issue 1 only for how names render — use the display-name helper
  when it exists, else `name`. Not a `blocked-by` edge.
- Loops before done: test / typecheck / lint / build. One commit referencing
  the issue; **do not push**.

## Looks like
- `design/Main.dc.html` governs Home (hero, "Needs you", the meeting rows).
  **There is no artboard for this card** — it is new UI inside a boarded
  screen, so build it in the page's existing idiom (card, eyebrow labels, type
  scale) and Jericho's phone pass is what decides done.
