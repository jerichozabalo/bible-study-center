const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1240, height: 1500 }, deviceScaleFactor: 1.4 });
  await p.goto('file://' + process.cwd() + '/lockup.html');
  await p.waitForFunction('document.fonts.ready.then(()=>true)');
  await p.waitForTimeout(1200);
  await p.locator('#grid').screenshot({ path: 'out/vector/lockup-proof.png' });
  await b.close(); console.log('ok');
})();
