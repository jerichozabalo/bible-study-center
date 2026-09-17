/**
 * "Delete this meeting?" (#75, 2026-09-17) — the confirm, own screen, the same
 * idiom `people/groups/[id]/archive` uses. Unlike archiving a BGroup, this one
 * really does erase — attendance, photos, everything the night left behind —
 * so the copy says exactly that rather than reassuring like the archive
 * screen's "nothing is deleted" line.
 */
import { notFound } from "next/navigation";

import { BackRow } from "@/components/BackRow";
import { DeleteMeetingForm } from "@/components/meetings/DeleteMeetingForm";
import { deleteMeetingAction } from "@/lib/meetings/actions";
import { getMeeting } from "@/lib/meetings/meetings";
import { requireUser } from "@/lib/auth/guard";
import { formatWeekdayDate } from "@/lib/dates";
import { formatTime } from "@/lib/roster/schedule";

export const dynamic = "force-dynamic";

export default async function DeleteMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const meeting = await getMeeting(user.email, id);

  if (!meeting) notFound();

  return (
    <section>
      <BackRow href={`/meetings/${meeting.id}`} />

      <h2 className="text-[25px]">Delete {meeting.groupName}’s meeting?</h2>
      <p className="mt-2 text-[15px] leading-[1.5] text-slate">
        {formatWeekdayDate(meeting.date)} · {formatTime(meeting.startTime)}
        {meeting.status === "held" ? " · held" : ""}. This removes the meeting itself and
        everything recorded against it — attendance, any photos — for good. There is no undo.
      </p>

      <div className="mt-4">
        <DeleteMeetingForm action={deleteMeetingAction} meetingId={meeting.id} />
      </div>
    </section>
  );
}
