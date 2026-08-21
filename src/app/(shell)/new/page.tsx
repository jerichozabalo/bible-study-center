/**
 * The [+] tab — `design/NewMeeting.dc.html`. The form itself is
 * `components/meetings/NewMeetingForm.tsx`; this page is what it is over: the
 * groups it can offer (#63) with their pre-filled agendas (#53), and today's
 * date read in Manila rather than off the phone (#56).
 */
import Link from "next/link";

import { NewMeetingForm } from "@/components/meetings/NewMeetingForm";
import { requireUser } from "@/lib/auth/guard";
import { addDays, todayInManila } from "@/lib/dates";
import { createMeetingAction } from "@/lib/meetings/actions";
import { listPickerGroups } from "@/lib/meetings/prefill";

/** Reads the session cookie and the roster — never prerendered. */
export const dynamic = "force-dynamic";

export default async function NewMeetingPage() {
  const user = await requireUser();
  const groups = await listPickerGroups(user.email);
  const today = todayInManila();

  return (
    <section>
      <h2 className="pt-1 pb-[10px] text-[19px]">New meeting</h2>
      {groups.length === 0 ? (
        <NoGroups />
      ) : (
        <NewMeetingForm
          action={createMeetingAction}
          groups={groups}
          today={today}
          yesterday={addDays(today, -1)}
        />
      )}
    </section>
  );
}

/**
 * A meeting belongs to a BGroup, so with none there is nothing to create. The
 * empty state sends the leader where the app can actually be started, in the
 * same words the Groups screen uses.
 */
function NoGroups() {
  return (
    <div className="mt-[14px] rounded-[22px] border-[1.5px] border-line bg-card px-5 py-8 text-center">
      <h3 className="text-[19px]">No BGroups yet</h3>
      <p className="mx-auto mt-2 max-w-[280px] text-[14.5px] leading-[1.5] text-slate">
        A meeting is a night one of your BGroups meets, so there has to be a BGroup first.
      </p>
      <Link
        href="/people/groups/new"
        className="mt-5 flex h-[54px] w-full items-center justify-center rounded-[17px] bg-blue text-[16px] font-bold text-white active:bg-blue-deep"
      >
        New BGroup
      </Link>
    </div>
  );
}
