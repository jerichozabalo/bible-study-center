"use client";

/**
 * The Settings QUIET LIST section — `design/Settings.dc.html`'s "Flag someone
 * after" card (#10/#64).
 *
 * The board draws one card with 2 / 3 / 4 buttons and the line "A BGroup can
 * set its own". The threshold is per-group (#10), so this renders one picker
 * per live BGroup — with a single group it reads exactly like the board. Each
 * tap is one small write (`setQuietThresholdAction`); there is nothing to
 * confirm and no way to pick an invalid value, so the buttons submit directly.
 *
 * "HELD meetings in a row", never weeks (#64). "Cancelled nights never count"
 * is the board's own reassurance and it is load-bearing — it is why the quiet
 * list does not fire on the leader's own cancelled month.
 */
import { useActionState } from "react";

import { QUIET_THRESHOLDS } from "@/lib/roster/groups";
import { setQuietThresholdAction } from "@/lib/roster/actions";

type QuietGroup = { id: string; name: string; quietThreshold: number };

export function QuietThresholdSettings({ groups }: { groups: QuietGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="rounded-[20px] border border-line bg-card px-4 py-5 text-[14.5px] leading-[1.5] text-slate">
        Add a BGroup and you can set how many missed meetings put someone on your Needs you list.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[10px]">
      <p className="mx-1 text-[13.5px] leading-[1.45] text-slate">
        Missing this many HELD meetings in a row puts them on your Needs you list. Cancelled nights
        never count.
      </p>
      {groups.map((group) => (
        <GroupPicker key={group.id} group={group} />
      ))}
    </div>
  );
}

function GroupPicker({ group }: { group: QuietGroup }) {
  const [, formAction, pending] = useActionState(
    async (_state: null, formData: FormData) => {
      await setQuietThresholdAction(formData);
      return null;
    },
    null,
  );

  return (
    <form action={formAction} className="rounded-[20px] border border-line bg-card p-[15px]">
      <input type="hidden" name="id" value={group.id} />
      <div className="text-[15.5px] font-bold">{group.name}</div>
      <div className="mt-[3px] text-[13px] text-tan">Flag someone after this many in a row</div>
      <div className="mt-[13px] flex gap-2">
        {QUIET_THRESHOLDS.map((value) => {
          const selected = value === group.quietThreshold;
          return (
            <button
              key={value}
              type="submit"
              name="threshold"
              value={value}
              disabled={pending}
              aria-pressed={selected}
              className={`flex h-[46px] grow items-center justify-center rounded-[14px] border-[1.5px] text-[15px] font-bold disabled:opacity-60 ${
                selected
                  ? "border-blue bg-blue-tint text-blue"
                  : "border-line bg-card text-slate active:bg-shell"
              }`}
            >
              {value}
            </button>
          );
        })}
      </div>
    </form>
  );
}
