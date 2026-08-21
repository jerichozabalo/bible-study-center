/**
 * Add a person. No artboard draws it — see `components/people/PersonForm.tsx`
 * for where its look comes from.
 */
import { BackRow } from "@/components/BackRow";
import { PersonForm } from "@/components/people/PersonForm";
import { requireUser } from "@/lib/auth/guard";
import { createPersonAction } from "@/lib/roster/actions";
import { personFormDefaults } from "@/lib/roster/form";
import { listGroups } from "@/lib/roster/groups";

export const dynamic = "force-dynamic";

export default async function NewPersonPage() {
  const user = await requireUser();
  // Live BGroups only: an archived one cannot take a member (#60/#27).
  const groups = await listGroups(user.email);

  return (
    <section>
      <BackRow href="/people" title="Add a person" />
      <PersonForm
        action={createPersonAction}
        groups={groups.map((group) => ({ id: group.id, name: group.name }))}
        values={personFormDefaults()}
        submitLabel="Add to roster"
      />
    </section>
  );
}
