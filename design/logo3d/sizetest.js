const { chromium } = require('playwright-core');
const fs = require('fs');
require('./emblem.js'); require('./illus.js');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 700 }, deviceScaleFactor: 2 });
  const lk = fs.readFileSync('out/kit/lockup-f.svg','utf8');
  const at = (svg, w) => `<div style="width:${w}px">${svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="100%"`)}</div>`;
  const row = (lab, svg, sizes) => `<div style="margin-bottom:22px"><div style="font:700 11px sans-serif;color:#1D4E89;margin-bottom:8px">${lab}</div>
    <div style="display:flex;gap:26px;align-items:flex-end">${sizes.map(w=>`<div style="text-align:center">${at(svg,w)}<div style="font:10px sans-serif;color:#9AA7B8;margin-top:6px">${w}px</div></div>`).join('')}</div></div>`;
  await p.setContent(`<body style="margin:0;background:#F7F4EF;padding:22px">
    ${row('lockup horizontal', lk, [420,300,220,180,140])}
    ${row('illustration alone', ILLUS.svg('r5',{size:400}), [200,150,120,90])}
    ${row('emblem mark', EMBLEM.svg('hand',{size:200}), [64,48,32,24])}
  </body>`);
  await p.screenshot({ path: 'out/kit/sizetest.png', fullPage: true });
  await b.close(); console.log('ok');
})();
