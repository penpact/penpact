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
  <button id="ai" style="margin-left:auto" title="Let AI propose where signatures, names, and dates go">&#10024; Auto-detect with AI</button>
  <button class="primary" id="save">Save fields</button>
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
const textByPage = {}; // page -> [{str, x, w, yTop, h}] in PDF points, origin top-left

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
    // Capture text positions (PDF points, origin top-left) so AI fields can snap to lines.
    try {
      const tc = await page.getTextContent();
      const ph = page.getViewport({ scale: 1 }).height;
      textByPage[p] = tc.items
        .filter((i) => i.str && i.str.trim())
        .map((i) => ({
          str: i.str,
          x: i.transform[4],
          w: i.width || 0,
          yTop: ph - i.transform[5] - (i.height || 0),
          h: i.height || Math.hypot(i.transform[1] || 0, i.transform[3] || 0) || 10,
        }));
    } catch (e) { textByPage[p] = []; }
    wrap.addEventListener('click', (e) => onPlace(e, wrap, p));
  }
}

// Keywords that identify a labelled line for each field type.
const LABEL_KEYWORDS = {
  signature: ['signature', 'signed', 'sign here'],
  initials: ['initial'],
  name: ['name', 'printed name'],
  date: ['date'],
  email: ['email', 'e-mail'],
  text: ['title', 'company', 'address'],
};

// Snap an AI proposal (PDF points) onto the document's matching label line. The LLM
// gives an approximate position + a type; we use the type to pick the nearest line
// whose label matches (e.g. a "signature" snaps to the closest "Signature:" line)
// and place the field right after that label, on its baseline. Far more accurate
// than the raw LLM coordinates, which only land in the right region.
function snapToLine(p){
  const items = textByPage[p.page] || [];
  if(!items.length) return p;
  const kws = LABEL_KEYWORDS[p.type] || [];
  let best = null, bestD = 1e9;
  // 1) nearest line whose label text matches this field type — within a TIGHT
  //    window so a field never jumps to an identical label in another block.
  for(const it of items){
    const low = it.str.toLowerCase();
    if(!kws.some((k) => low.includes(k))) continue;
    const d = Math.abs(it.yTop - p.y);
    if(d < bestD){ bestD = d; best = it; }
  }
  if(best && bestD <= 55){
    p.y = Math.max(0, best.yTop + best.h - p.height);
    // The label and its fill line may be one text run ("Signature: ____"); place
    // the field just after the colon by estimating its x within the run.
    const ci = best.str.indexOf(':');
    p.x = ci >= 0 && best.str.length
      ? best.x + best.w * ((ci + 1) / best.str.length) + 6
      : best.x + best.w + 8;
    return p;
  }
  // 2) fallback: vertical-only nudge to the nearest line, only if very close
  best = null; bestD = 1e9;
  for(const it of items){ const d = Math.abs(it.yTop - p.y); if(d < bestD){ bestD = d; best = it; } }
  if(best && bestD <= 40){ p.y = Math.max(0, best.yTop + best.h - p.height); }
  return p;
}

function escapeHtml(s){ const d=document.createElement('div'); d.textContent=s==null?'':String(s); return d.innerHTML; }

// Deterministic detection from the document's own "Label:" fill lines — far more
// accurate than LLM coordinates on labelled contracts. Looks at the word before
// the first colon on each text line; if it matches a field-type keyword, drops the
// matching field right after the colon, on that line. Used first; AI is the
// fallback for label-less (e.g. scanned/flat) documents.
const FIELD_BOX = { signature:[200,32], initials:[80,28], name:[240,22], date:[150,22], email:[240,22], text:[240,22] };
function detectFromLabels(){
  const signerId = $('signer').value || null;
  const out = [];
  for(const pageStr of Object.keys(textByPage)){
    const page = Number(pageStr);
    for(const it of textByPage[page]){
      const ci = it.str.indexOf(':');
      if(ci < 0) continue;
      const label = it.str.slice(0, ci).toLowerCase();
      if(label.length === 0 || label.length > 24) continue;
      let type = null;
      for(const t of Object.keys(LABEL_KEYWORDS)){ if(LABEL_KEYWORDS[t].some((k) => label.includes(k))){ type = t; break; } }
      if(!type) continue;
      const dim = FIELD_BOX[type] || [180,24];
      const x = it.x + it.w * ((ci + 1) / it.str.length) + 6;
      const y = Math.max(0, it.yTop + it.h - dim[1]);
      out.push({ page, type, signerId, x, y, width: dim[0], height: dim[1] });
    }
  }
  return out;
}

const DEFAULTS = { signature:[180,48], initials:[80,40], name:[180,28], date:[120,28], text:[180,28], checkbox:[22,22] };

// Draw a field box from PDF-point coordinates (origin top-left) and track it.
function makeBox(wrap, page, type, signerId, xPt, yPt, wPt, hPt){
  const box = document.createElement('div');
  box.className = 'fieldBox';
  box.style.left = (xPt*SCALE) + 'px'; box.style.top = (yPt*SCALE) + 'px';
  box.style.width = (wPt*SCALE) + 'px'; box.style.height = (hPt*SCALE) + 'px';
  box.innerHTML = '<span class="lbl">'+type+'</span><button class="x">×</button>';
  wrap.appendChild(box);
  const f = { page, type, signerId, x: xPt, y: yPt, w: wPt, h: hPt, el: box };
  fields.push(f);
  box.querySelector('.x').addEventListener('click', (ev) => { ev.stopPropagation(); box.remove(); fields.splice(fields.indexOf(f),1); });
  return f;
}

function onPlace(e, wrap, page){
  if($('save').disabled) return;
  const rect = wrap.getBoundingClientRect();
  const px = e.clientX - rect.left, py = e.clientY - rect.top;
  const type = $('ftype').value;
  const signerId = $('signer').value;
  if(!signerId){ $('status').textContent = 'Add a signer to the envelope first.'; return; }
  const [wPx, hPx] = DEFAULTS[type];
  makeBox(wrap, page, type, signerId, px/SCALE, py/SCALE, wPx/SCALE, hPx/SCALE);
}

$('ai').addEventListener('click', async () => {
  if($('save').disabled) return;
  $('ai').disabled = true; $('status').textContent = 'Detecting fields…';
  const place = (list, source) => {
    let added = 0;
    for(const p of list){
      const wrap = document.querySelector('.pageWrap[data-page="' + p.page + '"]');
      if(!wrap) continue;
      makeBox(wrap, p.page, p.type, p.signerId, p.x, p.y, p.width, p.height);
      added++;
    }
    $('status').textContent = 'Placed ' + added + ' field(s) ' + source + ' for the first signer. Reassign or adjust, then Save.';
    $('ai').disabled = false;
  };
  try{
    // 1) accurate, deterministic placement from the document's "Label:" lines
    const labelFields = detectFromLabels();
    if(labelFields.length){ place(labelFields, 'from document labels'); return; }
    // 2) fallback to AI for documents without recognisable labels (scanned/flat)
    const res = await api('/envelopes/' + envelopeId + '/fields/auto-detect', { method:'POST' });
    const j = await res.json().catch(()=>({}));
    if(!res.ok){ $('status').textContent = 'Detection failed: ' + (j.detail || res.status); $('ai').disabled = false; return; }
    const props = (j.data || []).map((p) => snapToLine(p));
    if(props.length === 0){ $('status').textContent = 'No fields detected — place them manually (or set an AI provider key).'; $('ai').disabled = false; return; }
    place(props, 'with AI');
  }catch(e){ $('status').textContent = 'Detection error — try again.'; $('ai').disabled = false; }
});

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
