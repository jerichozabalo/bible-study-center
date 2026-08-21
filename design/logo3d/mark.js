/* Bible Study Tayo — parametric mark generator (classic script, file:// safe).
   viewBox 0 0 48 48. The book is constant; the two readers are not. */
(function (root) {
  const BASE = 29;      // both readers stand on this line
  const CX   = 24;      // mark centre

  /* one reader: hemispherical shoulders + a head, scaled as a unit */
  function reader(cx, s) {
    const w = 10 * s, h = 10 * s, r = 6 * s, gap = 1 * s;
    const dome = `<path d="M${(cx - w).toFixed(2)} ${BASE} a ${w.toFixed(2)} ${h.toFixed(2)} 0 0 1 ${(2 * w).toFixed(2)} 0 z"/>`;
    const cy = BASE - h - gap - r;
    const head = `<circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r.toFixed(2)}"/>`;
    return head + dome;
  }

  /* the open book — identical in every variant, on purpose */
  const BOOK = `<path d="M3 32h17c2.2 0 4 1.8 4 4 0-2.2 1.8-4 4-4h17v10H28c-2.2 0-4 1.8-4 4 0-2.2-1.8-4-4-4H3z"/>`;

  /* leader on the left at scale sL, member on the right at sM */
  function readers(sL, sM) {
    const wL = 10 * sL, wM = 10 * sM;
    const overlap = 2 * Math.min(sL, sM);          // the notch where they meet
    const total = 2 * wL + 2 * wM - overlap;
    const x0 = CX - total / 2;
    return {
      leader: reader(x0 + wL, sL),
      member: reader(x0 + 2 * wL - overlap + wM, sM)
    };
  }

  function parts(sL, sM) {
    const r = readers(sL, sM);
    return { leader: r.leader, member: r.member, book: BOOK };
  }

  function mark(sL, sM) {
    const p = parts(sL, sM);
    return p.leader + p.member + p.book;
  }

  function svg(sL, sM, { size = 48, fill = '#1D4E89' } = {}) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48" fill="${fill}">${mark(sL, sM)}</svg>`;
  }

  root.MARK = { reader, readers, parts, mark, svg, BOOK, BASE, CX };
})(globalThis);
