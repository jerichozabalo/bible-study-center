/**
 * Home. Empty on purpose: its content — next meeting, the "Needs you" attention
 * list — is issue 8, and building it here would mean building the quiet-list
 * derivation with no meetings and no people to derive it from.
 *
 * What it proves as the tracer is the whole round trip: this page rendered at
 * all means the session cookie verified, the allowlist admitted the address,
 * and the shell around it drew.
 */
import { SignOutButton } from "@/components/SignOutButton";
import { requireUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  const firstName = user.name?.split(" ")[0];

  return (
    <section className="py-6">
      <p className="text-[13px] font-semibold tracking-[0.06em] text-tan">SIGNED IN</p>
      <h1 className="mt-2 text-[27px]">{firstName ? `Hello, ${firstName}` : "Hello"}</h1>
      <p className="mt-2 text-[15px] leading-[1.5] text-slate">
        Your groups, meetings and roster land here. Nothing to show yet — the
        Home screen fills up as you add people and take attendance.
      </p>

      {/* Through `SignOutButton`, not a bare form: it also clears this device's
          lock, which is what makes #19's "a forgotten PIN is recovered by
          signing in with Google again" true from here and not only from
          Settings. */}
      <div className="mt-8">
        <SignOutButton className="flex h-12 items-center rounded-[14px] border-[1.5px] border-line px-5 text-[15px] font-semibold text-slate active:bg-shell" />
      </div>
    </section>
  );
}
