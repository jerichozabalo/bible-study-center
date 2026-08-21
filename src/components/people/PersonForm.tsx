"use client";

/**
 * The one form behind "Add a person" and editing one. No artboard draws it; the
 * idiom is `GroupForm`'s, which is `design/NewMeeting.dc.html`'s: eyebrow
 * labels over white cards with a hairline border, a full-width blue button at
 * the end of the form rather than pinned to the bottom (#62 put the tab bar
 * there).
 *
 * The field order is the order the questions get answered in a room: who they
 * are and how to reach them, which BGroup, then everything that can wait. Only
 * the name is required (#9 as deferred by #67) and the form says so, so a
 * walk-in captured mid-meeting is one field and a tap.
 *
 * A client component for `useActionState` — how a refusal gets back onto the
 * screen with what was typed still in it. It posts and works without
 * JavaScript.
 */
import { useActionState } from "react";

import type { PersonFormState } from "@/lib/roster/actions";
import type { PersonFormValues } from "@/lib/roster/form";
import { CIVIL_STATUSES, SPIRITUAL_STATUSES } from "@/lib/roster/display";

export type GroupOption = { id: string; name: string };

export type { PersonFormValues };

const FIELD =
  "h-[54px] w-full rounded-[18px] border-[1.5px] border-line bg-card px-[13px] text-[15.5px] font-semibold text-ink";
const EYEBROW = "text-[11px] font-bold tracking-[0.13em] text-tan";
const HINT = "mt-[7px] text-[12.5px] leading-[1.45] text-tan";

export function PersonForm({
  action,
  groups,
  values,
  submitLabel,
  personId,
}: {
  action: (state: PersonFormState, formData: FormData) => Promise<PersonFormState>;
  /** Live BGroups only — an archived one takes no members (#60). */
  groups: GroupOption[];
  values: PersonFormValues;
  submitLabel: string;
  personId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const shown = state.values ?? values;

  return (
    <form action={formAction} className="pt-1 pb-2">
      {personId ? <input type="hidden" name="id" value={personId} /> : null}

      {state.error ? (
        <p
          id="person-form-error"
          role="alert"
          className="mb-4 flex items-start gap-[9px] rounded-[18px] bg-amber-well px-4 py-3 text-[14.5px] leading-[1.45] text-amber-ink"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-[2px] shrink-0"
            aria-hidden="true"
          >
            <path d="M12 8v5M12 16.5v.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
          {state.error}
        </p>
      ) : null}

      <label className={`${EYEBROW} block`} htmlFor="person-name">
        NAME
      </label>
      <input
        id="person-name"
        name="name"
        type="text"
        defaultValue={shown.name}
        placeholder="Nena Villamor"
        autoComplete="off"
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "person-form-error" : undefined}
        className={`${FIELD} mt-[9px] ${state.error ? "border-amber-ink" : ""}`}
      />

      <div className={`${EYEBROW} mt-[22px]`}>HOW TO REACH THEM</div>
      <input
        name="phone"
        type="tel"
        aria-label="Mobile number"
        defaultValue={shown.phone}
        placeholder="0917 555 0184"
        autoComplete="off"
        className={`${FIELD} mt-[9px]`}
      />
      <input
        name="email"
        type="email"
        aria-label="Email"
        defaultValue={shown.email}
        placeholder="nena@example.com"
        autoComplete="off"
        className={`${FIELD} mt-[8px]`}
      />
      {/* #9 wants one of these two; #67 lets it wait, and the roster carries a
          "no contact yet" flag until it lands. Saying so here is what keeps the
          deferral a decision rather than an oversight. */}
      <p className={HINT}>
        A phone or an email is what makes someone reachable. You can save without one — they will
        show as “no contact yet” until it arrives.
      </p>

      <label className={`${EYEBROW} mt-[22px] block`} htmlFor="person-group">
        HOME BGROUP
      </label>
      <select
        id="person-group"
        name="homeGroupId"
        defaultValue={shown.homeGroupId}
        className={`${FIELD} mt-[9px]`}
      >
        <option value="">No BGroup yet</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </select>
      <p className={HINT}>
        One home BGroup each. They can still attend any meeting — moving them here later keeps
        everything they have covered.
      </p>

      <div className="mt-[22px] flex gap-[8px]">
        <div className="min-w-0 grow">
          <label className={`${EYEBROW} block`} htmlFor="person-joined">
            JOINED
          </label>
          <input
            id="person-joined"
            name="joinedOn"
            type="date"
            defaultValue={shown.joinedOn}
            className={`${FIELD} mt-[9px]`}
          />
        </div>
        <div className="min-w-0 grow">
          <label className={`${EYEBROW} block`} htmlFor="person-birthday">
            BIRTHDAY
          </label>
          <input
            id="person-birthday"
            name="birthday"
            type="date"
            defaultValue={shown.birthday}
            className={`${FIELD} mt-[9px]`}
          />
        </div>
      </div>

      <label className={`${EYEBROW} mt-[22px] block`} htmlFor="person-status">
        SPIRITUAL STATUS
      </label>
      <select
        id="person-status"
        name="spiritualStatus"
        defaultValue={shown.spiritualStatus}
        className={`${FIELD} mt-[9px]`}
      >
        <option value="">Not set yet</option>
        {SPIRITUAL_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      <p className={HINT}>CCF’s 4E ladder. Baptism is tracked on its own, below.</p>

      <div className={`${EYEBROW} mt-[22px]`}>BAPTISM</div>
      {/* The checkbox alone answers "yes, at some point"; the date answers
          "when". A date with the box unticked still means baptized — the
          module treats the date as the stronger statement. */}
      <label className="mt-[9px] flex h-[54px] w-full items-center gap-[11px] rounded-[18px] border-[1.5px] border-line bg-card px-[13px] text-[15.5px] font-semibold text-ink">
        <input
          name="baptized"
          type="checkbox"
          defaultChecked={shown.baptized}
          className="h-[20px] w-[20px] accent-blue"
        />
        Baptized
      </label>
      <input
        name="baptizedOn"
        type="date"
        aria-label="Baptized on"
        defaultValue={shown.baptizedOn}
        className={`${FIELD} mt-[8px]`}
      />

      <label className={`${EYEBROW} mt-[22px] block`} htmlFor="person-civil">
        CIVIL STATUS
      </label>
      <select
        id="person-civil"
        name="civilStatus"
        defaultValue={shown.civilStatus}
        className={`${FIELD} mt-[9px]`}
      >
        <option value="">Not set yet</option>
        {CIVIL_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>

      <label className={`${EYEBROW} mt-[22px] block`} htmlFor="person-address">
        ADDRESS
      </label>
      <input
        id="person-address"
        name="address"
        type="text"
        defaultValue={shown.address}
        placeholder="Blk 7 Lot 12, Muzon, SJDM"
        autoComplete="off"
        className={`${FIELD} mt-[9px]`}
      />

      <label className={`${EYEBROW} mt-[22px] block`} htmlFor="person-invited">
        INVITED BY
      </label>
      <input
        id="person-invited"
        name="invitedBy"
        type="text"
        defaultValue={shown.invitedBy}
        placeholder="Maria Santos"
        autoComplete="off"
        className={`${FIELD} mt-[9px]`}
      />

      <label className={`${EYEBROW} mt-[22px] block`} htmlFor="person-notes">
        NOTES
      </label>
      <textarea
        id="person-notes"
        name="notes"
        rows={4}
        defaultValue={shown.notes}
        placeholder="Works nights on Thursdays."
        className="mt-[9px] w-full rounded-[18px] border-[1.5px] border-line bg-card p-[13px] text-[15.5px] font-semibold leading-[1.45] text-ink"
      />
      {/* #74 binds a label to name its readers, and forbids calling notes
          "private" unqualified. v1 has one account and no upline, so this makes
          no promise it would have to break when leader accounts arrive. */}
      <p className={HINT}>Pastoral notes for your own reference.</p>

      <button
        type="submit"
        disabled={pending}
        className="mt-[26px] flex h-[58px] w-full items-center justify-center rounded-[18px] bg-blue text-[17px] font-bold text-white active:bg-blue-deep disabled:opacity-60"
      >
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
