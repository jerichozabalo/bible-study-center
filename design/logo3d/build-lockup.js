/* Lockup F — "quiet English, loud Tagalog".
   Type is converted to outlines here so the files render without the fonts installed. */
const ot = require('opentype.js');
const fs = require('fs');
require('./illus.js');

const load = f => ot.parse(fs.readFileSync(f).buffer.slice(0));
const anton = load('fonts/Anton.ttf');
const oswald = fs.existsSync('fonts/Oswald-Medium.ttf') && fs.statSync('fonts/Oswald-Medium.ttf').size > 50000
  ? load('fonts/Oswald-Medium.ttf') : load('fonts/Oswald.ttf');

/* lay out glyph by glyph so we can add tracking, which getPath() cannot do */
function textPath(font, text, size, trackingEm = 0) {
  const scale = size / font.unitsPerEm, track = trackingEm * size;
  const full = new ot.Path();
  let x = 0;
  for (const ch of text) {
    const g = font.charToGlyph(ch);
    full.extend(g.getPath(x, 0, size));
    x += g.advanceWidth * scale + track;
  }
  return { d: full.toPathData(2), width: x - track, bb: full.getBoundingBox() };
}

const ART = ILLUS.ART.r5;
const markSVG = (x, y, size) => {
  const s = size / 1536;
  return `<g transform="translate(${r(x)} ${r(y)}) scale(${s.toFixed(6)})"><path d="${ART.d}" fill-rule="evenodd"/></g>`;
};
const r = n => Math.round(n * 100) / 100;

function build({ stacked = false, markSize = 260 } = {}) {
  const s1 = markSize * 0.158, s2 = markSize * 0.467;          // BIBLE STUDY / TAYO
  const t1 = textPath(oswald, 'BIBLE STUDY', s1, 0.16);
  const t2 = textPath(anton, 'TAYO', s2, 0.01);

  const gap = s1 * 0.34;
  const y1 = 0;                                                 // baseline of line 1
  const y2 = y1 + gap + Math.abs(t2.bb.y1);                     // baseline of line 2
  const top = y1 + t1.bb.y1;
  const bottom = y2 + t2.bb.y2;
  const blockH = bottom - top;
  const blockW = Math.max(t1.width, t2.width);

  let W, H, mx, my, tx, ty;
  if (stacked) {
    const vgap = markSize * 0.12;
    W = Math.max(markSize, blockW);
    H = markSize + vgap + blockH;
    mx = (W - markSize) / 2; my = 0;
    tx = (W - blockW) / 2;   ty = markSize + vgap - top;
  } else {
    const hgap = markSize * 0.13;
    W = markSize + hgap + blockW;
    H = markSize;
    mx = 0; my = 0;
    tx = markSize + hgap;
    ty = (markSize - blockH) / 2 - top;
  }

  // centre each line within the block
  const o1 = (blockW - t1.width) / 2, o2 = (blockW - t2.width) / 2;
  const type = `<g transform="translate(${r(tx)} ${r(ty)})">`
    + `<path transform="translate(${r(o1)} ${r(y1)})" d="${t1.d}"/>`
    + `<path transform="translate(${r(o2)} ${r(y2)})" d="${t2.d}"/></g>`;

  return { W: r(W), H: r(H), body: markSVG(mx, my, markSize) + type };
}

function svg(spec, { ink = '#14202E', bg = null } = {}) {
  const back = bg ? `<rect width="${spec.W}" height="${spec.H}" fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${spec.W}" height="${spec.H}" `
       + `viewBox="0 0 ${spec.W} ${spec.H}">${back}<g fill="${ink}">${spec.body}</g></svg>`;
}

const H = build({ stacked: false });
const V = build({ stacked: true });
const out = [
  ['lockup-f.svg',           svg(H, {})],
  ['lockup-f-rev.svg',       svg(H, { ink: '#F7F4EF', bg: '#14202E' })],
  ['lockup-f-blue.svg',      svg(H, { ink: '#1D4E89' })],
  ['lockup-f-stacked.svg',   svg(V, {})],
  ['lockup-f-stacked-rev.svg', svg(V, { ink: '#F7F4EF', bg: '#14202E' })],
  ['lockup-f-stacked-blue.svg', svg(V, { ink: '#1D4E89' })]
];
fs.mkdirSync('out/kit', { recursive: true });
for (const [n, s] of out) fs.writeFileSync('out/kit/' + n, s);
console.log(`horizontal ${H.W}x${H.H}   stacked ${V.W}x${V.H}`);
console.log('oswald:', oswald.tables.fvar ? 'variable, default weight 400' : 'static');
console.log(out.length + ' files written, text outlined (no <text> elements)');
