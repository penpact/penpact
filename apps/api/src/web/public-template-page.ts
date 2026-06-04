/**
 * Public self-serve signing landing page, served at `GET /s/:slug`.
 *
 * Collects the signer's name + email, calls the public start endpoint to spin
 * up a fresh envelope from the template, and redirects to the hosted signing
 * page. Self-contained (inline CSS/JS, noindex).
 */
export function publicTemplatePageHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Sign a document - Penpact</title>
<style>
:root{--bg:#0b0c10;--panel:#14161d;--line:#262a35;--ink:#e8eaf0;--muted:#9aa3b2;--brand:#5b8cff;--field:#1d2029}
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{background:var(--bg);color:var(--ink);font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;display:flex;min-height:100%;align-items:center;justify-content:center}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:28px;max-width:420px;width:92%}
.logo{font-weight:700;margin-bottom:6px}.logo span{color:var(--brand)}
h1{font-size:20px;margin:8px 0 4px}.lead{color:var(--muted);margin:0 0 18px}
label{display:block;font-size:13px;color:var(--muted);margin:10px 0 6px}
input{width:100%;background:var(--field);border:1px solid var(--line);border-radius:9px;color:var(--ink);padding:10px 12px;font:inherit}
button{margin-top:16px;width:100%;background:var(--brand);color:#fff;font-weight:600;border:0;border-radius:9px;padding:11px;font:inherit;cursor:pointer}
button:disabled{opacity:.5;cursor:not-allowed}
.err{color:#e0556b;font-size:13px;min-height:18px;margin-top:8px}
.poweredby{color:var(--muted);font-size:12px;margin-top:16px;text-align:center}
</style>
</head>
<body>
<div class="card" id="root"><p class="lead">Loading…</p></div>
<script>
var slug = location.pathname.split('/').pop();
var $ = function(id){return document.getElementById(id);};
function esc(s){var d=document.createElement('div');d.textContent=s==null?'':String(s);return d.innerHTML;}
async function boot(){
  try{
    var res = await fetch('/v1/public/templates/' + encodeURIComponent(slug));
    if(!res.ok){ $('root').innerHTML = '<div class="logo">Pen<span>pact</span></div><h1>Link not available</h1><p class="lead">This signing link is no longer active.</p>'; return; }
    var meta = await res.json();
    $('root').innerHTML =
      '<div class="logo">Pen<span>pact</span></div>' +
      '<h1>' + esc(meta.name || meta.documentName || 'Sign a document') + '</h1>' +
      '<p class="lead">Enter your details to review and sign.</p>' +
      '<label for="name">Full name</label><input id="name" type="text" autocomplete="name">' +
      '<label for="email">Email</label><input id="email" type="email" autocomplete="email">' +
      '<button id="go">Continue to sign</button>' +
      '<div class="err" id="err"></div>' +
      (meta.attribution === false ? '' : '<div class="poweredby">Secured by Penpact</div>');
    $('go').onclick = start;
    $('email').addEventListener('keydown', function(e){ if(e.key==='Enter') start(); });
  }catch(e){ $('root').innerHTML = '<p class="lead">Could not load this page. Try again.</p>'; }
}
async function start(){
  var name = $('name').value.trim(), email = $('email').value.trim(), err = $('err');
  err.textContent='';
  if(!name){ err.textContent='Enter your name.'; return; }
  if(!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)){ err.textContent='Enter a valid email.'; return; }
  $('go').disabled = true;
  try{
    var res = await fetch('/v1/public/templates/' + encodeURIComponent(slug) + '/start', {
      method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ name: name, email: email })
    });
    if(!res.ok){ err.textContent = res.status===429 ? 'Too many requests, slow down.' : 'Could not start signing. Try again.'; $('go').disabled=false; return; }
    var body = await res.json();
    location.assign(body.signUrl);
  }catch(e){ err.textContent='Network error. Try again.'; $('go').disabled=false; }
}
boot();
</script>
</body>
</html>`;
}
