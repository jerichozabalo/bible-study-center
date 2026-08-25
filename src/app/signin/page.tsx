/**
 * The front door — `design/SignIn.dc.html`, the `signin` state of that board.
 * (Its other state is the PIN pad, which is issue 12 and deliberately not here.)
 *
 * Sign-in is required (#71): there is no anonymous path past this screen, and
 * no "try it first". The records live in the account, which is what the line
 * under the button says in the leader's own words.
 */
import { redirect } from "next/navigation";

import { signInWithGoogleAction } from "@/app/auth/google/actions";
import { Emblem } from "@/components/Emblem";
import { currentUser } from "@/lib/auth/guard";
import { sameOriginPath } from "@/lib/safe-path";

/** Reads the session cookie, so it can never be prerendered. */
export const dynamic = "force-dynamic";

/**
 * What went wrong, said the way Jericho would say it to someone standing next
 * to him. No error codes, no "authentication failure" — and `not-allowed`
 * especially, because the person reading it is either him on the wrong Google
 * account or someone who has no business here, and both are served by one
 * plain sentence.
 */
const REASONS: Record<string, string> = {
  "not-allowed": "That account is not the one this app belongs to. Sign in with your own Google account.",
  cancelled: "Sign-in was cancelled. Nothing was changed.",
  expired: "That sign-in took too long. Please try again.",
  failed: "Google could not sign you in just now. Please try again.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  // Already signed in and no complaint to show: there is nothing on this screen
  // for them.
  if (!error && (await currentUser())) redirect("/");

  const message = error ? REASONS[error] : undefined;
  const destination = sameOriginPath(next, "/");

  return (
    /* The boards are drawn at a 390px phone frame and the app is phone-first,
       but a browser window is whatever width it is — unbounded, the Google
       button stretched to 1388px on a laptop. Capping and centring keeps the
       artboard's proportions wherever it is opened. */
    <main className="mx-auto flex min-h-screen min-h-dvh w-full max-w-[420px] flex-col justify-between px-[26px] pt-16 pb-[30px]">
      <div>
        <Emblem size={64} />
        <h1 className="mt-[26px] text-[38px] leading-[1.05]">
          Bible Study
          <br />
          Tayo
        </h1>
        <p className="mt-[14px] max-w-[290px] text-[16.5px] leading-[1.5] text-slate">
          Every attendee, every session. Attendance works even with no signal.
        </p>
      </div>

      <div>
        {message ? (
          <p
            role="alert"
            className="mb-4 rounded-[18px] border border-line bg-card px-4 py-3 text-[14.5px] leading-[1.45] text-ink"
          >
            {message}
          </p>
        ) : null}

        <form action={signInWithGoogleAction}>
          <input type="hidden" name="next" value={destination} />
          <button
            type="submit"
            className="flex h-[60px] w-full items-center justify-center gap-[11px] rounded-[18px] border-[1.5px] border-line bg-card text-[16.5px] font-bold text-ink active:bg-shell"
          >
            <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3C3.7 21.4 7.6 24 12 24z"
              />
              <path fill="#FBBC05" d="M5.6 14.7a7.2 7.2 0 0 1 0-4.6v-3H1.8a12 12 0 0 0 0 10.6z" />
              <path
                fill="#EA4335"
                d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3C17.7 1.2 15.1 0 12 0 7.6 0 3.7 2.6 1.8 6.1l3.8 3a7.1 7.1 0 0 1 6.4-4.3z"
              />
            </svg>
            Continue with Google
          </button>
        </form>

        <p className="mt-4 text-center text-[14px] leading-[1.5] text-tan">
          Your records live in your account.
          <br />
          Attendance still works with no signal &mdash; it uploads when you are back.
        </p>
      </div>
    </main>
  );
}
