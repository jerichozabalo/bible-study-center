const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 1500 }, deviceScaleFactor: 1 });
  await p.goto('file://' + process.cwd() + '/logo-final.html');
  for (const [i, name] of [[1,'paper'],[2,'reversed'],[3,'blue']]) {
    await p.locator(`.bar button:nth-child(${i+1})`).click();
    await p.locator('#s1').screenshot({ path: `out/vector/check-${name}.png` });
  }
  await b.close(); console.log('checked');
})();
