/**
 * Edit a meeting's date, time, duration and notes (#75, 2026-09-17).
 *
 * Its own screen, the same idiom `people/groups/[id]/archive` and
 * `books/[id]/retire` use for a deliberate act: this one is not destructive,
 * but it is the first place a meeting's own facts can be corrected at all, so
 * it gets a full screen rather than an inline sheet on the attendance page.
 */
import { notFound } from "next/navigation";

import { BackRow } from "@/components/BackRow";
import { MeetingEditForm } from "@/components/meetings/MeetingEditForm";
import { updateMeetingAction } from "@/lib/meetings/actions";
import { getMeeting } from "@/lib/meetings/meetings";
import { requireUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function EditMeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const meeting = await getMeeting(user.email, id);

  if (!meeting) notFound();

  return (
    <section>
      <BackRow href={`/meetings/${meeting.id}`} />

      <h2 className="text-[25px]">Edit {meeting.groupName}’s meeting</h2>
      <p className="mt-2 text-[15px] leading-[1.5] text-slate">
        Book and session live on the COVERING panel’s Change pill. This is just when it was, how
        long, and any notes.
      </p>

      <div className="mt-4">
        <MeetingEditForm
          action={updateMeetingAction}
          meetingId={meeting.id}
          groupName={meeting.groupName}
          values={{
            date: meeting.date,
            startTime: meeting.startTime,
            durationMinutes: meeting.durationMinutes,
            notes: meeting.notes,
          }}
        />
      </div>
    </section>
  );
}
