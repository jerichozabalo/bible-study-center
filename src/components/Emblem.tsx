/**
 * The Bible Study Tayo mark — the settled one, from the logo kit.
 *
 * This used to draw an open-book glyph copied out of the artboards. That glyph
 * is not the logo: the boards were drawn before the mark was settled, and they
 * put a Lucide book inside a blue squircle as a placeholder. So the installed
 * PWA showed the real roundel on the home screen and something else entirely
 * once you opened it (caught by eye, 2026-08-21 — the same way the People tab's
 * headless figure was). Boards govern visual idiom; they do not get to override
 * the logo kit on what the logo *is*.
 *
 * `design/logo3d/usage.html` sets the sizes, measured rather than guessed, and
 * its rule is: under a threshold, step DOWN a version — never shrink one past
 * its floor. Two versions matter at app sizes:
 *
 *   emblem-mark   ≥ 32px   "App header, favicon"
 *   emblem-icon   ≥ 16px   "Browser tab, home screen"
 *
 * `pickVersion` enforces that, so a caller asking for 20px gets the icon rather
 * than a mark turned to mud. Below 16px there is nothing left to step down to,
 * and the component says so rather than rendering something illegible.
 *
 * The SVGs are copied into `public/logo/`, never hand-edited — the kit's own
 * rule. They are rebuilt by `design/logo3d/emblem.js`; re-copy after a rebuild.
 */

/** Sand-ground surfaces take the blue mark; a blue ground takes the reversed one. */
export type EmblemTone = "blue" | "reversed";

const MARK_FLOOR = 32;
const ICON_FLOOR = 16;

function pickVersion(size: number): "mark" | "icon" {
  return size >= MARK_FLOOR ? "mark" : "icon";
}

export function Emblem({ size = 64, tone = "blue" }: { size?: number; tone?: EmblemTone }) {
  if (size < ICON_FLOOR) {
    throw new Error(
      `Emblem: ${size}px is below the icon version's 16px floor (design/logo3d/usage.html). ` +
        "There is no smaller version to step down to.",
    );
  }

  const version = pickVersion(size);
  const suffix = tone === "reversed" ? "rev" : "blue";

  return (
    // A plain <img>, not next/image: the file is a 6 KB SVG served from this
    // origin, so there is nothing to optimise, and next/image would only add a
    // layout wrapper around something already square and fixed-size.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/logo/emblem-${version}-${suffix}.svg`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className="shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
