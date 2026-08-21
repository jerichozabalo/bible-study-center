const { chromium } = require('playwright-core');
require('./emblem.js');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1160, height: 560 }, deviceScaleFactor: 2 });
  const card = (v, lab) => `<div style="background:#fff;border:1px solid #E6DFD4;border-radius:16px;padding:16px;text-align:center">
      <div style="background:#F7F4EF;border-radius:10px;padding:10px">${EMBLEM.svg(v,{size:220})}</div>
      <div style="display:flex;gap:16px;align-items:center;justify-content:center;margin-top:12px">
        ${[64,32,24,16].map(s=>EMBLEM.svg(v,{size:s})).join('')}</div>
      <div style="font:700 12px sans-serif;color:#1D4E89;margin-top:10px">${lab}</div></div>`;
  await p.setContent(`<body style="margin:0;background:#F7F4EF;padding:18px">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
      ${card('icon','icon — bare')}${card('hand','+ pointing hand')}${card('medium','+ keyline + hand')}
    </div></body>`);
  await p.screenshot({ path: 'out/vector/eproof.png', fullPage: true });
  await b.close();
})();
