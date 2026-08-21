/**
 * The People tab, People segment (#62).
 *
 * The roster itself is issue 3; what is here now is the tab's own frame — the
 * title and the People / Groups switch — so that Groups has somewhere to live.
 */
import { ComingSoon } from "@/components/ComingSoon";
import { PEOPLE_SEGMENTS, SegmentedControl } from "@/components/SegmentedControl";

export default function PeoplePage() {
  return (
    <section>
      <h2 className="text-[26px]">People</h2>
      <SegmentedControl segments={PEOPLE_SEGMENTS} current="/people" />
      <ComingSoon title="The roster" issue="issue 3" />
    </section>
  );
}
