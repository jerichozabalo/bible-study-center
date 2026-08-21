const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1240, height: 1080 }, deviceScaleFactor: 1.5 });
  const f = n => fs.readFileSync('out/kit/' + n, 'utf8');
  await p.setContent(`<body style="margin:0;background:#F7F4EF;padding:26px;font:600 12px sans-serif;color:#1D4E89">
    <div style="background:#fff;border-radius:16px;padding:26px;margin-bottom:18px">${f('lockup-f.svg')}<div style="margin-top:10px">horizontal · ink</div></div>
    <div style="background:#14202E;border-radius:16px;padding:26px;margin-bottom:18px">${f('lockup-f-rev.svg')}<div style="margin-top:10px;color:#8FB4E0">horizontal · reversed</div></div>
    <div style="display:flex;gap:18px">
      <div style="background:#fff;border-radius:16px;padding:26px">${f('lockup-f-stacked.svg')}<div style="margin-top:10px">stacked</div></div>
      <div style="background:#fff;border-radius:16px;padding:26px">${f('lockup-f-blue.svg')}<div style="margin-top:10px">brand blue</div></div>
    </div></body>`);
  await p.screenshot({ path: 'out/kit/lockup-proof.png', fullPage: true });
  await b.close(); console.log('proof ok');
})();
