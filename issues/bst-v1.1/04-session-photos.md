---
issue: 4
title: Session photos — upload/take, batch consent confirm, delete
status: in-progress
blocked-by: []
type: hitl
---

# Session photos

## Goal
Every meeting/session record gains "upload or take photo". Multiple photos per
session, a caption and date each, **one** consent confirm per upload batch, and
delete-to-retract. Originals plus a thumbnail variant land in Cloudflare R2.

Adopted whole from `~/biblestudytayo-support/issues/ministry-support-site/
10-bst-session-photos.md` — same scope, and that file remains the grilled
source; this is the BST-side backlog entry that gets built.

## Scope
- As Jericho, I take or upload photos on any session record, so the archive
  builds itself as I go.
- One consent tick per upload batch — *"I got everyone's consent to use these
  on the website"* — a recorded moment, not a per-photo switch.
- Delete a photo → the row and the object are gone; the public site drops it on
  the next revalidate. Consent can be withdrawn.
- ⛔ **NO per-photo public/private toggle** — decided against deliberately; do
  not reintroduce it. Photos stay Jericho's private discipleship archive in BST
  regardless of what the public site shows.

## Notes
- Repo `~/biblestudy-tracker`. New module `src/lib/session-photos/`:
  `uploadPhotos(meetingId, files, consentConfirmed)`, `deletePhoto(id)`,
  `listPhotosForSession(id)`.
- **Schema (next free migration — 011 at writing time):** `session_photos` —
  id, owner_id, meeting_id → `meetings(id)`, caption, taken_on date,
  `consent_confirmed_at timestamptz NOT NULL` (the batch tick, recorded),
  `r2_key`, `r2_thumb_key`, created_at. Delete removes row + objects (the
  grilled spec chose removal — #24's tombstone doctrine is about records, not
  this).
- **Storage: Cloudflare R2.** `~/print-invox/src/lib/storage.ts` is the
  reference shape. ⚠️ **PROPOSED, not yet answered: a new bucket dedicated to
  BST** (Jericho creates it); the alternative is a prefix inside an existing
  bucket. Confirm at review. Keys: `sessions/<group>/<date>/<uuid>.jpg` plus
  the thumbnail variant. Env: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — placeholders written for Jericho to
  fill; ⛔ never paste keys in chat, never read `.env.local`.
- ⚠️ Two hazards to settle during the build, and record which was chosen:
  (a) phone photos can exceed Vercel's request-body limit — downscale
  client-side (canvas) before upload, or upload direct-to-R2 with a presigned
  PUT; (b) thumbnailing needs an image step — `sharp` is a devDependency today;
  if used at runtime it becomes a real dependency (Vercel supports it), or
  derive the thumbnail client-side alongside (a).
- Tests: mock R2 client + the Neon test branch, red first. Cover: a batch
  without the consent tick is refused; with it, every file + thumbnail lands
  and the row carries `consent_confirmed_at`; delete removes row and object;
  `listPhotosForSession` returns captions and dates.
- UI surface: the meeting record (`src/app/(shell)/meetings/[id]/`).
  Camera/take: `<input type="file" accept="image/*" capture="environment"
  multiple>`.
- v1.1 leader accounts (not built): only Jericho may upload/delete for the
  public flow — leave the ownership check where it can be tightened.
- **hitl because:** the bucket and credentials are Jericho's account work, and
  the built screen is new UI behind a board — his comparison decides done.
- Loops before done: test / typecheck / lint / build. One commit referencing
  the issue; **do not push**. Deploy + production migration are separate,
  deliberate steps (CLAUDE.md).

## Status 2026-09-11

**Code side BUILT and committed — not done.** Migration `011`, the module
(`photos.ts` / `storage.ts` / `actions.ts` / `downscale.ts`), the card on the
meeting record, the 4mb action body limit, `.env.example` + `.env.local`
placeholders. 540 tests green (mock R2 client), typecheck / lint / build clean;
the card's unconfigured and configured states both smoke-tested against the
test branch.

**What still stands between this and `done` (both hitl):**
1. Jericho creates the R2 bucket + an Object Read & Write API token, fills the
   four `R2_*` vars locally and on Vercel — until then the card says "not set
   up yet".
2. The first REAL upload on his phone (the module's mock only proves the rules;
   a real PUT, a real signed GET, and EXIF orientation need a device).
3. The Looks-like pass against `Attendance.dc.html` — the built card is new UI.

**Build decisions, recorded (per the Notes above):** the archive copy is a
client-side DOWNSCALE (long edge 2048px, q0.88) rather than the camera's true
original — a presigned direct-to-R2 upload would be the way to keep true
originals, and that is a new decision, not a tweak; thumbnails are made in the
browser (no `sharp` at runtime); one photo per action request, so a batch's
requests each stay small.

## Looks like
- `design/Attendance.dc.html` (and the meeting-record screens) govern the
  surface this action is added to. There is **no board for the photo action
  itself** — it is new UI on a boarded screen. Render boards with
  `node design/preview/build.js Attendance '[{}]'` — ⚠️ board *props* come from
  the `DC_PROPS` env var, not the JSON argument.
