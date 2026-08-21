const { chromium } = require('playwright-core');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: process.env.HOME + '/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1200, height: 620 }, deviceScaleFactor: 2 });
  const svg = n => fs.readFileSync(`out/vector/roundel-${n}.svg`, 'utf8');
  const box = (s, size) => `<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;overflow:hidden">
      <div style="width:${size}px;height:${size}px">${s.replace(/<svg([^>]*)>/, `<svg$1 style="width:100%;height:100%" preserveAspectRatio="xMidYMid meet">`)}</div></div>`;
  const cards = ['r5','r9','r14'].map(n => `
    <div style="background:#fff;border:1px solid #E6DFD4;border-radius:16px;padding:16px;text-align:center">
      <div style="background:#F7F4EF;border-radius:10px;padding:6px;display:flex;justify-content:center">${box(svg(n),240)}</div>
      <div style="display:flex;gap:14px;align-items:center;justify-content:center;margin-top:12px">
        ${[64,32,20,16].map(s=>box(svg(n),s)).join('')}
      </div>
      <div style="font:700 12px sans-serif;color:#1D4E89;margin-top:10px">${n}</div>
    </div>`).join('');
  await p.setContent(`<body style="margin:0;background:#F7F4EF;padding:18px">
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">${cards}</div></body>`);
  await p.screenshot({ path: 'out/vector/vproof2.png', fullPage: true });
  await b.close();
})();
