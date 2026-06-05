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

function render(){
  applyBranding();
  $("docName").textContent = session.documentName || "Document";
  if (session.authRequired){
    $("viewer").innerHTML = '<div style="color:#9aa3b2;padding:40px;text-align:center">Verify your identity to view this document.</div>';
    renderAuth();
    return;
  }
  const docs = (session.documents && session.documents.length)
    ? session.documents
    : [{ documentUrl: api("/document") }];
  $("viewer").innerHTML = docs.map((d, i) =>
    '<iframe class="docframe" title="Document ' + (i + 1) + '" src="' + esc(d.documentUrl) + '#toolbar=1&view=FitH"></iframe>'
  ).join("");
  if (session.consentRequired) renderConsent(); else renderSign();
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
    renderSign();
  } catch (e) {
    $("err").textContent = "Could not record your consent. Please try again.";
    btn.disabled = false;
  }
}

function renderSign(){
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
    signatureValue = signCanvas.toDataURL("image/png");
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
  $("editBtn").addEventListener("click", () => render());

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
