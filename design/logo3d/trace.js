const potrace = require('potrace');
const fs = require('fs');

/* three levels of the same drawing: full detail -> icon-grade
   turdSize drops specks; alphaMax/optTolerance smooth the curves */
const LEVELS = [
  { name: 'full',   turdSize: 2,   alphaMax: 1.0, optTolerance: 0.2, threshold: 128 },
  { name: 'simple', turdSize: 60,  alphaMax: 1.2, optTolerance: 0.6, threshold: 128 },
  { name: 'icon',   turdSize: 320, alphaMax: 1.34, optTolerance: 1.2, threshold: 140 }
];

(async () => {
  for (const L of LEVELS) {
    await new Promise((res, rej) => {
      const t = new potrace.Potrace({
        turdSize: L.turdSize, alphaMax: L.alphaMax, optTolerance: L.optTolerance,
        threshold: L.threshold, blackOnWhite: true, color: '#14202E', background: 'transparent'
      });
      t.loadImage('out/vector/roundel-src.png', err => {
        if (err) return rej(err);
        const svg = t.getSVG();
        fs.writeFileSync(`out/vector/roundel-${L.name}.svg`, svg);
        const paths = (svg.match(/<path/g) || []).length;
        console.log(`${L.name.padEnd(7)} ${(svg.length/1024).toFixed(1).padStart(7)} KB  ${paths} path(s)`);
        res();
      });
    });
  }
})();
