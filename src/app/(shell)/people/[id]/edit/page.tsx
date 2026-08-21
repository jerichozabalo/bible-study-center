/**
 * Editing a person — the same form as adding one, and every save tombstones
 * what it replaced (#24).
 */
import { notFound } from "next/navigation";

import { BackRow } from "@/components/BackRow";
import { PersonForm } from "@/components/people/PersonForm";
import { requireUser } from "@/lib/auth/guard";
import { updatePersonAction } from "@/lib/roster/actions";
import { listGroups } from "@/lib/roster/groups";
import { getPerson } from "@/lib/roster/people";

export const dynamic = "force-dynamic";

export default async function EditPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const [person, groups] = await Promise.all([getPerson(user.email, id), listGroups(user.email)]);

  if (!person) notFound();

  // Their own BGroup may have been archived under them with #27's move
  // declined. The picker keeps offering it, because the alternative is a form
  // that silently moves them out of it on the next save.
  const options = groups.map((group) => ({ id: group.id, name: group.name }));
  if (person.homeGroupId !== null && !options.some((group) => group.id === person.homeGroupId)) {
    options.unshift({
      id: person.homeGroupId,
      name: `${person.homeGroupName} (archived)`,
    });
  }

  return (
    <section>
      <BackRow href={`/people/${person.id}`} title="Edit person" />
      <PersonForm
        action={updatePersonAction}
        personId={person.id}
        groups={options}
        values={{
          name: person.name,
          phone: person.phone ?? "",
          email: person.email ?? "",
          homeGroupId: person.homeGroupId ?? "",
          joinedOn: person.joinedOn,
          birthday: person.birthday ?? "",
          address: person.address ?? "",
          civilStatus: person.civilStatus ?? "",
          spiritualStatus: person.spiritualStatus ?? "",
          baptized: person.baptized,
          baptizedOn: person.baptizedOn ?? "",
          invitedBy: person.invitedBy ?? "",
          notes: person.notes ?? "",
        }}
        submitLabel="Save changes"
      />
    </section>
  );
}
