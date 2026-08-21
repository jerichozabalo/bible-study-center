# Bible Study Tracker — design audit (Fable, 2026-08-21)

Scope: `DESIGN-CONCEPT.md` (63 decisions + v1.1 backlog), all 11 screen artboards in `design/`, the logo exploration (`design/logo3d/`, `design/Logo*.dc.html`, `design/logo-options.html`), checked against `~/glc-books/GLC-SESSIONS.md` and `~/outreach/VOICE.md`. Report-only; nothing else touched.

## Verdict in one paragraph

This is an unusually well-governed design. The decision log records rejected alternatives, cross-references its own amendments (#3→#33, #20→#62), names invariants (#24 history never rewrites; one writer per record), and — rarest of all — records the times Jericho overruled the recommendation, with the objection preserved so it isn't re-argued (giving audience/placement, §SUPPORT). The screens mostly deliver what the decisions promise, down to comments in the mock scripts citing decision numbers. The copy voice is genuinely good ("Needs you", "This date has passed. Did it push through?", "Saves offline. Syncs when you have signal."). The weak spots are few but real: one genuine contradiction (quiet-list unit), one data-model hole (no-session attendance), one distributed-systems hazard (ghost materialisation), one pastoral gap (v1.1 note visibility), and a handful of copy registers that grade people instead of describing situations.

---

## Part 1 — Findings

### A. Contradiction: the quiet list is measured in weeks everywhere except Settings
- Decision #10: "derived (**3 wks**, per-group configurable)". Home (`Main.dc.html`): "No attendance in **3 weeks**." Person (`Person.dc.html`): "Quiet for **3 weeks**."
- Settings (`Settings.dc.html`): "Flag someone after — **Missing this many meetings in a row**" with 2/3/4 **meetings**.

These are different rules and diverge exactly where the design says the distinction matters: #50 keeps cancelled meetings visible *because* "an empty Sunday reads differently… which matters to #10's quiet list", and #26 counts no-session attendance for it. Under "3 weeks", a group cancelled for a month (brownouts, Holy Week) flags everyone; under "3 missed meetings in a row", it flags no one. Nobody decided which. This must be settled before build — it's the trigger for the app's most pastoral feature.

### B. Model hole: `Completion` cannot represent the attendance the design promises to record
The model line is `Completion (person, session, meeting, attended|present-only)`. But:
- #26: attendance at a **no-session** meeting still counts for the quiet list.
- `NewMeeting.dc.html` (lesson off): "everyone you tick still counts as contact, so they stay off the quiet list."

A fellowship night has no session for the row to point at, and a "present only" row at a session meeting is by definition *not* a completion. The one entity is carrying three meanings and can't hold one of them. Either `session` goes nullable with clear semantics, or attendance becomes its own record and Completion hangs off it. Decide on paper — this is the row the sync design (#14 "union merge for completions") is built around, so changing it later is the migration #32/#33 were specifically written to avoid.

### C. Ghost/proposed generation has no idempotency story
#7 materialises 8 weeks of proposed meetings; #49 draws ghosts beyond that. Nothing says **which device** materialises, or what keys a generated Meeting. Two devices offline for a week will both generate the same slots; #14's union merge unions *completions* but nothing dedupes two Meeting rows for the same group+date. Same class of problem: field-level **LWW needs a clock decision** (device clocks lie; server-receipt time vs hybrid logical clock), and none is recorded. These are the two silent-data-corruption paths in an otherwise carefully tombstoned design.

### D. Local-first is the largest unacknowledged risk
Every app Jericho has shipped (TimeTrax, OurChurch, Print Invox, SilidTahanan) is server-first Next.js + Neon + Vercel. #12/#14 commit BST to local-first + field-level sync in one line each — a different architecture from everything proven, and the hardest ~40% of the build (local store, sync transport, conflict handling, offline auth per #13). The concept treats it as settled; it's settled as a *goal*, not as a design. It deserves its own decision session before the backlog is cut.

### E. v1.1 subtree visibility reaches pastoral notes — and nobody chose that
The leader-accounts section (v1.1 backlog) grants a recursive, read-only subtree: an upline sees a downline member's **notes**, spiritual status, baptism, quiet flags. Notes are where "struggling with…" gets written. Members are never told who can read them, and no consent surface exists. The design already proved carve-outs are possible — giving data is "visible to Jericho alone… the first data class the visibility rule does not reach". Notes are a stronger candidate for the same treatment than money is. This is the project's biggest pastoral/ethical gap, and it should be decided *before* leader accounts ship, not after a downline leader's member finds out.

### F. The giving card's only remaining safeguard is copy that doesn't exist
Three calls on the giving feature stack in the same direction: whole-tree audience (over objection), permanent member-home placement (over objection), per-member attribution (over the names-free recommendation). Each was decided individually; together they leave exactly one mitigation carrying the "reads as giving to their own leader" risk: the requirement that "the card MUST name whose ministry it is, in plain Taglish". That sentence of Taglish is load-bearing and unwritten. It should be drafted, grilled, and treated as a spec artifact — not left for whoever builds the card. (The surviving structural mitigations — pending rows hidden, Jericho-only visibility, no milestone attach — are good and correctly recorded as non-revivable.)

### G. Walk-in capture collides with #9 at the worst possible moment
#25 allows adding a walk-in from the attendance screen; `Attendance.dc.html` shows "Guest (unsaved) — Tap to name and save as a member". #9 requires name **plus** phone or email. Mid-meeting, you often have neither — and this is the exact moment the app most wants to capture a new person. Either #9 gets a walk-in deferral (save with name only, nag for contact later) or the design accepts losing guests. Worth a one-line decision.

### H. Labels that grade people instead of describing situations
The concept's own doctrine is exemplary here (quiet follow-up assisted-only because "an automated 'we miss you'… tells them a SYSTEM noticed"). Three labels fall short of it:
- **"Closed"** (#10; `Person.dc.html` "She has not been marked closed"; Reports roll-up stat tile "Closed 2"). CRM register on a human being. If any member ever glimpses the screen, this is the word that wounds. "Quiet" shows the alternative is achievable — consider "Stepped away" / "Released".
- **"BEHIND"** pill (`GroupDetail.dc.html`) vs **"CATCH-UP"** flag (`People.dc.html`) — the *same state* has two labels, and one of them grades the person while the other names the path. Keep CATCH-UP, drop BEHIND.
- Contrast with the genuinely good ones: "Quiet", "Not yet baptized" (the "yet" is doing pastoral work), "Needs you".

### I. Screens missing settled decisions
- `NewMeeting.dc.html` has no **time override** (#36) and no **notes** field (#55) — both settled v1. The venue-in-notes decision (#54) makes notes non-optional on this form.
- `People.dc.html`, `Groups.dc.html`, `Reports.dc.html` have **no tab bar** (#62), and People/Reports carry full-width bottom CTAs ("Add a person", "Export & back up") that will fight the tab bar for the same 390px-wide strip. That layout conflict is unresolved and only invisible because the boards predate/skip #62.
- Week view has no ghost representation; only Month explains "not created yet" (#49). Minor, but the default view is Week (#46), so most days the ghost concept is invisible.

### J. Mock data should come from the real curriculum — it's currently hiding a layout risk
- `NewMeeting.dc.html` invents "Book 3 — Christian Beliefs" with 6 sessions and puts Couples at "next: 5". Real Book 3 (`GLC-SESSIONS.md`) is **The Holy Spirit, 4 sessions** — Reports has it right, so the boards disagree with each other.
- More important: **no board ever renders a book with more than 6 sessions.** Book 7 has 8; Book 8 has 12. The Person progress row (`Person.dc.html`) and group progress dots are all designed at 6 cells across 358px. Twelve 34px-tall labelled cells will not fit as drawn. Re-mock from the real index before the layout is treated as done.
- Cross-board drift generally (Calendar's groups — BGroup Linggo/Kabataan/Sabado — share nothing with the other boards' Tuesday/Sunday Youth/Couples; Home says Tue 19 Aug, Calendar says Fri 21 Aug). Harmless individually; a single shared mock roster would catch more.

### K. The Taglish carve-out in #29 is real but unwritten
#29: "English UI; Taglish reserved for member-facing reminder copy (v1.1)". Yet the sign-in tagline is Taglish ("Every attendee, every session, kahit walang signal" — a good line), and the app's *name* is Taglish. The de facto rule is "brand-voice surfaces Taglish, workflow UI English" — write that down so the next screen doesn't have to relitigate it. Small nits in the same bucket: "baptised" (Reports) vs "baptized" (Person); and three overlapping words — "Back up" (Home card), "Sync" (Settings), "Export & back up" (Reports) — for two distinct actions (sync vs CSV). Pick one word per action.

### L. Naming and logo
- **"Bible Study Tayo" is a strong name.** The pun works twice: *tayo* = "us/together" and "Bible study tayo!" = "let's have Bible study" — an invitation, which is exactly the app's theology. It also gets *better* when member accounts arrive.
- The logo system thinking (`logo3d/logo-final.html`) — one drawing at three reduction levels with honest floor sizes — is professional-grade. Two cautions: (1) the emblem is **two men**, while the mock roster (and much PH BGroup reality) is majority women; a mark this figurative makes a claim an abstract mark wouldn't — worth a conscious yes. (2) The 1950s retro-ink register is a different era from the app's soft cream/blue Bricolage UI; drop the roundel into the actual `Main.dc.html` header (which still shows the old book glyph) before committing.

---

## Part 2 — Proposed remit (what I'm specifically good for here)

Ordered by value. Everything below is language, coherence, and adversarial-reasoning work — the kind a code-first pass skips or does badly.

1. **Pre-build blocker trace.** Convert findings A–D + G into a short grill-me question list (quiet-list unit, attendance model, ghost idempotency + clock, local-first stack, walk-in rule), phrased as decisions for Jericho to make, not answers imposed — matching the co-create-plans rule. Worth doing because every one of these is cheaper to settle on paper than in a migration.
2. **The Taglish message kit.** Draft the load-bearing member-facing copy: the giving card (finding F — currently the feature's only safeguard), the quiet-follow-up draft line, the meeting-reminder draft, the catch-up invite. These are voice work against VOICE.md; they're spec artifacts, and no coding pass will produce them in his register.
3. **Terminology glossary.** One settled word per concept — Closed→?, BEHIND→CATCH-UP, sync vs export, the #29 brand-voice carve-out, baptized spelling — appended to the concept with his sign-off, so 11 screens and future v1.1 screens stop drifting.
4. **Real-data stress pass on the boards.** Re-mock every artboard from `GLC-SESSIONS.md` (12-session Book 8, 8-session Book 7, long Filipino names, a 15-member group) and re-render to find what breaks at 390px. Cheap now; each break found later costs a redesign under deadline.
5. **Sync tracer-bullet spec.** Write the LWW + union + tombstone design as a concrete PRD section — clock strategy, meeting-generation key, conflict cases enumerated — for finding C/D. I can enumerate distributed edge cases exhaustively on paper; the proof is still code.
6. **v1.1 consent + visibility copy.** The member-facing text for "who can see what" when leader accounts land (finding E), plus a proposed notes carve-out decision written in the log's own style (decision, rejected alternatives, invariant).
7. **Certificate design (v1.1).** Data-driven certificate wording + render spec (program name, person, date, signatory question) — ceremony copy in two languages is squarely my lane.

**Not the right tool for:** choosing which logo take is *him* (his eye, not mine); predicting whether other leaders will adopt it (only real BGroups answer that); final Taglish naturalness (my drafts are inputs to his ear — VOICE.md's correction history shows his register wins); and proving the sync engine works (that's code and tests, not prose).
