/**
 * What a tab shows before its own issue builds it.
 *
 * These are placeholders and say so — a tab that navigates to a blank screen
 * reads as a bug, and Jericho QA'ing the tracer should be able to tell "not
 * built yet" from "broken" without opening the backlog. Each names the issue
 * that fills it, and each one of those issues deletes its own placeholder.
 */
export function ComingSoon({ title, issue }: { title: string; issue: string }) {
  return (
    <section className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <h2 className="text-[22px]">{title}</h2>
      <p className="mt-2 max-w-[260px] text-[14.5px] leading-[1.45] text-slate">
        Not built yet. This screen arrives with {issue}.
      </p>
    </section>
  );
}
