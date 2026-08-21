const { chromium } = require('playwright-core');
require('./emblem.js');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', args: ['--no-sandbox'] });
  for (const s of [1024, 512, 192, 48, 32, 16]) {
    const p = await b.newPage({ viewport: { width: s, height: s }, deviceScaleFactor: 1 });
    await p.setContent(`<body style="margin:0">${EMBLEM.svg(s <= 48 ? 'icon' : 'hand', { size: s, ink: '#14202E', paper: '#F7F4EF' })}</body>`);
    await p.screenshot({ path: `out/kit/icon-${s}.png`, omitBackground: true });
    await p.close();
  }
  console.log('icon pngs written');
  await b.close();
})();
