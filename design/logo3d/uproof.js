const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1220, height: 1500 }, deviceScaleFactor: 1.3 });
  await p.goto('file://' + process.cwd() + '/usage.html');
  await p.waitForTimeout(900);
  await p.screenshot({ path: 'out/kit/usage-proof.png', fullPage: true });
  await b.close(); console.log('ok');
})();
