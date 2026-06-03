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

const STYLES = `
:root {
  --bg: #0b0c10; --panel: #15171e; --line: #262a35; --ink: #e8eaf0;
  --muted: #9aa3b2; --brand: #5b8cff; --brand-ink: #fff; --ok: #3fb37f;
  --danger: #e0556b; --field: #1d2029;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body {
  background: var(--bg); color: var(--ink); font: 15px/1.5 -apple-system,
  BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
a { color: var(--brand); }
header.top {
  display: flex; align-items: center; gap: 10px; padding: 14px 20px;
  border-bottom: 1px solid var(--line); background: var(--panel);
}
.logo { font-weight: 700; letter-spacing: -0.02em; }
.logo span { color: var(--brand); }
.doc-name { color: var(--muted); font-size: 14px; }
.layout { display: grid; grid-template-columns: 1fr 380px; min-height: calc(100vh - 53px); }
.viewer { background: #06070a; }
.viewer iframe { width: 100%; height: 100%; border: 0; display: block; }
.panel { border-left: 1px solid var(--line); background: var(--panel); padding: 22px; overflow-y: auto; }
h2 { font-size: 17px; margin: 0 0 4px; }
.lead { color: var(--muted); margin: 0 0 18px; font-size: 14px; }
.disclosure {
  background: var(--field); border: 1px solid var(--line); border-radius: 8px;
  padding: 12px 14px; max-height: 220px; overflow-y: auto; font-size: 13px;
  color: var(--muted); white-space: pre-wrap; margin-bottom: 14px;
}
label.check { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; cursor: pointer; }
label.check input { margin-top: 3px; }
.field { margin-bottom: 14px; }
.field label { display: block; font-size: 13px; color: var(--muted); margin-bottom: 6px; }
.field input[type=text], .field input[type=date], .field input[type=email] {
  width: 100%; background: var(--field); border: 1px solid var(--line);
  border-radius: 8px; color: var(--ink); padding: 10px 12px; font: inherit;
}
.sig-preview {
  background: #fff; color: #111; border-radius: 8px; padding: 10px 14px;
  min-height: 56px; display: flex; align-items: center;
  font-family: "Snell Roundhand", "Brush Script MT", "Segoe Script", cursive;
  font-size: 30px; line-height: 1; margin-top: 6px; overflow: hidden;
}
.sigtabs { display: flex; gap: 8px; margin: 6px 0; }
.sigtabs button { background: var(--field); border: 1px solid var(--line); color: var(--muted); border-radius: 8px; padding: 6px 14px; }
.sigtabs button.active { color: var(--ink); border-color: var(--brand); }
#sigCanvas { background: #fff; border: 1px solid var(--line); border-radius: 8px; touch-action: none; max-width: 100%; display: block; }
button {
  font: inherit; border: 0; border-radius: 8px; padding: 11px 16px; cursor: pointer;
}
.btn-primary { background: var(--brand); color: var(--brand-ink); font-weight: 600; width: 100%; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-ghost { background: transparent; color: var(--muted); width: 100%; margin-top: 8px; }
.legal { color: var(--muted); font-size: 12px; margin: 14px 0 0; }
.err { color: var(--danger); font-size: 13px; margin-top: 10px; min-height: 18px; }
.state { max-width: 460px; margin: 80px auto; padding: 0 20px; text-align: center; }
.state .big { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
.state.ok .big::before { content: ""; }
.badge {
  display: inline-block; width: 56px; height: 56px; border-radius: 50%;
  margin-bottom: 16px; line-height: 56px; font-size: 28px;
}
.badge.ok { background: rgba(63,179,127,0.15); color: var(--ok); }
.badge.no { background: rgba(224,85,107,0.15); color: var(--danger); }
.poweredby { color: var(--muted); font-size: 12px; margin-top: 22px; }
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
  document.body.innerHTML =
    '<div class="state ' + (kind==="ok"?"ok":"") + '">' +
      '<div class="badge ' + (kind==="ok"?"ok":"no") + '">' + (kind==="ok"?"\\u2713":"\\u00d7") + '</div>' +
      '<div class="big">' + esc(big) + '</div>' +
      '<div class="lead">' + esc(sub||"") + '</div>' +
      '<div class="poweredby">Secured by Penpact</div>' +
    '</div>';
}

function render(){
  $("docName").textContent = session.documentName || "Document";
  $("viewerFrame").src = api("/document#toolbar=1&view=FitH");
  if (session.consentRequired) renderConsent(); else renderSign();
}

function renderConsent(){
  const d = session.consentDisclosure || { text: "", hash: "" };
  $("panel").innerHTML =
    '<h2>Before you sign</h2>' +
    '<p class="lead">Federal law (the U.S. ESIGN Act) requires your consent to do business electronically.</p>' +
    '<div class="disclosure">' + esc(d.text) + '</div>' +
    '<label class="check"><input type="checkbox" id="agree"> ' +
      'I consent to use electronic records and signatures for this document.</label>' +
    '<div class="err" id="err"></div>' +
    '<button class="btn-primary" id="continueBtn" disabled style="margin-top:16px">Continue</button>';
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
    '<h2>Adopt your signature</h2>' +
    '<p class="lead">Type your full legal name, then type or draw your signature.</p>' +
    '<div class="field"><label for="fullName">Full name</label>' +
      '<input type="text" id="fullName" value="' + esc(name) + '" autocomplete="name"></div>' +
    '<div class="field"><label>Signature</label>' +
      '<div class="sigtabs"><button type="button" id="tabType" class="active">Type</button>' +
        '<button type="button" id="tabDraw">Draw</button></div>' +
      '<div id="typeWrap"><div class="sig-preview" id="sigPreview">' + esc(name) + '</div></div>' +
      '<div id="drawWrap" style="display:none">' +
        '<canvas id="sigCanvas" width="360" height="120"></canvas>' +
        '<button type="button" class="btn-ghost" id="clearCanvas" style="margin-top:6px">Clear</button>' +
      '</div></div>';

  const extra = myFields.filter(f => !["signature","initials","name"].includes(f.type));
  for (const f of extra) {
    const id = "f_" + f.id;
    if (f.type === "date") {
      html += fieldWrap(id, "Date", '<input type="date" id="'+id+'" value="'+today()+'">');
    } else if (f.type === "email") {
      html += fieldWrap(id, "Email", '<input type="email" id="'+id+'" value="'+esc(session.signer.email||"")+'">');
    } else if (f.type === "checkbox") {
      html += '<div class="field"><label class="check"><input type="checkbox" id="'+id+'"' + (f.required?" required":"") + '> I agree</label></div>';
    } else {
      html += fieldWrap(id, "Text" + (f.required?" (required)":""), '<input type="text" id="'+id+'">');
    }
  }

  html +=
    '<div class="err" id="err"></div>' +
    '<button class="btn-primary" id="signBtn">Sign document</button>' +
    '<button class="btn-ghost" id="declineBtn">Decline to sign</button>' +
    '<p class="legal">By clicking Sign document, you agree that this typed name is your ' +
      'signature on this document and is as legally binding as a handwritten one.</p>';

  $("panel").innerHTML = html;
  $("fullName").addEventListener("input", (e) => { $("sigPreview").textContent = e.target.value; });
  $("signBtn").addEventListener("click", () => submitSign(myFields));
  $("declineBtn").addEventListener("click", submitDecline);

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

async function submitSign(myFields){
  const btn = $("signBtn"); const err = $("err");
  err.textContent = "";
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
    let v = "";
    if (f.type === "signature") v = signatureValue || fullName;
    else if (f.type === "name") v = fullName;
    else if (f.type === "initials") v = initials;
    else {
      const el = document.getElementById("f_" + f.id);
      if (!el) continue;
      v = f.type === "checkbox" ? (el.checked ? "Yes" : "") : el.value.trim();
    }
    if (f.required && !v) { err.textContent = "Please complete all required fields."; return; }
    if (v) values.push({ fieldId: f.id, value: v });
  }

  btn.disabled = true; btn.textContent = "Signing\\u2026";
  try {
    const res = await fetch(api("/complete"), {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ signatureType: signMode === "draw" ? "drawn" : "typed", fields: values }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    showState("ok", "You're all set.", "This document has been signed. A copy and the certificate of completion will be available to the sender.");
  } catch (e) {
    err.textContent = "Could not submit your signature. Please try again.";
    btn.disabled = false; btn.textContent = "Sign document";
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
<title>Sign document - Penpact</title>
<style>${STYLES}</style>
</head>
<body>
<header class="top">
  <div class="logo">Pen<span>pact</span></div>
  <div class="doc-name" id="docName">Loading document...</div>
</header>
<div class="layout">
  <div class="viewer"><iframe id="viewerFrame" title="Document preview"></iframe></div>
  <aside class="panel" id="panel"><p class="lead">Loading...</p></aside>
</div>
<script>${SCRIPT(token)}</script>
</body>
</html>`;
}
