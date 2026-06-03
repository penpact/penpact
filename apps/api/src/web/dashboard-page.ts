/**
 * Self-serve dashboard UI (v1, functional; visual polish comes later).
 *
 * A self-contained HTML page served at `GET /app` on the same origin as the
 * `/dashboard/*` API, so the httpOnly session cookie is sent automatically with
 * same-origin fetch (no CORS, no cross-site cookie config). It is a thin client
 * over the dashboard API: sign up / log in, create and revoke API keys (the
 * secret is shown once), and see usage.
 */

const STYLES = `
:root {
  --bg:#0b0c10; --panel:#14161d; --line:#262a35; --ink:#e8eaf0; --muted:#9aa3b2;
  --brand:#5b8cff; --brand2:#7aa2ff; --ok:#3fb37f; --danger:#e0556b; --field:#1d2029;
  --code:#11131a; --radius:12px;
}
*{box-sizing:border-box}
html,body{margin:0;height:100%}
body{background:var(--bg);color:var(--ink);font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--brand2);text-decoration:none}
a:hover{text-decoration:underline}
code,pre{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
header.top{display:flex;align-items:center;gap:12px;padding:14px 22px;border-bottom:1px solid var(--line);background:var(--panel)}
.logo{font-weight:700;letter-spacing:-.02em}
.logo span{color:var(--brand)}
.top .right{margin-left:auto;display:flex;align-items:center;gap:16px;font-size:14px;color:var(--muted)}
.wrap{max-width:880px;margin:0 auto;padding:28px 22px}
h1{font-size:22px;letter-spacing:-.02em;margin:0 0 4px}
h2{font-size:16px;margin:28px 0 12px}
.lead{color:var(--muted);margin:0 0 18px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);padding:18px 20px;margin-bottom:16px}
label{display:block;font-size:13px;color:var(--muted);margin:0 0 6px}
input[type=text],input[type=email],input[type=password]{width:100%;background:var(--field);border:1px solid var(--line);border-radius:9px;color:var(--ink);padding:10px 12px;font:inherit}
button{font:inherit;border:0;border-radius:9px;padding:10px 16px;cursor:pointer}
.btn-primary{background:var(--brand);color:#fff;font-weight:600}
.btn-primary:disabled{opacity:.5;cursor:not-allowed}
.btn-ghost{background:transparent;color:var(--muted);border:1px solid var(--line)}
.btn-danger{background:transparent;color:var(--danger);border:1px solid var(--line);padding:6px 12px;font-size:13px}
.row{display:flex;gap:10px;align-items:center}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.stat{background:var(--field);border:1px solid var(--line);border-radius:10px;padding:14px}
.stat .n{font-size:24px;font-weight:700}
.stat .l{font-size:12px;color:var(--muted)}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--line)}
th{color:var(--muted);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.03em}
.mono{font-family:ui-monospace,Menlo,Consolas,monospace}
.muted{color:var(--muted)}
.revoked{opacity:.5}
.pill{display:inline-block;font-size:11px;border:1px solid var(--line);border-radius:999px;padding:1px 8px;color:var(--muted)}
.secret{background:var(--code);border:1px solid var(--brand);border-radius:9px;padding:12px 14px;margin-top:10px}
.secret .key{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:14px;word-break:break-all;color:var(--ok)}
.secret .warn{font-size:12px;color:var(--muted);margin-top:6px}
pre{background:var(--code);border:1px solid var(--line);border-radius:10px;padding:14px 16px;overflow-x:auto;font-size:13px}
.err{color:var(--danger);font-size:13px;min-height:18px;margin-top:8px}
.tabs{display:flex;gap:8px;margin-bottom:16px}
.tabs button{background:transparent;color:var(--muted);border:1px solid var(--line)}
.tabs button.active{color:var(--ink);border-color:var(--brand)}
.center{max-width:380px;margin:8vh auto 0}
.hide{display:none}
@media(max-width:560px){.stats{grid-template-columns:1fr}}
`;

const SCRIPT = `
const api = (p, opts) => fetch('/dashboard' + p, Object.assign({ headers: { 'content-type':'application/json' } }, opts));
const $ = (id) => document.getElementById(id);
function esc(s){const d=document.createElement('div');d.textContent=s==null?'':String(s);return d.innerHTML;}
function fmtDate(s){ if(!s) return '-'; const d=new Date(s); return d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); }
function qp(){ return new URLSearchParams(location.search); }
function clearQuery(){ history.replaceState({}, '', location.pathname); }

async function boot(){
  const p = qp();
  if (p.get('reset')) { renderReset(p.get('reset')); return; }
  let banner = '';
  if (p.get('verify')) {
    const r = await api('/auth/verify-email', { method:'POST', body: JSON.stringify({ token: p.get('verify') }) });
    banner = r.ok ? 'Your email is verified.' : 'That verification link is invalid or expired.';
    clearQuery();
  }
  const me = await api('/me');
  if (me.status === 200) { renderApp(await me.json(), banner); }
  else { renderAuth(banner); }
}

function renderReset(token){
  $('root').innerHTML =
    '<div class="center"><h1>Set a new password</h1>' +
      '<div class="card"><div class="row" style="flex-direction:column;align-items:stretch;gap:12px">' +
        '<div><label for="newpw">New password</label><input id="newpw" type="password" autocomplete="new-password" placeholder="At least 8 characters"></div>' +
        '<button class="btn-primary" id="resetBtn">Update password</button>' +
        '<div class="err" id="rerr"></div>' +
      '</div></div></div>';
  $('resetBtn').onclick = async () => {
    const pw = $('newpw').value; const err = $('rerr'); err.textContent='';
    if (pw.length < 8){ err.textContent='Password must be at least 8 characters.'; return; }
    $('resetBtn').disabled = true;
    const r = await api('/auth/reset-password', { method:'POST', body: JSON.stringify({ token, password: pw }) });
    if (r.ok) {
      $('root').innerHTML = '<div class="center"><h1>Password updated</h1><p class="lead">Log in with your new password.</p><button class="btn-primary" id="toLogin">Go to login</button></div>';
      $('toLogin').onclick = () => { location.assign('/app'); };
    } else { err.textContent='That reset link is invalid or expired.'; $('resetBtn').disabled=false; }
  };
}

// ── Auth ──
function renderAuth(banner){
  let mode = 'login';
  const root = $('root');
  const note = banner ? '<div class="secret" style="border-color:var(--ok)"><div class="muted" style="font-size:13px">'+esc(banner)+'</div></div>' : '';
  root.innerHTML =
    '<div class="center">' +
      '<h1>Penpact dashboard</h1>' +
      '<p class="lead">Sign in to manage your API keys.</p>' +
      note +
      '<div class="card">' +
        '<div class="tabs"><button id="tabLogin" class="active">Log in</button><button id="tabSignup">Sign up</button></div>' +
        '<div class="row" style="flex-direction:column;align-items:stretch;gap:12px">' +
          '<div><label for="email">Email</label><input id="email" type="email" autocomplete="email"></div>' +
          '<div><label for="password">Password</label><input id="password" type="password" autocomplete="current-password" placeholder="At least 8 characters"></div>' +
          '<button class="btn-primary" id="submitBtn">Log in</button>' +
          '<a href="#" id="forgot" class="muted" style="font-size:13px">Forgot password?</a>' +
          '<div class="err" id="err"></div>' +
        '</div>' +
      '</div>' +
    '</div>';
  const setMode = (m) => {
    mode = m;
    $('tabLogin').classList.toggle('active', m==='login');
    $('tabSignup').classList.toggle('active', m==='signup');
    $('submitBtn').textContent = m==='login' ? 'Log in' : 'Create account';
    $('password').setAttribute('autocomplete', m==='login'?'current-password':'new-password');
    $('err').textContent='';
  };
  $('tabLogin').onclick = () => setMode('login');
  $('tabSignup').onclick = () => setMode('signup');
  $('submitBtn').onclick = () => submitAuth(mode);
  $('password').addEventListener('keydown', (e)=>{ if(e.key==='Enter') submitAuth(mode); });
  $('forgot').onclick = (e) => { e.preventDefault(); renderForgot(); };
}

function renderForgot(){
  $('root').innerHTML =
    '<div class="center"><h1>Reset your password</h1>' +
      '<p class="lead">We will email you a reset link if the address has an account.</p>' +
      '<div class="card"><div class="row" style="flex-direction:column;align-items:stretch;gap:12px">' +
        '<div><label for="remail">Email</label><input id="remail" type="email" autocomplete="email"></div>' +
        '<button class="btn-primary" id="reqBtn">Send reset link</button>' +
        '<a href="#" id="backLogin" class="muted" style="font-size:13px">Back to login</a>' +
        '<div class="err" id="rerr"></div>' +
      '</div></div></div>';
  $('backLogin').onclick = (e) => { e.preventDefault(); renderAuth(''); };
  $('reqBtn').onclick = async () => {
    const email = $('remail').value.trim(); const err = $('rerr'); err.textContent='';
    if (!email) { err.textContent='Enter your email.'; return; }
    $('reqBtn').disabled = true;
    await api('/auth/request-reset', { method:'POST', body: JSON.stringify({ email }) });
    $('root').innerHTML = '<div class="center"><h1>Check your email</h1><p class="lead">If an account exists for '+esc(email)+', a password reset link is on its way.</p><button class="btn-primary" id="toLogin">Back to login</button></div>';
    $('toLogin').onclick = () => renderAuth('');
  };
}

async function submitAuth(mode){
  const btn = $('submitBtn'); const err = $('err'); err.textContent='';
  const email = $('email').value.trim(); const password = $('password').value;
  if(!email || password.length < 8){ err.textContent='Enter an email and a password of at least 8 characters.'; return; }
  btn.disabled = true;
  try {
    const res = await api('/auth/' + (mode==='signup'?'signup':'login'), { method:'POST', body: JSON.stringify({ email, password }) });
    if (res.ok) { boot(); return; }
    const body = await res.json().catch(()=>({}));
    err.textContent = body.detail || (res.status===409?'That email is already registered.':'Could not sign you in.');
  } catch(e){ err.textContent='Network error. Try again.'; }
  btn.disabled = false;
}

// ── App ──
async function renderApp(me, banner){
  const root = $('root');
  let notice = '';
  if (banner) notice += '<div class="card" style="border-color:var(--ok)"><span class="muted">'+esc(banner)+'</span></div>';
  if (me && me.emailVerified === false) notice += '<div class="card" style="border-color:var(--brand)"><span class="muted">Please verify your email. We sent a link to '+esc(me.email)+'.</span></div>';
  root.innerHTML =
    '<header class="top"><div class="logo">Pen<span>pact</span> dashboard</div>' +
      '<div class="right"><span>'+esc(me.email)+'</span><a href="#" id="logout">Log out</a></div></header>' +
    '<div class="wrap">' +
      notice +
      '<div id="stats" class="stats"></div>' +
      '<h2>API keys</h2>' +
      '<div class="card">' +
        '<div class="row"><div style="flex:1"><label for="keyName">Key name</label><input id="keyName" type="text" placeholder="e.g. production"></div>' +
          '<button class="btn-primary" id="createKey" style="align-self:flex-end">Create key</button></div>' +
        '<div id="secretBox"></div>' +
        '<div class="err" id="keyErr"></div>' +
      '</div>' +
      '<div class="card" id="keysCard"><p class="muted">Loading keys...</p></div>' +
      '<h2>Envelopes</h2>' +
      '<div class="card" id="envCard"><p class="muted">Loading envelopes…</p></div>' +
      '<h2>Use your key</h2>' +
      '<pre id="snippet"></pre>' +
    '</div>';
  $('logout').onclick = async (e)=>{ e.preventDefault(); await api('/auth/logout',{method:'POST'}); boot(); };
  $('createKey').onclick = createKey;
  $('keyName').addEventListener('keydown',(e)=>{ if(e.key==='Enter') createKey(); });
  $('snippet').textContent =
    "import { PenpactClient } from '@penpact/sdk';\\n\\n" +
    "const penpact = new PenpactClient({ apiKey: process.env.PENPACT_API_KEY! });\\n" +
    "const envelope = await penpact.createEnvelope({\\n" +
    "  documentName: 'NDA',\\n" +
    "  signers: [{ name: 'Ada', email: 'ada@example.com' }],\\n" +
    "});";
  await Promise.all([loadStats(), loadKeys(), loadEnvelopes()]);
}

async function loadEnvelopes(){
  const res = await api('/envelopes'); const card = $('envCard');
  if(!res.ok){ card.innerHTML='<p class="muted">Could not load envelopes.</p>'; return; }
  const list = (await res.json()).data || [];
  if(!list.length){ card.innerHTML='<p class="muted">No envelopes yet. Create one with your API key or the SDK.</p>'; return; }
  const rows = list.map((e)=>{
    const done = e.status === 'completed';
    const dl = '<a href="/dashboard/envelopes/'+esc(e.id)+'/document" target="_blank" rel="noopener">'+(done?'Signed PDF':'Current PDF')+'</a>'+
      (done ? ' · <a href="/dashboard/envelopes/'+esc(e.id)+'/certificate" target="_blank" rel="noopener">Certificate</a>' : '');
    return '<tr>'+
      '<td>'+esc(e.documentName)+'</td>'+
      '<td><span class="pill">'+esc(e.status)+'</span></td>'+
      '<td class="muted">'+fmtDate(e.createdAt)+'</td>'+
      '<td class="muted">'+fmtDate(e.completedAt)+'</td>'+
      '<td>'+dl+'</td>'+
    '</tr>';
  }).join('');
  card.innerHTML = '<table><thead><tr><th>Document</th><th>Status</th><th>Created</th><th>Completed</th><th>Download</th></tr></thead><tbody>'+rows+'</tbody></table>';
}

async function loadStats(){
  const res = await api('/usage'); if(!res.ok) return;
  const u = await res.json();
  $('stats').innerHTML =
    stat(u.envelopesTotal, 'Envelopes (total)') +
    stat(u.envelopesThisMonth, 'This month') +
    stat(u.activeKeys, 'Active keys');
}
function stat(n,l){ return '<div class="stat"><div class="n">'+esc(n)+'</div><div class="l">'+esc(l)+'</div></div>'; }

async function loadKeys(){
  const res = await api('/api-keys'); const card = $('keysCard');
  if(!res.ok){ card.innerHTML='<p class="muted">Could not load keys.</p>'; return; }
  const keys = (await res.json()).data || [];
  if(!keys.length){ card.innerHTML='<p class="muted">No keys yet. Create one above.</p>'; return; }
  let rows = keys.map((k)=>{
    const revoked = k.revokedAt != null;
    return '<tr class="'+(revoked?'revoked':'')+'">'+
      '<td>'+esc(k.name)+'</td>'+
      '<td class="mono">'+esc(k.prefix)+'…</td>'+
      '<td class="muted">'+fmtDate(k.createdAt)+'</td>'+
      '<td>'+(revoked?'<span class="pill">revoked</span>':'<button class="btn-danger" data-revoke="'+esc(k.id)+'">Revoke</button>')+'</td>'+
    '</tr>';
  }).join('');
  card.innerHTML = '<table><thead><tr><th>Name</th><th>Key</th><th>Created</th><th></th></tr></thead><tbody>'+rows+'</tbody></table>';
  card.querySelectorAll('[data-revoke]').forEach((b)=>{ b.onclick = ()=>revokeKey(b.getAttribute('data-revoke')); });
}

async function createKey(){
  const btn=$('createKey'); const err=$('keyErr'); err.textContent='';
  const name = ($('keyName').value.trim()) || 'default';
  btn.disabled = true;
  try{
    const res = await api('/api-keys',{ method:'POST', body: JSON.stringify({ name }) });
    if(!res.ok){ err.textContent='Could not create the key.'; btn.disabled=false; return; }
    const k = await res.json();
    $('keyName').value='';
    $('secretBox').innerHTML =
      '<div class="secret"><div class="muted" style="font-size:12px;margin-bottom:4px">New key “'+esc(k.name)+'” — copy it now</div>'+
      '<div class="key" id="newKey">'+esc(k.key)+'</div>'+
      '<div class="warn">This is the only time the full key is shown. Store it somewhere safe.</div></div>';
    await Promise.all([loadKeys(), loadStats()]);
  }catch(e){ err.textContent='Network error. Try again.'; }
  btn.disabled=false;
}

async function revokeKey(id){
  if(!window.confirm('Revoke this key? Any integration using it will stop working immediately.')) return;
  const res = await api('/api-keys/'+id,{ method:'DELETE' });
  if(res.ok || res.status===204){ await Promise.all([loadKeys(), loadStats()]); }
}

boot();
`;

export function dashboardPageHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Penpact dashboard</title>
<style>${STYLES}</style>
</head>
<body>
<div id="root"><div class="center"><p class="muted">Loading…</p></div></div>
<script>${SCRIPT}</script>
</body>
</html>`;
}
