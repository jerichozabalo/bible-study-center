const { chromium } = require('playwright-core');
const fs = require('fs');
require('./retro.js');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 });
  const cards = [1,2,3,4,5,6].map(n => `
    <div style="background:#fff;border:1px solid #E6DFD4;border-radius:16px;padding:14px;text-align:center">
      <div style="background:#F7F4EF;border-radius:10px;padding:8px">${RETRO.svg(n,{size:200})}</div>
      <div style="display:flex;gap:12px;align-items:flex-end;justify-content:center;margin-top:10px">
        ${[48,28,20,16].map(s=>RETRO.svg(n,{size:s})).join('')}
      </div>
      <div style="font:700 12px sans-serif;color:#1D4E89;margin-top:8px">take ${n}</div>
    </div>`).join('');
  await p.setContent(`<body style="margin:0;background:#F7F4EF;padding:20px">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">${cards}</div></body>`);
  await p.screenshot({ path: 'out/retro-proof.png', fullPage: true });
  await b.close();
})();
