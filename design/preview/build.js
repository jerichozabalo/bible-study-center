/* Renders any .dc.html artboard to a plain HTML page you can just open.
   The real canvas runtime (support.js) is not in this repo, so a .dc.html opened
   directly shows raw {{...}} placeholders. This is a stand-in for reviewing only.

   usage:  node preview/build.js Calendar '[{"view":"week","day":16},{"view":"month","day":16}]'
*/
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const name = process.argv[2] || 'Calendar';
const states = JSON.parse(process.argv[3] || '[null]');
const dir = __dirname;
const frames = states.map((st, i) => {
  const out = path.join(dir, `.tmp-${i}.html`);
  execFileSync('node', [path.join(dir, 'render-dc.js'), path.join(dir, '..', `${name}.dc.html`),
    st ? JSON.stringify(st) : '', out], { stdio: 'inherit' });
  const html = fs.readFileSync(out, 'utf8');
  fs.unlinkSync(out);
  return {
    head: html.match(/<head>([\s\S]*?)<\/head>/)[1],
    body: html.match(/<body[^>]*>([\s\S]*?)<\/body>/)[1],
    label: st ? Object.entries(st).map(([k, v]) => `${k}: ${v}`).join('  ·  ') : 'default'
  };
});

const page = `<!doctype html><html><head><meta charset="utf-8">
<title>${name} — preview</title>${frames[0].head}
<style>
  body{margin:0;background:#DED8CC;font-family:Figtree,system-ui,sans-serif;padding:26px;
       display:flex;gap:26px;flex-wrap:wrap;align-items:flex-start}
  .fr{display:flex;flex-direction:column;gap:9px}
  .ph{width:390px;height:844px;overflow:hidden;border-radius:26px;background:#F7F4EF;
      box-shadow:0 10px 34px rgba(0,0,0,.18)}
  .cap{font-size:12px;font-weight:700;letter-spacing:.05em;color:#6B6151;text-transform:uppercase}
  .note{width:100%;font-size:12.5px;color:#6B6151;line-height:1.5;max-width:820px}
  code{background:#CFC7B8;padding:1px 5px;border-radius:4px}
</style></head><body>
${frames.map(f => `<div class="fr"><div class="ph">${f.body}</div><div class="cap">${f.label}</div></div>`).join('\n')}
<div class="note">Static preview only — rebuilt with
<code>node preview/build.js ${name}</code>. The interactive version lives in the canvas;
a <code>.dc.html</code> opened directly in a browser shows raw <code>{{…}}</code> because
<code>support.js</code> (the canvas runtime) is not in this repo. This is true of every
artboard here, not just this one.</div>
</body></html>`;

const dest = path.join(dir, `${name}-preview.html`);
fs.writeFileSync(dest, page);
console.log('wrote ' + path.relative(path.join(dir, '..', '..'), dest));
