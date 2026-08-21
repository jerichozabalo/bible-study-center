const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const TAKES = (process.argv[2] ? process.argv[2].split(",").map(Number) : [1,2,3,4,5,6]);
const SIZE = 1024;
const OUT = path.join(__dirname, 'out');

function findChromium() {
  const root = path.join(process.env.HOME, '.cache', 'ms-playwright');
  const dirs = fs.readdirSync(root)
    .filter(d => /^chromium-\d+$/.test(d))
    .sort((a, b) => parseInt(b.split('-')[1]) - parseInt(a.split('-')[1]));
  for (const d of dirs) {
    const p = path.join(root, d, 'chrome-linux64', 'chrome');
    if (fs.existsSync(p)) return p;
  }
  throw new Error('no cached chromium found');
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: findChromium(),
    args: [
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist', '--enable-webgl', '--no-sandbox'
    ]
  });
  const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error') console.log('  console:', m.text()); });
  page.on('pageerror', e => console.log('  pageerror:', e.message));

  for (const t of TAKES) {
    const url = `http://127.0.0.1:8931/scene.html?take=${t}&size=${SIZE}`;
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction('window.__done === true', null, { timeout: 60000 });
    const err = await page.evaluate('window.__error || null');
    if (err) { console.log(`take ${t}: ERROR\n${err}`); continue; }
    const canvas = page.locator('canvas');
    await canvas.screenshot({ path: path.join(OUT, `take-${t}.png`), omitBackground: true });
    console.log(`take ${t}: ok`);
  }
  await browser.close();
})();
