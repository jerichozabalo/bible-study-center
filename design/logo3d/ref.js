const { chromium } = require('playwright-core');
require('./retro.js');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', args: ['--no-sandbox'] });
  for (const n of [1, 3]) {
    const p = await b.newPage({ viewport: { width: 1024, height: 1024 }, deviceScaleFactor: 1 });
    await p.setContent(`<body style="margin:0;background:#fff;display:flex;align-items:center;justify-content:center;height:100vh">
      ${RETRO.svg(n, { size: 820, ink: '#000000', paper: '#FFFFFF' })}</body>`);
    await p.screenshot({ path: `out/retro/ref-take${n}.png` });
    await p.close();
  }
  await b.close();
})();
