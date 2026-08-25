/**
 * What the service worker serves when a navigation cannot reach the server.
 *
 * It says what is true rather than what would be reassuring: this app is
 * server-first (#70), so with no signal there is nothing to show. The one
 * exception is attendance, which queues on the phone and uploads on reconnect
 * (#72) — and "Upload" is the word for that, never "sync" (#66). The outbox
 * itself is issue 11; this screen already tells the truth about it because
 * the leader will meet this screen in a room with no signal, which is exactly
 * the moment they need to know their ticks are safe.
 *
 * Outside the shell on purpose — the shell calls `requireUser()`, and checking
 * a session is a thing you cannot do with no network.
 */
import { Emblem } from "@/components/Emblem";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-screen min-h-dvh w-full max-w-[420px] flex-col items-center justify-center px-8 text-center">
      <Emblem size={54} />
      <h1 className="mt-5 text-[22px]">No signal</h1>
      <p className="mt-2 max-w-[280px] text-[15px] leading-[1.5] text-slate">
        Bible Study Tayo needs a connection to show your groups and meetings.
      </p>
      <p className="mt-4 max-w-[280px] text-[14px] leading-[1.5] text-tan">
        Attendance you have already ticked is safe on this phone. It uploads by
        itself when you are back.
      </p>
    </main>
  );
}
