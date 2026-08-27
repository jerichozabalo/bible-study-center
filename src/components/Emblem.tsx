/**
 * The Bible Study Tayo mark — the retro-ink roundel: two young men over an open
 * Bible, the one on the left pointing at the page.
 *
 * History worth keeping: this component first drew a Lucide book glyph copied
 * out of the artboards (a placeholder), then the hand-built "emblem-mark" — two
 * simplified figures that, at any size, read as a generic "users" icon. On
 * 2026-08-27 Jericho picked `design/logo3d/out/vector/roundel-full.svg` as the
 * app's face: the detailed drawing, the one people actually recognise as two
 * men studying one book.
 *
 * The trade-off, recorded so nobody "fixes" it later: the logo kit's usage
 * sheet floors this illustration at ~120px, below which the faces thicken. The
 * app uses it smaller than that in the header (32px) and the favicon, because
 * the alternative — the blob mark — says nothing about what the app is. The
 * 192px / 512px home-screen icons, where it reads cleanly, are generated from
 * the same file by `design/logo3d/app-icons.mjs`.
 *
 * `roundel{,-blue,-rev}.svg` in `public/logo/` are colour variants of that one
 * source path (ink / brand blue / sand-reversed). Regenerate them with the
 * script above; never hand-edit.
 */

/** Sand or white grounds take the ink mark; a blue or photo ground takes the reversed one. */
export type EmblemTone = "ink" | "reversed";

export function Emblem({ size = 64, tone = "ink" }: { size?: number; tone?: EmblemTone }) {
  const file = tone === "reversed" ? "roundel-rev" : "roundel";

  return (
    // A plain <img>, not next/image: it is a single-path SVG served from this
    // origin, already square and fixed-size, so next/image would only wrap it.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/logo/${file}.svg`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className="shrink-0"
      style={{ width: size, height: size }}
    />
  );
}
