/**
 * Build the home-screen icons from the logo kit. `npm run build:icons`.
 *
 * Two shapes, because Android asks for two different things and gives them the
 * same name:
 *
 *   `any`      — the icon as drawn, transparent corners and all. What a browser
 *                tab and a desktop install use.
 *   `maskable` — an opaque square the launcher is free to crop to whatever
 *                shape the phone's theme uses: a circle, a squircle, a
 *                rounded rect. Only the middle 80% is guaranteed to survive.
 *
 * The kit's roundel fills its canvas to r=47.5 of 50, which is outside that
 * safe zone — masked to a circle, the outer ring is shaved off and the mark
 * reads as a wobbly disc. So the maskable variant scales the whole roundel to
 * 78% and centres it on the ink square. Nothing is redrawn; the kit's art is
 * the source, which is the rule in `design/logo3d/usage.html`.
 *
 * The output is committed, so this script only needs running when the kit
 * changes.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const KIT = path.join(process.cwd(), "design/logo3d/out/kit");
const OUT = path.join(process.cwd(), "public/icons");

/** The ink from the kit's own roundel — the square the launcher crops. */
const INK = { r: 0x14, g: 0x20, b: 0x2e, alpha: 1 };

/** Maskable safe zone is the middle 80%; 78% leaves a hair of margin. */
const SAFE = 0.78;

async function maskable(size: number): Promise<Buffer> {
  const source = await readFile(path.join(KIT, "emblem-icon.svg"));
  const inner = Math.round(size * SAFE);

  // Render the roundel alone (the non-reversed file is the mark on a
  // transparent ground once its own backing circle is what we keep), then sit
  // it in the middle of an ink square.
  const mark = await sharp(source, { density: 384 })
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const offset = Math.round((size - inner) / 2);

  return sharp({
    create: { width: size, height: size, channels: 4, background: INK },
  })
    .composite([{ input: mark, top: offset, left: offset }])
    .png()
    .toBuffer();
}

async function any(size: number): Promise<Buffer> {
  const source = await readFile(path.join(KIT, "emblem-icon.svg"));
  return sharp(source, { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

await mkdir(OUT, { recursive: true });

for (const size of [32, 192, 512]) {
  await writeFile(path.join(OUT, `icon-${size}.png`), await any(size));
}
for (const size of [192, 512]) {
  await writeFile(path.join(OUT, `maskable-${size}.png`), await maskable(size));
}

console.log("wrote icon-{32,192,512}.png and maskable-{192,512}.png to public/icons");
