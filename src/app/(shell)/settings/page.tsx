/**
 * Settings — `design/Settings.dc.html`, reached from the gear in the shell
 * header and not from a sixth tab (#62 fixes the tab bar at five).
 *
 * Two of the board's five groups are built here: ACCOUNT and APP LOCK, which is
 * what issue 12 owns. The other three are other issues' rows and are absent
 * rather than faked — a dead switch that does nothing is worse than a screen
 * that plainly has not grown that section yet:
 *   QUIET LIST  — issue 8 (the per-group threshold, #10/#64)
 *   CURRICULUM  — issues 2 and 13 (programs, books, "add your own")
 *   RECORDS     — issue 10 (CSV Export), issue 3 (archived BGroups), issue 6
 *                 (corrections)
 * Each of those adds its own `<Section>` here.
 *
 * The board's first group is headed "ACCOUNT & SYNC" and carries an upload row.
 * "Sync" is a retired word (#66/#72) so the heading is just ACCOUNT, and the
 * row itself belongs to the outbox (issue 11), which is what does the
 * uploading.
 */
import { Emblem } from "@/components/Emblem";
import { LockSettings } from "@/components/LockSettings";
import { SignOutButton } from "@/components/SignOutButton";
import { requireUser } from "@/lib/auth/guard";

/** Reads the session cookie, so it can never be prerendered. */
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();

  return (
    <section className="pb-7">
      <h1 className="mt-[2px] mb-[22px] ml-1 text-[30px]">Settings</h1>

      <Section label="ACCOUNT">
        <div className="overflow-hidden rounded-[20px] border border-line bg-card">
          <div className="flex items-center gap-3 p-[15px]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-blue-tint">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#1D4E89"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>
            <span className="min-w-0 grow">
              <span className="block truncate text-[15.5px] font-bold">{user.email}</span>
              <span className="mt-[2px] block text-[13.5px] text-slate">
                Signed in &middot; records saved to your account
              </span>
            </span>
          </div>

          <div className="ml-[67px] h-px bg-line-soft" />
          <SignOutButton />
        </div>

        <p className="mx-1 mt-[9px] text-[13px] leading-[1.45] text-tan">
          Signing out clears this device, including its PIN. Your records stay in your account.
        </p>
      </Section>

      <Section label="APP LOCK">
        <LockSettings />
      </Section>

      <div className="mx-1 mt-7 flex items-center gap-[10px]">
        <Emblem size={30} />
        <p className="text-[13.5px] leading-[1.4] text-tan">
          Bible Study Tayo
          <br />
          Version 1.0
        </p>
      </div>
    </section>
  );
}

/** An eyebrow label and the card under it — the board's repeating unit. */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-[26px] first:mt-0">
      <h2 className="mb-[10px] ml-1 text-[13px] font-semibold tracking-[0.06em] text-tan">
        {label}
      </h2>
      {children}
    </div>
  );
}
