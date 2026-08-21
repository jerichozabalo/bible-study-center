---
issue: 3
title: People roster (add/edit person, People tab, Person detail)
status: open
blocked-by: [2]
type: afk
---

# People roster

## Goal
Person CRUD end-to-end: add a person from the People tab, see them in the roster list, open their detail screen, edit and (tombstone-)correct their record. Home-group assignment and transfer work.

## Scope
- "As the leader, I add people with name + at least one of phone/email (plus birthday, address, civil status, 4E spiritual status, baptized + date, invited by, notes, joined date)…"
- One home group per person (#15); transfer changes home group, completions untouched (#27).
- "Stepped away" manual override on a person (#10/#66).

## Notes
- Contact rule (#9): name required + at least one of phone/email — BUT deferrable (#67): a person may be saved name-only and stays **flagged incomplete** until a contact detail lands (the walk-in path in issue 6 depends on this service accepting name-only).
- Fields (#9b): birthday (age derived), address, civil status, spiritual status = CCF 4E **Engage / Edify / Equip / Empower** (#11), baptized + date (spelling **"baptized"**, #66), invited by, notes, joined date. Photos are v1.1 — no photo field.
- `joined-at` marker per group membership (#28) — mid-book joiners are genuinely behind; this marker keeps catch-up readable later.
- `owner_id` stamped, always Jericho (#32). Soft deletes / tombstoned corrections — nothing truly erased (#24).
- Vocabulary: "**Stepped away**", never "Closed" (#66). Status copy describes situations, never grades people ("Not yet baptized" idiom). English UI.
- Person detail shows contact + status sections now; the progress-dots section is issue 9's scope, the catch-up line is issue 7's — leave clean seams, don't stub fake data.
- Tests: server boundary, test Postgres DB, TDD red first. Cover: name-only save flags incomplete; transfer preserves completions (fixture); tombstone on edit.
- Normative on any gap: `/home/jericho/biblestudy-tracker/DESIGN-CONCEPT.md`.

## Looks like
- `/home/jericho/biblestudy-tracker/design/People.dc.html` and `/home/jericho/biblestudy-tracker/design/Person.dc.html`.
- ⚠️ People board predates #62 (no tab bar; full-width "Add a person" CTA will fight the tab bar — resolve in favor of the tab bar). "CATCH-UP" is the flag word, never "BEHIND" (#66).
- Render: `node /home/jericho/biblestudy-tracker/design/preview/build.js People '[{}]'`. Human comparison required before done.
