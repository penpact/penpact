/**
 * Visual field builder, served at `GET /builder?envelope=<id>` on the API
 * origin (cookie session). Renders the envelope's first document with pdf.js,
 * lets the user click to drop signature/text/date/initials/checkbox fields for
 * a chosen signer, and saves them via the cookie-authed dashboard field route.
 * pdf.js is loaded from a CDN; coordinates are converted from canvas pixels to
 * PDF points (origin top-left, matching the sealer).
 */
export function builderPageHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Field builder - Penpact</title>
<style>
:root{--bg:#0b0c10;--panel:#14161d;--line:#262a35;--ink:#e8eaf0;--muted:#9aa3b2;--brand:#5b8cff;--field:#1d2029}
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
header{display:flex;gap:12px;align-items:center;padding:10px 16px;border-bottom:1px solid var(--line);background:var(--panel);position:sticky;top:0;z-index:10;flex-wrap:wrap}
.logo{font-weight:700}.logo span{color:var(--brand)}
select,button{font:inherit;border-radius:8px;border:1px solid var(--line);background:var(--field);color:var(--ink);padding:7px 10px}
button.primary{background:var(--brand);color:#fff;border:0;font-weight:600;cursor:pointer}
button.primary:disabled{opacity:.5}
.muted{color:var(--muted)}
#stage{padding:20px;display:flex;flex-direction:column;align-items:center;gap:16px}
.pageWrap{position:relative;box-shadow:0 0 0 1px var(--line)}
canvas{display:block}
.fieldBox{position:absolute;border:2px solid var(--brand);background:rgba(91,140,255,.18);font-size:11px;color:#fff;cursor:default;border-radius:3px;overflow:hidden}
.fieldBox .lbl{padding:1px 4px;background:var(--brand);white-space:nowrap}
.fieldBox .x{position:absolute;top:-1px;right:-1px;background:#e0556b;color:#fff;border:0;width:16px;height:16px;line-height:14px;font-size:11px;cursor:pointer;border-radius:0 0 0 4px}
#status{font-size:13px}
</style>
</head>
<body>
<header>
  <div class="logo">Pen<span>pact</span> field builder</div>
  <label class="muted">Field <select id="ftype">
    <option value="signature">Signature</option>
    <option value="initials">Initials</option>
    <option value="name">Name</option>
    <option value="date">Date</option>
    <option value="text">Text</option>
    <option value="checkbox">Checkbox</option>
  </select></label>
  <label class="muted">Signer <select id="signer"></select></label>
  <span class="muted">Click on the document to place a field.</span>
  <button class="primary" id="save" style="margin-left:auto">Save fields</button>
  <span id="status" class="muted"></span>
</header>
<div id="stage"><p class="muted">Loading document…</p></div>
<script type="module">
import * as pdfjsLib from 'https://esm.sh/pdfjs-dist@4.7.76/build/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs';

const params = new URLSearchParams(location.search);
const envelopeId = params.get('envelope');
const $ = (id) => document.getElementById(id);
const api = (p, opts) => fetch('/dashboard' + p, Object.assign({ headers: { 'content-type':'application/json' } }, opts));
const SCALE = 1.3;
const fields = []; // {page, type, signerId, x, y, w, h, el}  (x/y/w/h in PDF points)

async function boot(){
  if(!envelopeId){ $('stage').innerHTML = '<p class="muted">Missing ?envelope=&lt;id&gt;</p>'; return; }
  const envRes = await api('/envelopes/' + envelopeId);
  if(!envRes.ok){ $('stage').innerHTML = '<p class="muted">Could not load this envelope. Are you signed in, and is it a draft you own?</p>'; return; }
  const env = await envRes.json();
  $('signer').innerHTML = (env.signers||[]).map(s => '<option value="'+s.id+'">'+escapeHtml(s.name)+'</option>').join('');
  if(env.status !== 'draft'){ $('save').disabled = true; $('status').textContent = 'Envelope is not a draft; fields are read-only.'; }

  const docRes = await api('/envelopes/' + envelopeId + '/document');
  if(!docRes.ok){ $('stage').innerHTML = '<p class="muted">No document uploaded yet.</p>'; return; }
  const buf = await docRes.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  $('stage').innerHTML = '';
  for(let p=1; p<=pdf.numPages; p++){
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: SCALE });
    const wrap = document.createElement('div');
    wrap.className = 'pageWrap';
    wrap.dataset.page = String(p);
    wrap.style.width = viewport.width + 'px';
    wrap.style.height = viewport.height + 'px';
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width; canvas.height = viewport.height;
    wrap.appendChild(canvas);
    $('stage').appendChild(wrap);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    wrap.addEventListener('click', (e) => onPlace(e, wrap, p));
  }
}

function escapeHtml(s){ const d=document.createElement('div'); d.textContent=s==null?'':String(s); return d.innerHTML; }

const DEFAULTS = { signature:[180,48], initials:[80,40], name:[180,28], date:[120,28], text:[180,28], checkbox:[22,22] };

function onPlace(e, wrap, page){
  if($('save').disabled) return;
  const rect = wrap.getBoundingClientRect();
  const px = e.clientX - rect.left, py = e.clientY - rect.top;
  const type = $('ftype').value;
  const signerId = $('signer').value;
  if(!signerId){ $('status').textContent = 'Add a signer to the envelope first.'; return; }
  const [wPx, hPx] = DEFAULTS[type];
  const box = document.createElement('div');
  box.className = 'fieldBox';
  box.style.left = px + 'px'; box.style.top = py + 'px';
  box.style.width = wPx + 'px'; box.style.height = hPx + 'px';
  box.innerHTML = '<span class="lbl">'+type+'</span><button class="x">×</button>';
  wrap.appendChild(box);
  const f = { page, type, signerId, x: px/SCALE, y: py/SCALE, w: wPx/SCALE, h: hPx/SCALE, el: box };
  fields.push(f);
  box.querySelector('.x').addEventListener('click', (ev) => { ev.stopPropagation(); box.remove(); fields.splice(fields.indexOf(f),1); });
}

$('save').addEventListener('click', async () => {
  if(fields.length === 0){ $('status').textContent = 'Place at least one field.'; return; }
  $('save').disabled = true; $('status').textContent = 'Saving…';
  const payload = { fields: fields.map(f => ({ type: f.type, signerId: f.signerId, page: f.page, x: Math.round(f.x), y: Math.round(f.y), width: Math.round(f.w), height: Math.round(f.h) })) };
  const res = await api('/envelopes/' + envelopeId + '/fields', { method:'POST', body: JSON.stringify(payload) });
  if(res.ok){ $('status').textContent = 'Saved ' + fields.length + ' field(s). You can send the envelope now.'; }
  else { const j = await res.json().catch(()=>({})); $('status').textContent = 'Could not save: ' + (j.detail || res.status); $('save').disabled = false; }
});

boot();
</script>
</body>
</html>`;
}
