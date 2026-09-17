"use client";

/**
 * "Delete this meeting?" — the confirm (#75, 2026-09-17). Same shape and same
 * button treatment `ArchiveForm` uses for a BGroup: no red — this app has no
 * danger color anywhere and archiving (also permanent-feeling, if not
 * actually irreversible) does not reach for one either. The page's own copy
 * carries the "this cannot be undone" weight instead.
 */
import Link from "next/link";
import { useActionState } from "react";

import type { MeetingFormState } from "@/lib/meetings/actions";

export function DeleteMeetingForm({
  action,
  meetingId,
}: {
  action: (state: MeetingFormState, formData: FormData) => Promise<MeetingFormState>;
  meetingId: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="pt-2">
      <input type="hidden" name="meetingId" value={meetingId} />

      {state.error ? (
        <p
          role="alert"
          className="mb-4 rounded-[18px] border border-line bg-card px-4 py-3 text-[14.5px] leading-[1.45] text-ink"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="flex h-[58px] w-full items-center justify-center rounded-[18px] bg-blue text-[17px] font-bold text-white active:bg-blue-deep disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete meeting"}
      </button>
      <Link
        href={`/meetings/${meetingId}`}
        className="mt-[9px] flex h-[54px] w-full items-center justify-center rounded-[17px] text-[15.5px] font-bold text-slate active:bg-shell"
      >
        Cancel
      </Link>
    </form>
  );
}
