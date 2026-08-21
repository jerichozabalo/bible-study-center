/* Renders every artboard on a canvas page into one index you can scroll. */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const page = process.argv[2] || 'screens';
const canvas = JSON.parse(fs.readFileSync(path.join(dir, '..', 'canvas.json'), 'utf8'));
const boards = canvas.artboards.filter(a => a.page === page).sort((a, b) => (a.y - b.y) || (a.x - b.x));

const frames = [], failed = [];
for (const b of boards) {
  const out = path.join(dir, '.tmp.html');
  try {
    execFileSync('node', [path.join(dir, 'render-dc.js'), path.join(dir, '..', b.file), '', out],
      { stdio: ['ignore', 'ignore', 'pipe'] });
    const html = fs.readFileSync(out, 'utf8');
    fs.unlinkSync(out);
    frames.push({
      head: html.match(/<head>([\s\S]*?)<\/head>/)[1],
      body: html.match(/<body[^>]*>([\s\S]*?)<\/body>/)[1],
      title: b.title, file: b.file, w: b.w, h: b.h
    });
  } catch (e) {
    failed.push({ file: b.file, why: String(e.stderr || e.message).split('\n').find(l => l.trim()) || 'render failed' });
  }
}

const pageHtml = `<!doctype html><html><head><meta charset="utf-8">
<title>Bible Study Tayo — ${page}</title>${frames[0] ? frames[0].head : ''}
<style>
  body{margin:0;background:#DED8CC;font-family:Figtree,system-ui,sans-serif;padding:28px}
  h1{font-family:'Bricolage Grotesque',Figtree,sans-serif;font-size:26px;margin:0 0 4px;color:#2A2318}
  .sub{font-size:13.5px;color:#6B6151;margin-bottom:22px;max-width:760px;line-height:1.55}
  .grid{display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start}
  .fr{display:flex;flex-direction:column;gap:8px}
  .ph{overflow:hidden;border-radius:26px;background:#F7F4EF;box-shadow:0 10px 34px rgba(0,0,0,.18)}
  .cap{font-size:12px;font-weight:700;letter-spacing:.04em;color:#4A4235}
  .file{font-size:11px;color:#8A8071;font-family:ui-monospace,monospace}
  .warn{background:#F5E2DC;border:1px solid #D9B4A8;border-radius:12px;padding:12px 15px;
        font-size:12.5px;color:#7A3524;margin-bottom:20px;max-width:760px;line-height:1.5}
  code{background:#CFC7B8;padding:1px 5px;border-radius:4px}
</style></head><body>
<h1>Bible Study Tayo — ${page}</h1>
<div class="sub">Static preview of every artboard on this canvas page. Interactions do not respond
here — tap targets, toggles and tick boxes only work in the canvas. Rebuild with
<code>node preview/build-all.js ${page}</code>.</div>
${failed.length ? `<div class="warn"><b>${failed.length} did not render:</b><br>${failed.map(f => `${f.file} — ${f.why}`).join('<br>')}</div>` : ''}
<div class="grid">
${frames.map(f => `<div class="fr"><div class="ph" style="width:${f.w}px;height:${f.h}px">${f.body}</div>
  <div class="cap">${f.title}</div><div class="file">${f.file}</div></div>`).join('\n')}
</div></body></html>`;

fs.writeFileSync(path.join(dir, `${page}-preview.html`), pageHtml);
console.log(`${frames.length} rendered, ${failed.length} failed → preview/${page}-preview.html`);
failed.forEach(f => console.log('  FAILED ' + f.file + ' — ' + f.why));
