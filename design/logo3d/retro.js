/* Bible Study Tayo — 1950s inked marks. viewBox 0 0 100 100.
   The idiom: pure 1-bit. Forms are hand-cut, never geometric. White cuts SLASH
   across a form and break its contour — they never float on it like a highlight.
   A figure is drawn once, leaning; the member is the same drawing mirrored. */
(function (root) {

  /* ---- one reader, drawn in a local 40 x 44 box, base centre at (20,44) ---- */
  const HEAD = 'M21.5 3.2c7.1 0 11.9 5.4 11.9 12.4 0 6.3-3.2 11-8.6 12.6'
             + '-1.4.4-4.2.4-5.6 0-5.6-1.7-8.8-6.4-8.6-12.8C10.8 8.4 15.2 3.2 21.5 3.2z';
  const BODY = 'M1.5 44c.3-7 4-12.4 11.1-13.8 2.8-.6 5.6-.8 8.8-.6 8 .4 14.2 4.8 17.1 14.4z';

  /* cuts: pointed wedges. The first two deliberately overrun the contour. */
  const CUTS = [
    'M9.6 21.4c-.7-7.4 3.4-14.2 11.2-16.8-5.2 4.8-7.9 10.7-7.6 17z',          // skull sweep
    'M5.4 44c.5-7 4.4-12.4 11.2-14.2C11.6 33.4 9.2 38.4 8.8 44z',             // shoulder fold
    'M19 27.6c3.7.5 7.3-.2 10.3-2-2.2 3.1-6.6 4.4-10.3 3.7z',                 // jaw sliver
    'M30.2 32.4c3.6 2.5 6 6.2 7.2 10.6l-3.4-.2c-.9-4-2.4-7.2-4.8-9.4z',       // far shoulder
    'M23.4 8.2c4.2 1.2 6.8 4 7.6 8.2-1.8-3.4-4.3-5.7-7.6-6.9z'                // crown nick
  ];

  const fig = (x, y, s, mirror, ink, cuts) => {
    const t = `translate(${x} ${y}) scale(${mirror ? -s : s} ${s}) translate(-20 -44)`;
    return `<g transform="${t}"><g fill="${ink}"><path d="${HEAD}"/><path d="${BODY}"/></g>`
         + (cuts ? `<g fill="${cuts.paper}">${CUTS.slice(0, cuts.n).map(d => `<path d="${d}"/>`).join('')}</g>` : '')
         + `</g>`;
  };
  const figSil = (x, y, s, mirror, c) => {
    const t = `translate(${x} ${y}) scale(${mirror ? -s : s} ${s}) translate(-20 -44)`;
    return `<g transform="${t}" fill="${c}"><path d="${HEAD}"/><path d="${BODY}"/></g>`;
  };

  const BOOK = 'M6.25 66.67h35.417c4.583 0 8.333 3.75 8.333 8.333 0-4.583 3.75-8.333 8.333-8.333'
             + 'h35.417v20.833H58.333c-4.583 0-8.333 3.75-8.333 8.333 0-4.583-3.75-8.333-8.333-8.333H6.25z';

  /* halo = fatten a shape in the background colour so the form in front cuts a channel */
  const halo = (inner, c, w) =>
    `<g fill="${c}" stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round">${inner}</g>`;

  /* tapered nib stroke, pointed at both ends */
  function nib(x0, y0, x1, y1, thick, { n = 16, power = 0.5 } = {}) {
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    const nx = -dy / len, ny = dx / len, a = [], b = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, t = thick * Math.pow(Math.sin(Math.PI * u), power) * 0.5;
      const px = x0 + dx * u, py = y0 + dy * u;
      a.push([px + nx * t, py + ny * t]); b.push([px - nx * t, py - ny * t]);
    }
    b.reverse();
    return `<path d="M${a.concat(b).map(p => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join('L')}z"/>`;
  }

  /* the pair: leader leaning right, member = same drawing mirrored, leaning left */
  const LX = 34, MX = 67, BY = 72, LS = 1.15, MS = 0.83;
  const pair = (ink, paper, nCuts) => `
    ${fig(LX, BY, LS, false, ink, nCuts ? { paper, n: nCuts } : null)}
    ${halo(`<path d="${HEAD}" transform="translate(${MX} ${BY}) scale(${-MS} ${MS}) translate(-20 -44)"/>`
         + `<path d="${BODY}" transform="translate(${MX} ${BY}) scale(${-MS} ${MS}) translate(-20 -44)"/>`, paper, 5)}
    ${fig(MX, BY, MS, true, ink, nCuts ? { paper, n: Math.min(nCuts, 3) } : null)}`;

  const bookInked = (ink, paper, lines) => `
    ${halo(`<path d="${BOOK}"/>`, paper, 5)}<path d="${BOOK}" fill="${ink}"/>
    <g fill="${paper}">${nib(50, 69.5, 50, 93, 2.4)}
      ${lines ? nib(13, 74.5, 36, 74.1, 1.25, { power: 0.35 }) + nib(15, 80, 36, 79.7, 1.05, { power: 0.35 })
              + nib(64, 74.1, 87, 74.5, 1.25, { power: 0.35 }) + nib(64, 79.7, 85, 80, 1.05, { power: 0.35 }) : ''}</g>`;

  const takes = {};

  /* 1 — Inked pair */
  takes[1] = (ink, paper) => pair(ink, paper, 3) + bookInked(ink, paper, false);

  /* 2 — Heavy woodcut: every cut, plus page lines */
  takes[2] = (ink, paper) => pair(ink, paper, 5) + bookInked(ink, paper, true);

  /* 3 — Roundel: knocked out of a solid disc */
  takes[3] = (ink, paper) => `
    <circle cx="50" cy="50" r="49" fill="${ink}"/>
    <circle cx="50" cy="50" r="44" fill="none" stroke="${paper}" stroke-width="2.2"/>
    <g transform="translate(50 53) scale(0.76) translate(-50 -50)">
      ${pair(paper, ink, 3)}${bookInked(paper, ink, false)}
    </g>`;

  /* 4 — Burst: direct-response rays behind the pair */
  takes[4] = (ink, paper) => {
    const rays = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2, wA = (Math.PI * 2 / 20) * 0.40;
      const p = [
        [50 + Math.cos(a - wA) * 24, 48 + Math.sin(a - wA) * 24],
        [50 + Math.cos(a) * 76,      48 + Math.sin(a) * 76],
        [50 + Math.cos(a + wA) * 24, 48 + Math.sin(a + wA) * 24]
      ].map(q => `${q[0].toFixed(2)} ${q[1].toFixed(2)}`);
      rays.push(`<path d="M${p.join('L')}z"/>`);
    }
    return `<g fill="${ink}">${rays.join('')}</g>
      <circle cx="50" cy="48" r="27.5" fill="${paper}"/>
      <g transform="translate(50 49) scale(0.56) translate(-50 -50)">
        ${pair(ink, paper, 3)}${bookInked(ink, paper, false)}
      </g>`;
  };

  /* 5 — Cut from the page: readers knocked out of a page-filling book */
  const BIGBOOK = 'M4 44h40c5 0 6 3 6 6 0-3 1-6 6-6h40v42H56c-5 0-6 3-6 6 0-3-1-6-6-6H4z';
  takes[5] = (ink, paper) => `
    <path d="${BIGBOOK}" fill="${ink}"/>
    ${halo(`<path d="${HEAD}" transform="translate(34 78) scale(0.55) translate(-20 -44)"/>`
         + `<path d="${BODY}" transform="translate(34 78) scale(0.55) translate(-20 -44)"/>`, ink, 4)}
    ${figSil(34, 78, 0.55, false, paper)}
    ${halo(`<path d="${HEAD}" transform="translate(63 78) scale(-0.40 0.40) translate(-20 -44)"/>`
         + `<path d="${BODY}" transform="translate(63 78) scale(-0.40 0.40) translate(-20 -44)"/>`, ink, 4)}
    ${figSil(63, 78, 0.40, true, paper)}
    <g fill="${paper}">${nib(50, 50, 50, 91, 3)}</g>`;

  /* 6 — Ribbon: mark on a 50s banner, built for a wordmark lockup */
  takes[6] = (ink, paper) => `
    <g transform="translate(50 41) scale(0.76) translate(-50 -50)">
      ${pair(ink, paper, 3)}${bookInked(ink, paper, false)}
    </g>
    <path d="M2 78l12 8-12 8V78z" fill="${ink}"/>
    <path d="M98 78l-12 8 12 8V78z" fill="${ink}"/>
    <path d="M10.5 76.5h79v20h-79z" fill="${ink}"/>
    <rect x="14" y="79.8" width="72" height="13.4" fill="none" stroke="${paper}" stroke-width="1.6"/>`;

  function svg(n, { size = 100, ink = '#14202E', paper = '#F7F4EF', bg = 'none' } = {}) {
    const back = bg === 'none' ? '' : `<rect width="100" height="100" fill="${bg}"/>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${back}${takes[n](ink, paper)}</svg>`;
  }

  root.RETRO = { takes, svg, nib, BOOK, HEAD, BODY, CUTS };
})(globalThis);
