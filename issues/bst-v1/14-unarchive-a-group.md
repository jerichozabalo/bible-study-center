---
issue: 14
title: Unarchive a BGroup (archiving is currently a one-way door)
status: open
blocked-by: [2]
type: afk
---

# Unarchive a BGroup

## Goal
An archived BGroup can be brought back from its detail page, returning to the
active list with its schedule and current book intact.

## Why this exists
Discovered while supervising issue 02 (2026-08-21), not planned.

Archiving is reachable in two taps from a group's detail page, and once done
there is **no way back in the UI**: the archived group's detail page hides every
control, so the screen a leader lands on after a mis-tap offers them nothing.
The only recovery today is a hand-written `UPDATE` against Neon.

#27 forbids *deleting* a group and requires archive-with-bulk-move. It says
nothing about the reverse, and nothing in `DESIGN-CONCEPT.md` rejects it — this
is a gap, not a decision. It clears the bar for a real issue because Jericho is
one mis-tap away from losing a group from his own working set with no
self-service fix, and he is the only user there is.

## Scope
- An "Unarchive" control on an archived group's detail page.
- Restores it to the active list; it can be picked again wherever archived
  groups are excluded (#60).
- Members are **not** moved back automatically. If archiving offered a bulk move
  (#27) and the leader took it, those people now have a different home group and
  silently yanking them back would be a second surprise. Decide and state what
  the screen says about this — the honest line is that the group returns empty
  and people are moved back by hand.
- Confirmation before unarchiving is probably unnecessary — unlike archiving,
  it is not destructive.

## Notes
- `archiveGroup(owner, id, {moveMembersToGroupId})` lives in
  `src/lib/roster/groups.ts`; the archived state is a flag plus a timestamp, so
  the reverse is a small owner-scoped action beside it (#32 — every roster
  function is owner-scoped).
- Tests at the server-action boundary against the test database, TDD red first,
  per the PRD's testing decisions. Cover: unarchive restores it to
  `listGroups`, it disappears from `listArchivedGroups`, and it becomes
  selectable again wherever archived groups are filtered out.
- Nothing about history is rewritten — meetings and completions are untouched by
  either direction (#24).

## Looks like
- No artboard exists for this. Follow `GroupDetail.dc.html`'s idiom, and mirror
  the placement the archive control already uses.
- ⚠️ The artboards are not infallible — issue 01's human pass found
  `Main.dc.html` missing a subpath of Lucide's `users` glyph. If a board looks
  wrong, say so rather than reproducing it.
