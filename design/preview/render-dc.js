/* minimal stand-in for the canvas runtime: enough to render an artboard for review */
const fs = require('fs');
const path = process.argv[2];
const overrideState = process.argv[3] ? JSON.parse(process.argv[3]) : null;
const src = fs.readFileSync(path, 'utf8');

const body = src.match(/<x-dc>([\s\S]*?)<\/x-dc>/)[1];
const helmet = body.match(/<helmet>([\s\S]*?)<\/helmet>/)[1];
const tpl = body.replace(/<helmet>[\s\S]*?<\/helmet>/, '');
const script = src.match(/<script data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];

/* artboards may declare editable props via data-props; use their defaults */
const propsAttr = src.match(/data-props='([\s\S]*?)'/);
let props = {};
if (propsAttr) {
  try {
    const spec = JSON.parse(propsAttr[1]);
    for (const [k, v] of Object.entries(spec)) {
      if (k === '$preview') continue;
      if (v && typeof v === 'object' && 'default' in v) props[k] = v.default;
    }
  } catch (e) { /* malformed spec: fall back to no props */ }
}
if (process.env.DC_PROPS) Object.assign(props, JSON.parse(process.env.DC_PROPS));

class DCLogic {
  constructor(p) { this.state = {}; this.props = p || {}; }
  setState(o) { Object.assign(this.state, o); }
}
const Component = new Function('DCLogic', script + '; return Component;')(DCLogic);
const inst = new Component(props);
if (!inst.props) inst.props = props;
if (overrideState) Object.assign(inst.state, overrideState);
const vals = inst.renderVals();

const get = (expr, scope) => {
  const parts = expr.split('.');
  let v = Object.prototype.hasOwnProperty.call(scope, parts[0]) ? scope[parts[0]] : vals[parts[0]];
  for (let i = 1; i < parts.length && v != null; i++) v = v[parts[i]];
  return v;
};

/* find matching close for a tag starting at index i */
function matchTag(s, i, tag) {
  const openRe = new RegExp('<' + tag + '\\b', 'g');
  const closeRe = new RegExp('</' + tag + '>', 'g');
  let depth = 0, p = i;
  while (p < s.length) {
    openRe.lastIndex = p; closeRe.lastIndex = p;
    const o = openRe.exec(s), c = closeRe.exec(s);
    if (!c) throw new Error('unclosed ' + tag);
    if (o && o.index < c.index) { depth++; p = o.index + 1; }
    else { depth--; p = c.index + 1; if (depth === 0) return { end: c.index, after: c.index + tag.length + 3 }; }
  }
  throw new Error('unclosed ' + tag);
}

function render(s, scope) {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const nf = s.indexOf('<sc-for', i), ni = s.indexOf('<sc-if', i);
    const next = (nf === -1) ? ni : (ni === -1 ? nf : Math.min(nf, ni));
    if (next === -1) { out += interp(s.slice(i), scope); break; }
    out += interp(s.slice(i, next), scope);
    const isFor = s.startsWith('<sc-for', next);
    const tag = isFor ? 'sc-for' : 'sc-if';
    const openEnd = s.indexOf('>', next) + 1;
    const attrs = s.slice(next, openEnd);
    const { end, after } = matchTag(s, next, tag);
    const inner = s.slice(openEnd, end);
    if (isFor) {
      const list = get(attrs.match(/list="\{\{(.*?)\}\}"/)[1], scope) || [];
      const as = attrs.match(/as="(.*?)"/)[1];
      for (const item of list) out += render(inner, { ...scope, [as]: item });
    } else {
      const cond = get(attrs.match(/value="\{\{(.*?)\}\}"/)[1], scope);
      if (cond) out += render(inner, scope);
    }
    i = after;
  }
  return out;
}
const interp = (s, scope) => s
  .replace(/\s*onClick="\{\{.*?\}\}"/g, '')
  .replace(/\{\{(.*?)\}\}/g, (_, e) => { const v = get(e.trim(), scope); return v == null ? '' : String(v); });

fs.writeFileSync(process.argv[4] || '/tmp/dc-out.html',
  '<!doctype html><html><head><meta charset="utf-8">' + helmet + '</head><body style="margin:0;background:#DED8CC;padding:20px;display:flex;gap:20px">'
  + render(tpl, {}) + '</body></html>');
console.log('rendered');
