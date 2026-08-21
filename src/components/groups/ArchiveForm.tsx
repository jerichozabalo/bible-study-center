"use client";

/**
 * Archiving a BGroup, with #27's offer attached: where should its members go?
 *
 * The offer is an offer. "Leave them in this BGroup" is the default, because
 * that is the truth about where they were — moving people is a decision, not
 * housekeeping the app should do quietly.
 */
import Link from "next/link";
import { useActionState } from "react";

import type { GroupFormState } from "@/lib/roster/actions";
import { archiveGroupAction } from "@/lib/roster/actions";
import { formatMembers } from "@/lib/roster/schedule";

export function ArchiveForm({
  groupId,
  memberCount,
  destinations,
}: {
  groupId: string;
  memberCount: number;
  /** Live BGroups the members could move to — archived ones cannot take them (#60). */
  destinations: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState<GroupFormState, FormData>(
    archiveGroupAction,
    {},
  );

  return (
    <form action={formAction} className="pt-2">
      <input type="hidden" name="id" value={groupId} />

      {state.error ? (
        <p
          role="alert"
          className="mb-4 rounded-[18px] border border-line bg-card px-4 py-3 text-[14.5px] leading-[1.45] text-ink"
        >
          {state.error}
        </p>
      ) : null}

      {memberCount > 0 ? (
        <>
          <label
            className="block text-[11px] font-bold tracking-[0.13em] text-tan"
            htmlFor="move-members"
          >
            ITS {formatMembers(memberCount).toUpperCase()}
          </label>
          <select
            id="move-members"
            name="moveMembersToGroupId"
            defaultValue=""
            className="mt-[9px] h-[54px] w-full rounded-[18px] border-[1.5px] border-line bg-card px-[13px] text-[15.5px] font-semibold text-ink"
          >
            <option value="">Leave them in this BGroup</option>
            {destinations.map((group) => (
              <option key={group.id} value={group.id}>
                Move to {group.name}
              </option>
            ))}
          </select>
          <p className="mt-[7px] text-[12.5px] leading-[1.45] text-tan">
            Moving changes their home BGroup. Everything they have covered stays with them.
          </p>
        </>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-[22px] flex h-[58px] w-full items-center justify-center rounded-[18px] bg-blue text-[17px] font-bold text-white active:bg-blue-deep disabled:opacity-60"
      >
        {pending ? "Archiving…" : "Archive BGroup"}
      </button>
      <Link
        href={`/people/groups/${groupId}`}
        className="mt-[9px] flex h-[54px] w-full items-center justify-center rounded-[17px] text-[15.5px] font-bold text-slate active:bg-shell"
      >
        Cancel
      </Link>
    </form>
  );
}
