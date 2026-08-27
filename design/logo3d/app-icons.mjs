/**
 * Regenerate the app's favicon + PWA icons from the settled roundel
 * illustration (`out/vector/roundel-full.svg`), not the hand-built blob mark.
 *
 * Jericho picked `roundel-full` for the app on 2026-08-27 — the detailed
 * retro-ink two-men-and-a-Bible drawing. The kit's earlier `icon-*.png` used
 * the simplified `emblem-mark`, which reads as a generic "users" glyph at any
 * size. This trades the documented ≥120px floor for the L1 illustration
 * against a mark that actually says what the app is; the deviation is recorded
 * in CLAUDE.md and memory.
 *
 * Run: node design/logo3d/app-icons.mjs   (from the repo root)
 */
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

const SRC = "design/logo3d/out/vector/roundel-full.svg";
const INK = "#14202E";
const BLUE = "#1D4E89";
const SAND = "#F7F4EF";

const raw = readFileSync(SRC, "utf8");

// Colour variants for use inside the app (served from /public/logo/).
writeFileSync("public/logo/roundel.svg", raw);
writeFileSync("public/logo/roundel-blue.svg", raw.replaceAll(INK, BLUE));
writeFileSync("public/logo/roundel-rev.svg", raw.replaceAll(INK, SAND));
console.log("wrote public/logo/roundel{,-blue,-rev}.svg");

/** Render the roundel centred on a sand tile, inset by `pad` fraction each side. */
async function tile(outPath, size, pad) {
  const inner = Math.round(size * (1 - pad * 2));
  const art = await sharp(Buffer.from(raw), { density: 384 })
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: SAND,
    },
  })
    .composite([{ input: art, gravity: "center" }])
    .png()
    .toFile(outPath);
  console.log("wrote", outPath);
}

// "any" icons — ring sits near the tile edge (the ring already has its own
// visual breathing room baked into the artwork).
await tile("public/icons/icon-32.png", 32, 0.04);
await tile("public/icons/icon-192.png", 192, 0.06);
await tile("public/icons/icon-512.png", 512, 0.06);

// maskable — Android crops to a circle/squircle with an ~80% safe zone, so the
// whole roundel has to sit inside the centre. Bleed the sand to the edge.
await tile("public/icons/maskable-192.png", 192, 0.18);
await tile("public/icons/maskable-512.png", 512, 0.18);
