/* Bible Study Tayo — icon-grade emblem, hand-built from the chosen roundel.
   The illustration cannot shrink; this can. Seven shapes, nothing more:
   ring, two heads (curly / slick — the two men stay distinguishable),
   two shoulder masses, the book, and the pointing hand. */
(function (root) {

  /* head silhouette: an egg whose TOP arc carries the hairstyle.
     curls -> scalloped bumps.  quiff -> one swept peak at the front. */
  function head(cx, cy, rx, ry, { curls = 0, quiff = 0, flip = 1 } = {}) {
    const n = 128, pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const up = Math.sin(a) < 0;                       // SVG y grows downward
      let bump = 0;
      if (up && curls) bump = curls * Math.abs(Math.sin(a * 3.0));
      if (up && quiff) bump = quiff * Math.max(0, Math.cos(a * flip + 0.85));
      const chin = Math.sin(a) > 0 ? 1 - 0.20 * Math.sin(a) : 1;  // narrow the jaw
      pts.push([cx + Math.cos(a) * (rx + bump) * chin, cy + Math.sin(a) * (ry + bump)]);
    }
    return `<path d="M${pts.map(p => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join('L')}z"/>`;
  }

  /* asymmetric shoulder mass, leaning toward the book */
  const shoulder = (cx, base, w, h, lean) =>
    `<path d="M${(cx - w).toFixed(2)} ${base}`
    + `C${(cx - w).toFixed(2)} ${(base - h * 0.72).toFixed(2)} ${(cx - w * 0.55).toFixed(2)} ${(base - h).toFixed(2)} ${(cx + lean).toFixed(2)} ${(base - h).toFixed(2)}`
    + `C${(cx + w * 0.62).toFixed(2)} ${(base - h).toFixed(2)} ${(cx + w).toFixed(2)} ${(base - h * 0.55).toFixed(2)} ${(cx + w).toFixed(2)} ${base}z"/>`;

  const BOOK = 'M6.25 66.67h35.417c4.583 0 8.333 3.75 8.333 8.333 0-4.583 3.75-8.333 8.333-8.333'
             + 'h35.417v20.833H58.333c-4.583 0-8.333 3.75-8.333 8.333 0-4.583-3.75-8.333-8.333-8.333H6.25z';

  const halo = (inner, c, w) =>
    `<g fill="${c}" stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round">${inner}</g>`;

  /* the pointing hand — one tapered wedge, dropped at icon size */
  const finger = '<path d="M40.5 54.2c2.6.4 5 1.8 7.2 4.2l-2.4 2.2c-2-2.2-4-3.4-6.2-3.8z"/>';

  const L = { cx: 39.0, cy: 33.0, rx: 10.0, ry: 11.5 };
  const R = { cx: 62.0, cy: 35.0, rx: 9.3,  ry: 10.8 };

  /* keyline + finger for medium sizes; bare for the icon */
  function build(ink, paper, { keyline = false, hand = false } = {}) {
    return `
      <circle cx="50" cy="50" r="47.5" fill="${ink}"/>
      <circle cx="50" cy="50" r="40" fill="${paper}"/>
      ${keyline ? `<circle cx="50" cy="50" r="36.4" fill="none" stroke="${ink}" stroke-width="1.5"/>` : ''}

      <g fill="${ink}">${head(L.cx, L.cy, L.rx, L.ry, { curls: 1.10 })}
        ${shoulder(37.5, 64, 18.0, 21.0, 2.5)}</g>

      ${halo(head(R.cx, R.cy, R.rx, R.ry, { quiff: 1.8, flip: -1 })
           + shoulder(63.5, 64, 17.0, 19.0, -2.3), paper, 4.4)}
      <g fill="${ink}">${head(R.cx, R.cy, R.rx, R.ry, { quiff: 1.8, flip: -1 })}
        ${shoulder(63.5, 64, 17.0, 19.0, -2.3)}</g>

      ${hand ? `<g fill="${ink}">${finger}</g>` : ''}

      ${halo(`<path d="${BOOK}" transform="translate(20 22) scale(0.60)"/>`, paper, 4.4)}
      <path d="${BOOK}" transform="translate(20 22) scale(0.60)" fill="${ink}"/>
      <path d="M49.1 64.5h1.8v15h-1.8z" fill="${paper}"/>`;
  }

  function svg(variant, { size = 100, ink = '#14202E', paper = '#F7F4EF', bg = 'none' } = {}) {
    const opts = variant === 'medium' ? { keyline: true, hand: true }
               : variant === 'hand'   ? { keyline: false, hand: true }
               : {};
    const back = bg === 'none' ? '' : `<rect width="100" height="100" fill="${bg}"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${back}${build(ink, paper, opts)}</svg>`;
  }

  root.EMBLEM = { svg, build, head, shoulder };
})(globalThis);
