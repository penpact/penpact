/**
 * Hosted signing page (v1, typed signature).
 *
 * A self-contained HTML document served at `GET /sign/:token`. It consumes the
 * signer API under `/v1/sign/:token` (session, consent, complete, decline) from
 * the browser. The token in the path is the signer's bearer credential, so no
 * API key is involved. The sealer draws field values as text (services/pdf.ts),
 * so this page captures a typed signature; a drawn-signature canvas would need
 * the sealer to embed PNG images and is a later increment.
 */
import { TRANSLATIONS } from '../lib/i18n.js';

const STYLES = `
:root {
  --bg: #0a0b0e; --bg-2: #0c0e13; --panel: #14161d; --panel-2: #181b23;
  --line: #21242d; --line-2: #2c303b; --ink: #edeff5; --muted: #9298a6;
  --muted-2: #6b7180; --brand: #5b8cff; --brand-ink: #fff; --ok: #46cb8b;
  --danger: #e0556b; --field: #181b22; --radius: 12px;
  --sans: "Hanken Grotesk", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --serif: "Instrument Serif", Georgia, serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body {
  background-color: var(--bg); color: var(--ink);
  font-family: var(--sans); font-size: 15px; line-height: 1.55;
  letter-spacing: -0.003em; -webkit-font-smoothing: antialiased;
  background-image: radial-gradient(700px 380px at 78% -10%,
    color-mix(in srgb, var(--brand) 16%, transparent), transparent 70%);
  background-attachment: fixed;
}
::selection { background: color-mix(in srgb, var(--brand) 32%, transparent); color: #fff; }
a { color: var(--brand); }
header.top {
  display: flex; align-items: center; gap: 12px; padding: 13px 22px;
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--panel) 80%, transparent);
  backdrop-filter: saturate(150%) blur(10px);
}
.logo { font-weight: 800; letter-spacing: -0.03em; font-size: 16px; display: inline-flex; align-items: center; }
.logo span { color: var(--brand); }
.doc-name { color: var(--muted); font-size: 13.5px; }
.layout { display: grid; grid-template-columns: 1fr 400px; min-height: calc(100vh - 53px); }
.viewer { background: #07080b; overflow-y: auto; }
.docframe { width: 100%; height: 92vh; border: 0; display: block; }
.docframe + .docframe { border-top: 8px solid var(--bg); }
.panel {
  border-left: 1px solid var(--line);
  background: linear-gradient(180deg, var(--panel-2), var(--panel));
  padding: 26px 24px; overflow-y: auto;
}
h2 { font-size: 19px; margin: 0 0 5px; letter-spacing: -0.02em; }
.lead { color: var(--muted); margin: 0 0 20px; font-size: 14px; }
.disclosure {
  background: var(--field); border: 1px solid var(--line); border-radius: 10px;
  padding: 13px 15px; max-height: 220px; overflow-y: auto; font-size: 12.5px;
  line-height: 1.6; color: var(--muted); white-space: pre-wrap; margin-bottom: 16px;
}
label.check {
  display: flex; gap: 11px; align-items: flex-start; font-size: 14px; cursor: pointer;
  background: var(--field); border: 1px solid var(--line); border-radius: 10px;
  padding: 13px 15px; transition: border-color 0.15s ease;
}
label.check:hover { border-color: var(--line-2); }
label.check input { margin-top: 2px; accent-color: var(--brand); width: 16px; height: 16px; }
.field { margin-bottom: 15px; }
.field label { display: block; font-size: 12.5px; color: var(--muted); margin-bottom: 7px; font-weight: 500; }
.field input, .field select {
  width: 100%; background: var(--field); border: 1px solid var(--line);
  border-radius: 10px; color: var(--ink); padding: 11px 13px; font: inherit;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.field input:focus, .field select:focus, #authCode:focus {
  outline: 0; border-color: var(--brand);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 22%, transparent);
}
#authCode {
  width: 100%; background: var(--field); border: 1px solid var(--line);
  border-radius: 10px; color: var(--ink); padding: 12px 14px; font: inherit;
  letter-spacing: 0.04em;
}
.sig-preview {
  background: #fbfbfd; color: #111; border-radius: 10px; padding: 12px 16px;
  min-height: 62px; display: flex; align-items: center;
  font-family: "Snell Roundhand", "Brush Script MT", "Segoe Script", cursive;
  font-size: 32px; line-height: 1; margin-top: 8px; overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.04);
}
.sigtabs { display: inline-flex; gap: 4px; margin: 8px 0; background: var(--field); border: 1px solid var(--line); border-radius: 10px; padding: 3px; }
.sigtabs button { background: transparent; border: 0; color: var(--muted); border-radius: 8px; padding: 6px 16px; transition: all 0.15s ease; }
.sigtabs button.active { color: var(--ink); background: var(--panel-2); box-shadow: 0 1px 4px rgba(0,0,0,0.3); }
#sigCanvas { background: #fbfbfd; border: 1px solid var(--line); border-radius: 10px; touch-action: none; max-width: 100%; display: block; }
button {
  font: inherit; border: 0; border-radius: 10px; padding: 12px 16px; cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.15s ease, background 0.15s ease, opacity 0.15s ease;
}
.btn-primary {
  background: linear-gradient(180deg, var(--brand), color-mix(in srgb, var(--brand) 82%, #000));
  color: var(--brand-ink); font-weight: 600; width: 100%;
  box-shadow: 0 8px 22px -10px color-mix(in srgb, var(--brand) 75%, transparent), inset 0 1px 0 rgba(255,255,255,0.22);
}
.btn-primary:hover:not(:disabled) { transform: translateY(-1px); }
.btn-primary:disabled { opacity: 0.45; cursor: not-allowed; }
.btn-ghost { background: transparent; color: var(--muted); width: 100%; margin-top: 9px; border: 1px solid var(--line); }
.btn-ghost:hover { color: var(--ink); border-color: var(--line-2); }
.legal { color: var(--muted-2); font-size: 11.5px; margin: 15px 0 0; line-height: 1.5; }
.err { color: var(--danger); font-size: 13px; margin-top: 11px; min-height: 18px; }

/* In-context overlay signing (P0) */
.pages { padding: 22px 18px 60px; display: flex; flex-direction: column; align-items: center; gap: 16px; }
.docLabel { color: var(--muted); font-size: 12px; align-self: center; margin-top: 6px; letter-spacing: 0.02em; text-transform: uppercase; }
.pageWrap { position: relative; width: max-content; border-radius: 6px; overflow: hidden; box-shadow: 0 10px 34px -16px rgba(0,0,0,0.75); }
.pageWrap canvas { display: block; }
.ftab {
  position: absolute; cursor: pointer; box-sizing: border-box;
  border: 1.5px dashed color-mix(in srgb, var(--brand) 70%, #fff);
  background: color-mix(in srgb, var(--brand) 16%, transparent);
  border-radius: 4px; display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 600; color: color-mix(in srgb, var(--brand) 80%, #000);
  overflow: hidden; transition: box-shadow 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}
.ftab .ph { pointer-events: none; display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; padding: 0 4px; }
.ftab.required:not(.done) { border-color: #c79200; background: color-mix(in srgb, #f4c430 30%, transparent); color: #6f5500; }
.ftab.active { box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 45%, transparent), 0 4px 14px -4px rgba(0,0,0,0.4); border-style: solid; }
.ftab.done { border: 1px solid color-mix(in srgb, var(--ok) 55%, transparent); background: transparent; color: #111; }
.ftab img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
.ftab .filled { color: #111; line-height: 1; white-space: nowrap; }
.ftab .filledsig { font-family: "Snell Roundhand", "Brush Script MT", "Segoe Script", cursive; color: #111; line-height: 1; }
.ftab input, .ftab select {
  width: 100%; height: 100%; border: 0; background: transparent; font: inherit;
  color: #111; padding: 0 5px; text-align: center; outline: 0; font-size: 12px;
}
.ftab.cbtab .cbmark { width: 70%; height: 70%; }
.ftab.checked .cbmark::before { content: "\\2713"; color: #111; font-size: 15px; font-weight: 700; }

/* Adopt-signature modal */
.modal-backdrop { position: fixed; inset: 0; background: rgba(2,3,6,0.62); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 60; padding: 20px; animation: fadeUp 0.25s ease both; }
.modal { background: linear-gradient(180deg, var(--panel-2), var(--panel)); border: 1px solid var(--line-2); border-radius: 16px; padding: 24px; max-width: 460px; width: 100%; box-shadow: 0 30px 80px -30px rgba(0,0,0,0.8); }
.modal h2 { margin-bottom: 4px; }
.modal .row { display: flex; gap: 10px; margin-top: 18px; }
.modal .row .btn-primary, .modal .row .btn-ghost { margin-top: 0; }

/* Sign panel progress */
.prog { display: flex; align-items: center; gap: 10px; margin: 4px 0 16px; color: var(--muted); font-size: 13px; }
.prog .bar { flex: 1; height: 6px; border-radius: 999px; background: var(--field); overflow: hidden; }
.prog .bar > i { display: block; height: 100%; background: linear-gradient(90deg, var(--brand), var(--ok)); width: 0; transition: width 0.3s ease; }

/* Final states (signed / declined / unavailable) */
.state { max-width: 440px; margin: 12vh auto; padding: 0 24px; text-align: center; animation: fadeUp 0.6s cubic-bezier(0.2,0.7,0.2,1) both; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
.seal { position: relative; width: 92px; height: 92px; margin: 0 auto 22px; }
.seal .ring { position: absolute; inset: 0; border-radius: 50%; }
.seal.ok .ring { background: radial-gradient(circle, color-mix(in srgb, var(--ok) 22%, transparent), transparent 68%); animation: pulse 2.4s ease-out infinite; }
.seal.no .ring { background: radial-gradient(circle, color-mix(in srgb, var(--danger) 18%, transparent), transparent 68%); }
@keyframes pulse { 0% { transform: scale(0.85); opacity: 0.9; } 70% { transform: scale(1.15); opacity: 0; } 100% { opacity: 0; } }
.seal svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.seal .circle { fill: none; stroke-width: 3.5; stroke-linecap: round; stroke-dasharray: 264; stroke-dashoffset: 264; animation: draw 0.7s ease forwards; }
.seal .mark { fill: none; stroke-width: 4.5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 60; stroke-dashoffset: 60; animation: draw 0.45s 0.5s ease forwards; }
.seal.ok .circle, .seal.ok .mark { stroke: var(--ok); }
.seal.no .circle, .seal.no .mark { stroke: var(--danger); }
@keyframes draw { to { stroke-dashoffset: 0; } }
.state .big { font-family: var(--serif); font-weight: 400; font-size: 34px; letter-spacing: -0.01em; margin-bottom: 10px; }
.state .lead { color: var(--muted); margin: 0 auto; max-width: 38ch; }
.sealed-chip {
  display: inline-flex; align-items: center; gap: 7px; margin-top: 20px;
  background: color-mix(in srgb, var(--ok) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--ok) 35%, transparent);
  color: var(--ok); border-radius: 999px; padding: 7px 15px; font-size: 13px; font-weight: 500;
}
.poweredby { color: var(--muted-2); font-size: 12px; margin-top: 26px; }

@media (max-width: 820px) {
  .layout { grid-template-columns: 1fr; }
  .viewer { height: 46vh; }
  .panel { border-left: 0; border-top: 1px solid var(--line); }
}
`;

// The client script is a template string. It runs in the browser. TOKEN is
// injected by the server. Keep it dependency-free.
// Embed a string safely inside an inline <script>. JSON.stringify alone does not
// escape "</script>" or "<!--", which would terminate the script element during
// HTML parsing. Escaping "<" and "/" closes that hole (defense in depth; the
// token is normally hex).
function jsStringLiteral(value: string): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\//g, '\\u002f');
}

const SCRIPT = (token: string) => `
const TOKEN = ${jsStringLiteral(token)};
const api = (p) => "/v1/sign/" + TOKEN + p;
const $ = (id) => document.getElementById(id);

function esc(s){ const d=document.createElement("div"); d.textContent=s==null?"":String(s); return d.innerHTML; }
function initialsOf(name){ return (name||"").split(/\\s+/).filter(Boolean).map(w=>w[0]).join("").toUpperCase().slice(0,4); }
function today(){ const d=new Date(); return d.toISOString().slice(0,10); }

// Crop the drawn signature to the bounding box of its ink, so its position in the
// field is consistent no matter where on the canvas the signer drew. Returns a
// PNG data URL of just the strokes (with a little padding), or null if blank.
function trimmedSignaturePng(canvas){
  const w = canvas.width, h = canvas.height;
  const data = canvas.getContext("2d").getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++){
    for (let x = 0; x < w; x++){
      if (data[(y * w + x) * 4 + 3] > 12){
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null; // nothing drawn
  const pad = 8;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  const out = document.createElement("canvas");
  out.width = cw; out.height = ch;
  out.getContext("2d").drawImage(canvas, minX, minY, cw, ch, 0, 0, cw, ch);
  return out.toDataURL("image/png");
}

const I18N = ${JSON.stringify(TRANSLATIONS)};
function loc(){ return (session && session.locale) || "en"; }
function tr(key, vars){
  const d = I18N[loc()] || I18N.en;
  let s = (d && d[key]) || I18N.en[key] || key;
  if (vars) s = s.replace(/\\{(\\w+)\\}/g, function(_, k){ return vars[k] != null ? vars[k] : "{"+k+"}"; });
  return s;
}

let session = null;
let signMode = "type";
let signDrawn = false;
let signCanvas = null;

// Overlay signing (P0) state.
const SCALE = 1.4;
let myFields = [];          // this signer's fields
let fieldValue = {};        // fieldId -> string value (text or PNG data URL)
let adopted = false;        // has the signer adopted a signature yet
let adoptedName = "";       // full legal name
let adoptedSig = null;      // drawn-signature PNG data URL, or null when typed
let cssEsc = (s) => String(s).replace(/["\\\\\\]]/g, "\\\\$&");

async function load(){
  try {
    const res = await fetch(api(""), { headers: { accept: "application/json" } });
    if (res.status === 410) return showState("no", "This signing link is no longer active.", "The envelope was completed, declined, voided, or expired.");
    if (res.status === 404) return showState("no", "Signing link not found.", "Check that you opened the full link from your email.");
    if (!res.ok) throw new Error("HTTP " + res.status);
    session = await res.json();
    render();
  } catch (e) {
    showState("no", "Could not load this document.", "Please try again in a moment.");
  }
}

function showState(kind, big, sub){
  var ok = kind === "ok";
  var seal =
    '<div class="seal ' + (ok ? "ok" : "no") + '"><div class="ring"></div>' +
    '<svg viewBox="0 0 100 100" aria-hidden="true">' +
      '<circle class="circle" cx="50" cy="50" r="42"></circle>' +
      (ok
        ? '<path class="mark" d="M32 51 L45 64 L70 38"></path>'
        : '<path class="mark" d="M37 37 L63 63 M63 37 L37 63"></path>') +
    '</svg></div>';
  var attribution = !(session && session.branding && session.branding.attribution === false);
  document.body.innerHTML =
    '<div class="state ' + (ok ? "ok" : "") + '">' +
      seal +
      '<div class="big">' + esc(big) + '</div>' +
      '<div class="lead">' + esc(sub || "") + '</div>' +
      (ok ? '<div class="sealed-chip">\\uD83D\\uDD12 Signed &amp; sealed</div>' : '') +
      (attribution ? '<div class="poweredby">Secured by Penpact</div>' : '') +
    '</div>';
}

function applyBranding(){
  const b = session.branding || {};
  if (b.color) document.documentElement.style.setProperty("--brand", b.color);
  const logo = $("brandLogo");
  if (logo){
    if (b.logoUrl){
      logo.innerHTML = '<img src="' + esc(b.logoUrl) + '" alt="' + esc(b.name || "Logo") + '" style="height:24px;display:block">';
    } else if (b.name){
      logo.textContent = b.name;
    }
  }
}

function sessionDocs(){
  return (session.documents && session.documents.length)
    ? session.documents
    : [{ id: null, documentUrl: api("/document"), pageCount: null }];
}

// Read-only iframe viewer (browser PDF). Used for the auth/consent phases, the
// final preview, and as the fallback when pdf.js cannot load.
function showIframeViewer(){
  $("viewer").innerHTML = sessionDocs().map((d, i) =>
    '<iframe class="docframe" title="Document ' + (i + 1) + '" src="' + esc(d.documentUrl) + '#toolbar=1&view=FitH"></iframe>'
  ).join("");
}

function render(){
  applyBranding();
  $("docName").textContent = session.documentName || "Document";
  if (session.authRequired){
    $("viewer").innerHTML = '<div style="color:#9aa3b2;padding:40px;text-align:center">Verify your identity to view this document.</div>';
    renderAuth();
    return;
  }
  if (session.consentRequired){ showIframeViewer(); renderConsent(); return; }
  startSigning();
}

// Try the in-context overlay UX (fields placed on the document, guided
// navigation). If pdf.js fails to load or render for any reason, fall back to
// the dependency-free side-form so signing never breaks.
async function startSigning(){
  myFields = (session.fields || []).filter(f => f.signerId === session.signer.id);
  fieldValue = {}; adopted = false; adoptedName = session.signer.name || ""; adoptedSig = null;
  try {
    await renderOverlaySigning();
  } catch (e) {
    try { console.error("overlay signing failed, using form fallback", e); } catch (_e) {}
    renderFormSigning();
  }
}

// Return to the overlay from the review step WITHOUT resetting captured values
// or the adopted signature (re-renders pages, re-seeds tabs from fieldValue).
async function reenterSigning(){
  try { await renderOverlaySigning(); }
  catch (e) { renderFormSigning(); }
}

function renderAuth(){
  const isOtp = session.authRequired === "email_otp";
  const where = (session.signer && session.signer.email) ? session.signer.email : "your address";
  $("panel").innerHTML =
    '<h2>' + esc(tr('verifyTitle')) + '</h2>' +
    '<p class="lead">' + esc(isOtp ? tr('verifyOtpHint', { email: where }) : tr('verifyCodeHint')) + '</p>' +
    '<input id="authCode" type="text" inputmode="' + (isOtp ? 'numeric' : 'text') + '" placeholder="' + esc(isOtp ? tr('codePlaceholder') : tr('accessPlaceholder')) + '" autocomplete="one-time-code">' +
    '<div class="err" id="authErr"></div>' +
    '<button class="btn-primary" id="authBtn" style="margin-top:12px">' + esc(tr('verify')) + '</button>';
  $("authCode").addEventListener("keydown", (e)=>{ if(e.key==="Enter") submitAuth(); });
  $("authBtn").onclick = submitAuth;
}

async function submitAuth(){
  const code = ($("authCode").value || "").trim();
  const err = $("authErr"); err.textContent = "";
  if(!code){ err.textContent = "Enter the code to continue."; return; }
  const btn = $("authBtn"); btn.disabled = true;
  try {
    const res = await fetch(api("/authenticate"), { method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ code }) });
    if(!res.ok){ err.textContent = "That code is incorrect or has expired."; btn.disabled = false; return; }
    await load();
  } catch(e){ err.textContent = "Network error. Try again."; btn.disabled = false; }
}

function renderConsent(){
  const d = session.consentDisclosure || { text: "", hash: "" };
  $("panel").innerHTML =
    '<h2>' + esc(tr('beforeYouSign')) + '</h2>' +
    '<p class="lead">' + esc(tr('consentIntro')) + '</p>' +
    '<div class="disclosure">' + esc(d.text) + '</div>' +
    '<label class="check"><input type="checkbox" id="agree"> ' +
      esc(tr('consentAgree')) + '</label>' +
    '<div class="err" id="err"></div>' +
    '<button class="btn-primary" id="continueBtn" disabled style="margin-top:16px">' + esc(tr('continue')) + '</button>';
  $("agree").addEventListener("change", (e) => { $("continueBtn").disabled = !e.target.checked; });
  $("continueBtn").addEventListener("click", submitConsent.bind(null, d.hash));
}

async function submitConsent(hash){
  const btn = $("continueBtn"); btn.disabled = true; $("err").textContent = "";
  try {
    const res = await fetch(api("/consent"), {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ disclosureHash: hash, agree: true }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    session.consentRequired = false;
    startSigning();
  } catch (e) {
    $("err").textContent = "Could not record your consent. Please try again.";
    btn.disabled = false;
  }
}

let usingOverlay = false;

function isSigType(t){ return t === "signature" || t === "stamp" || t === "initials" || t === "name"; }
function mkInput(type, val){ const i = document.createElement("input"); i.type = type; if (val != null) i.value = val; return i; }
function markDone(tab, done){ tab.classList.toggle("done", !!done); if (done) tab.classList.remove("required"); else if (tab.dataset.req === "1") tab.classList.add("required"); }

// Render each document's pages with pdf.js, then drop interactive field tabs at
// the stored coordinates. Throws if pdf.js cannot load (caller falls back).
async function renderOverlaySigning(){
  const pdfjs = await import("https://esm.sh/pdfjs-dist@4.7.76/build/pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "https://esm.sh/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs";
  const docs = sessionDocs();
  $("viewer").innerHTML = '<div class="pages" id="pages"><div style="color:#9aa3b2;padding:40px;text-align:center">Loading document\\u2026</div></div>';
  const pages = $("pages");
  pages.innerHTML = "";
  for (let di = 0; di < docs.length; di++){
    const d = docs[di];
    if (docs.length > 1){
      const lbl = document.createElement("div");
      lbl.className = "docLabel";
      lbl.textContent = "Document " + (di + 1) + " of " + docs.length;
      pages.appendChild(lbl);
    }
    const buf = await (await fetch(d.documentUrl)).arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    for (let p = 1; p <= pdf.numPages; p++){
      const page = await pdf.getPage(p);
      const viewport = page.getViewport({ scale: SCALE });
      const wrap = document.createElement("div");
      wrap.className = "pageWrap";
      wrap.setAttribute("data-page", String(p));
      if (d.id) wrap.setAttribute("data-document", d.id);
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width; canvas.height = viewport.height;
      wrap.appendChild(canvas);
      pages.appendChild(wrap);
      await page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport }).promise;
    }
  }
  placeTabs(docs);
  renderSignPanel();
  updateProgress();
  usingOverlay = true;
}

function placeTabs(docs){
  const multiDoc = docs.length > 1 && !!docs[0].id;
  for (const f of myFields){
    let sel = '.pageWrap[data-page="' + f.page + '"]';
    if (multiDoc && f.documentId) sel += '[data-document="' + cssEsc(f.documentId) + '"]';
    let wrap = document.querySelector(sel);
    if (!wrap) wrap = document.querySelector('.pageWrap[data-page="' + f.page + '"]');
    if (!wrap) continue;
    const tab = document.createElement("div");
    tab.className = "ftab" + (f.required ? " required" : "");
    tab.id = "tab_" + f.id;
    if (f.required) tab.dataset.req = "1";
    tab.style.left = (f.x * SCALE) + "px";
    tab.style.top = (f.y * SCALE) + "px";
    tab.style.width = (f.width * SCALE) + "px";
    tab.style.height = (f.height * SCALE) + "px";
    wrap.appendChild(tab);
    initTab(tab, f);
  }
}

function initTab(tab, f){
  const t = f.type;
  if (isSigType(t)){
    const ph = t === "initials" ? "Initials" : (t === "name" ? "Name" : "\\u270D\\uFE0F Sign");
    tab.innerHTML = '<span class="ph">' + esc(ph) + '</span>';
    tab.addEventListener("click", () => { if (!adopted) openAdoptModal(); else fillAdoptTabs(); });
    if (adopted) renderAdoptInto(tab, f);
    return;
  }
  if (t === "date"){
    fieldValue[f.id] = fieldValue[f.id] || today();
    const inp = mkInput("date", fieldValue[f.id]); tab.appendChild(inp);
    inp.addEventListener("input", () => { fieldValue[f.id] = inp.value; markDone(tab, !!inp.value); updateProgress(); });
    markDone(tab, !!fieldValue[f.id]);
    return;
  }
  if (t === "email"){
    if (fieldValue[f.id] == null) fieldValue[f.id] = session.signer.email || "";
    const inp = mkInput("email", fieldValue[f.id]); tab.appendChild(inp);
    inp.addEventListener("input", () => { fieldValue[f.id] = inp.value.trim(); markDone(tab, !!fieldValue[f.id]); updateProgress(); });
    markDone(tab, !!fieldValue[f.id]);
    return;
  }
  if (t === "checkbox"){
    tab.classList.add("cbtab");
    tab.innerHTML = '<span class="cbmark"></span>';
    if (fieldValue[f.id] === "Yes"){ tab.classList.add("checked"); markDone(tab, true); }
    tab.addEventListener("click", () => {
      const on = fieldValue[f.id] !== "Yes";
      fieldValue[f.id] = on ? "Yes" : "";
      tab.classList.toggle("checked", on);
      markDone(tab, on);
      updateProgress();
    });
    return;
  }
  if (t === "dropdown" || t === "radio"){
    const sel = document.createElement("select");
    let html = '<option value="">Select\\u2026</option>';
    for (const o of (f.options || [])) html += '<option value="' + esc(o) + '">' + esc(o) + '</option>';
    sel.innerHTML = html;
    if (fieldValue[f.id]) sel.value = fieldValue[f.id];
    tab.appendChild(sel);
    if (fieldValue[f.id]) markDone(tab, true);
    sel.addEventListener("change", () => { fieldValue[f.id] = sel.value; markDone(tab, !!sel.value); updateProgress(); });
    return;
  }
  const inp = mkInput("text", fieldValue[f.id] || ""); tab.appendChild(inp);
  if (fieldValue[f.id]) markDone(tab, true);
  inp.addEventListener("input", () => { fieldValue[f.id] = inp.value.trim(); markDone(tab, !!fieldValue[f.id]); updateProgress(); });
}

function renderAdoptInto(tab, f){
  if (f.type === "name"){
    fieldValue[f.id] = adoptedName;
    tab.innerHTML = '<span class="filled">' + esc(adoptedName) + '</span>';
  } else if (f.type === "initials"){
    fieldValue[f.id] = initialsOf(adoptedName);
    tab.innerHTML = '<span class="filled">' + esc(initialsOf(adoptedName)) + '</span>';
  } else if (adoptedSig){
    fieldValue[f.id] = adoptedSig;
    tab.innerHTML = '<img src="' + adoptedSig + '" alt="signature">';
  } else {
    fieldValue[f.id] = adoptedName;
    const px = Math.max(11, Math.round(f.height * SCALE * 0.78));
    tab.innerHTML = '<span class="filledsig" style="font-size:' + px + 'px">' + esc(adoptedName) + '</span>';
  }
  markDone(tab, true);
}

function fillAdoptTabs(){
  for (const f of myFields){ if (!isSigType(f.type)) continue; const tab = $("tab_" + f.id); if (tab) renderAdoptInto(tab, f); }
  updateProgress();
}

function openAdoptModal(){
  const back = document.createElement("div");
  back.className = "modal-backdrop";
  back.innerHTML =
    '<div class="modal">' +
      '<h2>' + esc(tr("adoptSignature")) + '</h2>' +
      '<p class="lead">' + esc(tr("adoptHint")) + '</p>' +
      '<div class="field"><label for="mName">' + esc(tr("fullName")) + '</label>' +
        '<input type="text" id="mName" value="' + esc(adoptedName) + '" autocomplete="name"></div>' +
      '<div class="field"><label>' + esc(tr("signatureLabel")) + '</label>' +
        '<div class="sigtabs"><button type="button" id="mType" class="active">' + esc(tr("type")) + '</button>' +
          '<button type="button" id="mDraw">' + esc(tr("draw")) + '</button></div>' +
        '<div id="mTypeWrap"><div class="sig-preview" id="mPreview">' + esc(adoptedName) + '</div></div>' +
        '<div id="mDrawWrap" style="display:none">' +
          '<canvas id="sigCanvas" width="380" height="120"></canvas>' +
          '<button type="button" class="btn-ghost" id="mClear" style="margin-top:6px">' + esc(tr("clear")) + '</button>' +
        '</div></div>' +
      '<div class="err" id="mErr"></div>' +
      '<div class="row">' +
        '<button class="btn-ghost" id="mCancel" style="margin-top:0">Cancel</button>' +
        '<button class="btn-primary" id="mAdopt" style="margin-top:0">' + esc(tr("signButton")) + '</button>' +
      '</div></div>';
  document.body.appendChild(back);

  signMode = "type"; signDrawn = false; signCanvas = $("sigCanvas");
  const ctx = signCanvas.getContext("2d");
  let drawing = false;
  function setMode(m){
    signMode = m;
    $("mType").classList.toggle("active", m === "type");
    $("mDraw").classList.toggle("active", m === "draw");
    $("mTypeWrap").style.display = m === "type" ? "block" : "none";
    $("mDrawWrap").style.display = m === "draw" ? "block" : "none";
  }
  $("mType").addEventListener("click", () => setMode("type"));
  $("mDraw").addEventListener("click", () => setMode("draw"));
  $("mName").addEventListener("input", (e) => { $("mPreview").textContent = e.target.value; });
  signCanvas.addEventListener("pointerdown", (e) => { signCanvas.setPointerCapture(e.pointerId); const r = signCanvas.getBoundingClientRect(); ctx.beginPath(); ctx.moveTo(e.clientX - r.left, e.clientY - r.top); drawing = true; });
  signCanvas.addEventListener("pointermove", (e) => { if (!drawing) return; const r = signCanvas.getBoundingClientRect(); ctx.lineTo(e.clientX - r.left, e.clientY - r.top); ctx.strokeStyle = "#111"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.stroke(); signDrawn = true; });
  signCanvas.addEventListener("pointerup", () => { drawing = false; });
  $("mClear").addEventListener("click", () => { ctx.clearRect(0, 0, signCanvas.width, signCanvas.height); signDrawn = false; });
  $("mCancel").addEventListener("click", () => back.remove());
  $("mAdopt").addEventListener("click", () => {
    const nm = ($("mName").value || "").trim();
    if (!nm){ $("mErr").textContent = "Enter your full name to sign."; return; }
    if (signMode === "draw"){
      if (!signDrawn){ $("mErr").textContent = "Draw your signature, or switch to Type."; return; }
      const png = trimmedSignaturePng(signCanvas);
      if (!png){ $("mErr").textContent = "Draw your signature, or switch to Type."; return; }
      adoptedSig = png;
    } else { adoptedSig = null; }
    adoptedName = nm; adopted = true; back.remove(); fillAdoptTabs();
  });
}

function recomputeOverlayConditions(){
  for (const f of myFields){
    if (!f.condition) continue;
    const tab = $("tab_" + f.id); if (!tab) continue;
    const ctrlVal = fieldValue[f.condition.fieldId] || "";
    tab.style.display = ctrlVal === f.condition.equals ? "" : "none";
  }
}
function tabVisible(f){ const tab = $("tab_" + f.id); return !!tab && tab.style.display !== "none"; }
function fieldDone(f){ const v = fieldValue[f.id]; return v != null && v !== ""; }
function requiredVisible(){ return myFields.filter(f => f.required && tabVisible(f)); }
function nextRequired(){ for (const f of requiredVisible()) if (!fieldDone(f)) return f; return null; }

function updateProgress(){
  recomputeOverlayConditions();
  const req = requiredVisible();
  const total = req.length;
  const done = req.filter(fieldDone).length;
  const prog = $("prog");
  if (prog){
    const pct = total ? Math.round(done / total * 100) : 100;
    prog.innerHTML = '<div class="bar"><i style="width:' + pct + '%"></i></div><span>' + done + ' / ' + total + ' required</span>';
  }
  const btn = $("primaryBtn");
  if (btn) btn.textContent = (done >= total) ? tr("reviewButton") : (done === 0 ? "Start" : "Next field");
}

function renderSignPanel(){
  $("panel").innerHTML =
    '<h2>' + esc(tr("signButton")) + '</h2>' +
    '<p class="lead">Click each highlighted field on the document. The button jumps you to the next one.</p>' +
    '<div class="prog" id="prog"></div>' +
    '<div class="err" id="err"></div>' +
    '<button class="btn-primary" id="primaryBtn">Start</button>' +
    '<button class="btn-ghost" id="declineBtn">' + esc(tr("declineButton")) + '</button>' +
    '<p class="legal">' + esc(tr("legalLine")) + '</p>';
  $("primaryBtn").addEventListener("click", onPrimary);
  $("declineBtn").addEventListener("click", submitDecline);
}

function focusTab(f){
  const tab = $("tab_" + f.id); if (!tab) return;
  const prev = document.querySelector(".ftab.active"); if (prev) prev.classList.remove("active");
  tab.classList.add("active");
  tab.scrollIntoView({ behavior: "smooth", block: "center" });
  if (isSigType(f.type)){ if (!adopted) setTimeout(openAdoptModal, 320); return; }
  const ctl = tab.querySelector("input, select");
  if (ctl) setTimeout(() => ctl.focus(), 320);
}

function onPrimary(){
  const err = $("err"); if (err) err.textContent = "";
  const next = nextRequired();
  if (next){ focusTab(next); return; }
  const values = [];
  for (const f of myFields){
    if (!tabVisible(f)) continue;
    const v = fieldValue[f.id];
    if (f.required && (v == null || v === "")){ if (err) err.textContent = "Please complete all required fields."; focusTab(f); return; }
    if (v != null && v !== "") values.push({ fieldId: f.id, value: v });
  }
  renderReview(values);
}

// Fallback signer surface: document in a read-only iframe, fields collected as a
// side-panel form. Used only when pdf.js is unavailable.
function renderFormSigning(){
  usingOverlay = false;
  showIframeViewer();
  const name = session.signer.name || "";
  const myFields = (session.fields || []).filter(f => f.signerId === session.signer.id);
  let html =
    '<h2>' + esc(tr('adoptSignature')) + '</h2>' +
    '<p class="lead">' + esc(tr('adoptHint')) + '</p>' +
    '<div class="field"><label for="fullName">' + esc(tr('fullName')) + '</label>' +
      '<input type="text" id="fullName" value="' + esc(name) + '" autocomplete="name"></div>' +
    '<div class="field"><label>' + esc(tr('signatureLabel')) + '</label>' +
      '<div class="sigtabs"><button type="button" id="tabType" class="active">' + esc(tr('type')) + '</button>' +
        '<button type="button" id="tabDraw">' + esc(tr('draw')) + '</button></div>' +
      '<div id="typeWrap"><div class="sig-preview" id="sigPreview">' + esc(name) + '</div></div>' +
      '<div id="drawWrap" style="display:none">' +
        '<canvas id="sigCanvas" width="360" height="120"></canvas>' +
        '<button type="button" class="btn-ghost" id="clearCanvas" style="margin-top:6px">' + esc(tr('clear')) + '</button>' +
      '</div></div>';

  const extra = myFields.filter(f => !["signature","stamp","initials","name"].includes(f.type));
  for (const f of extra) {
    const id = "f_" + f.id;
    if (f.type === "date") {
      html += fieldWrap(id, "Date", '<input type="date" id="'+id+'" value="'+today()+'">');
    } else if (f.type === "email") {
      html += fieldWrap(id, "Email", '<input type="email" id="'+id+'" value="'+esc(session.signer.email||"")+'">');
    } else if (f.type === "checkbox") {
      html += '<div class="field"><label class="check"><input type="checkbox" id="'+id+'"' + (f.required?" required":"") + '> I agree</label></div>';
    } else if (f.type === "dropdown") {
      const opts = '<option value="">Select…</option>' + (f.options||[]).map(function(o){return '<option value="'+esc(o)+'">'+esc(o)+'</option>';}).join("");
      html += fieldWrap(id, "Choose" + (f.required?" (required)":""), '<select id="'+id+'">'+opts+'</select>');
    } else if (f.type === "radio") {
      const radios = (f.options||[]).map(function(o,i){return '<label class="check" style="margin-right:12px"><input type="radio" name="'+id+'" value="'+esc(o)+'"> '+esc(o)+'</label>';}).join("");
      html += '<div class="field"><label>Choose'+(f.required?" (required)":"")+'</label><div id="'+id+'">'+radios+'</div></div>';
    } else {
      html += fieldWrap(id, "Text" + (f.required?" (required)":""), '<input type="text" id="'+id+'">');
    }
  }

  html +=
    '<div class="err" id="err"></div>' +
    '<button class="btn-primary" id="signBtn">' + esc(tr('reviewButton')) + '</button>' +
    '<button class="btn-ghost" id="declineBtn">' + esc(tr('declineButton')) + '</button>' +
    '<p class="legal">' + esc(tr('legalLine')) + '</p>';

  $("panel").innerHTML = html;
  $("fullName").addEventListener("input", (e) => { $("sigPreview").textContent = e.target.value; });
  $("signBtn").addEventListener("click", () => reviewSign(myFields));
  $("declineBtn").addEventListener("click", submitDecline);
  // Conditional fields: re-evaluate visibility on any change.
  $("panel").addEventListener("input", () => recomputeConditions(myFields));
  $("panel").addEventListener("change", () => recomputeConditions(myFields));
  recomputeConditions(myFields);

  // Type / Draw signature.
  signMode = "type"; signDrawn = false;
  signCanvas = $("sigCanvas");
  const ctx = signCanvas.getContext("2d");
  let drawing = false;
  function setMode(m){
    signMode = m;
    $("tabType").classList.toggle("active", m === "type");
    $("tabDraw").classList.toggle("active", m === "draw");
    $("typeWrap").style.display = m === "type" ? "block" : "none";
    $("drawWrap").style.display = m === "draw" ? "block" : "none";
  }
  $("tabType").addEventListener("click", () => setMode("type"));
  $("tabDraw").addEventListener("click", () => setMode("draw"));
  signCanvas.addEventListener("pointerdown", (e) => {
    signCanvas.setPointerCapture(e.pointerId);
    const r = signCanvas.getBoundingClientRect();
    ctx.beginPath(); ctx.moveTo(e.clientX - r.left, e.clientY - r.top); drawing = true;
  });
  signCanvas.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const r = signCanvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
    ctx.strokeStyle = "#111"; ctx.lineWidth = 2; ctx.lineCap = "round"; ctx.stroke();
    signDrawn = true;
  });
  signCanvas.addEventListener("pointerup", () => { drawing = false; });
  $("clearCanvas").addEventListener("click", () => { ctx.clearRect(0, 0, signCanvas.width, signCanvas.height); signDrawn = false; });
}

function fieldWrap(id, label, inner){
  return '<div class="field"><label for="'+id+'">'+esc(label)+'</label>'+inner+'</div>';
}

function fieldCurrentValue(fieldId){
  const radio = document.querySelector('input[name="f_' + fieldId + '"]:checked');
  if (radio) return radio.value;
  const el = document.getElementById("f_" + fieldId);
  if (!el) return "";
  if (el.type === "checkbox") return el.checked ? "Yes" : "";
  return (el.value || "").trim();
}

function recomputeConditions(myFields){
  for (const f of myFields){
    if (!f.condition) continue;
    const el = document.getElementById("f_" + f.id);
    const wrap = el && el.closest ? el.closest(".field") : null;
    if (!wrap) continue;
    wrap.style.display = fieldCurrentValue(f.condition.fieldId) === f.condition.equals ? "" : "none";
  }
}

// Validate, collect the values, then show a preview (do not submit yet).
function reviewSign(myFields){
  const err = $("err"); err.textContent = "";
  const fullName = $("fullName").value.trim();
  if (!fullName) { err.textContent = "Enter your full name to sign."; return; }
  const initials = initialsOf(fullName);

  let signatureValue = null;
  if (signMode === "draw") {
    if (!signDrawn || !signCanvas) { err.textContent = "Draw your signature, or switch to Type."; return; }
    signatureValue = trimmedSignaturePng(signCanvas);
    if (!signatureValue) { err.textContent = "Draw your signature, or switch to Type."; return; }
  }

  const values = [];
  for (const f of myFields) {
    if (f.condition && fieldCurrentValue(f.condition.fieldId) !== f.condition.equals) continue;
    let v = "";
    if (f.type === "signature" || f.type === "stamp") v = signatureValue || fullName;
    else if (f.type === "name") v = fullName;
    else if (f.type === "initials") v = initials;
    else if (f.type === "radio") {
      const checked = document.querySelector('input[name="f_' + f.id + '"]:checked');
      v = checked ? checked.value : "";
    } else {
      const el = document.getElementById("f_" + f.id);
      if (!el) continue;
      v = f.type === "checkbox" ? (el.checked ? "Yes" : "") : el.value.trim();
    }
    if (f.required && !v) { err.textContent = "Please complete all required fields."; return; }
    if (v) values.push({ fieldId: f.id, value: v });
  }
  renderReview(values);
}

// Show a server-rendered preview: the API flattens the signer's values into the
// document with the SAME renderer as the final seal, so the preview is exact and
// never depends on the browser loading a PDF library.
async function renderReview(values){
  $("panel").innerHTML =
    '<h2>' + esc(tr('reviewTitle')) + '</h2>' +
    '<p class="lead">' + esc(tr('reviewHint')) + '</p>' +
    '<div class="err" id="rerr"></div>' +
    '<button class="btn-primary" id="finishBtn">' + esc(tr('finishButton')) + '</button>' +
    '<button class="btn-ghost" id="editBtn">' + esc(tr('editButton')) + '</button>';
  $("finishBtn").addEventListener("click", () => doSubmit(values));
  $("editBtn").addEventListener("click", () => { if (usingOverlay) reenterSigning(); else renderFormSigning(); });

  const viewer = $("viewer");
  viewer.innerHTML = '<div style="color:#9aa3b2;padding:40px;text-align:center">Preparing preview…</div>';
  try {
    const res = await fetch(api("/preview"), {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ signatureType: signMode === "draw" ? "drawn" : "typed", fields: values }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const url = URL.createObjectURL(await res.blob());
    viewer.innerHTML = '<iframe class="docframe" title="Signed preview" src="' + url + '#toolbar=0&view=FitH"></iframe>';
  } catch (e) {
    viewer.innerHTML = '<div style="color:#9aa3b2;padding:30px;text-align:center">Could not load the preview, but your fields are ready — press ' + esc(tr('finishButton')) + '.</div>';
  }
}

async function doSubmit(values){
  const btn = $("finishBtn"); const err = $("rerr");
  if (err) err.textContent = "";
  if (btn){ btn.disabled = true; btn.textContent = tr('signing'); }
  try {
    const res = await fetch(api("/complete"), {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ signatureType: signMode === "draw" ? "drawn" : "typed", fields: values }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    showState("ok", "You're all set.", "This document has been signed. A copy and the certificate of completion will be available to the sender.");
  } catch (e) {
    if (err) err.textContent = "Could not submit your signature. Please try again.";
    if (btn){ btn.disabled = false; btn.textContent = tr('finishButton'); }
  }
}

async function submitDecline(){
  const reason = window.prompt("Optionally, tell the sender why you are declining:") || undefined;
  try {
    const res = await fetch(api("/decline"), {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(reason ? { reason } : {}),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
  } catch (e) { /* show declined state regardless */ }
  showState("no", "You declined to sign.", "The sender has been notified. You can close this page.");
}

load();
`;

export function signPageHtml(token: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0a0b0e">
<title>Sign document - Penpact</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=Instrument+Serif&display=swap" rel="stylesheet">
<style>${STYLES}</style>
</head>
<body>
<header class="top">
  <div class="logo" id="brandLogo">Pen<span>pact</span></div>
  <div class="doc-name" id="docName">Loading document...</div>
</header>
<div class="layout">
  <div class="viewer" id="viewer"></div>
  <aside class="panel" id="panel"><p class="lead">Loading...</p></aside>
</div>
<script>${SCRIPT(token)}</script>
</body>
</html>`;
}
