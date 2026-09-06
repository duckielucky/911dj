// Gates the entire site. Nothing — page, audio or API — is reachable without the password.
import { validToken, cookie, SESSION, authEpoch } from './_lib.js';

const OPEN_PATHS = new Set(['/api/login']);

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  const missing = [];
  if (!env.SITE_PASSWORD) missing.push('SITE_PASSWORD');
  if (!env.SESSION_SECRET) missing.push('SESSION_SECRET');
  if (missing.length) {
    return new Response(setupPage(missing), { status: 503, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  if (OPEN_PATHS.has(url.pathname)) return next();

  const ok = await validToken(cookie(request, SESSION), env.SESSION_SECRET, await authEpoch(env));
  if (ok) {
    const res = await next();
    const out = new Response(res.body, res);
    out.headers.set('x-frame-options', 'DENY');
    out.headers.set('referrer-policy', 'no-referrer');
    return out;
  }

  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/media/')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
    });
  }
  return new Response(loginPage(), {
    status: 401,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
  });
}

const SHELL = (title, body) => `<!DOCTYPE html><html lang="zh-CN"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#02040c;color:#eaf0ff;padding:24px;
 font-family:"PingFang SC","Hiragino Sans GB","Microsoft YaHei",Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
body::before{content:"";position:fixed;inset:0;z-index:-1;background:
 radial-gradient(820px 520px at 76% -10%,rgba(124,58,237,.26),transparent 62%),
 radial-gradient(700px 420px at 10% 6%,rgba(34,167,255,.16),transparent 60%),#02040c}
.box{width:min(392px,100%);border:1px solid rgba(120,165,255,.18);border-radius:20px;padding:32px 28px;
 background:rgba(255,255,255,.022);box-shadow:0 32px 90px rgba(0,0,0,.7)}
.mark{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;margin-bottom:20px;
 background:radial-gradient(circle at 34% 30%,#2a3350,#0a0f1e 70%);border:1px solid rgba(140,180,255,.22);
 box-shadow:0 0 26px rgba(90,120,255,.32)}
h1{margin:0;font-size:27px;font-weight:900;font-style:italic;letter-spacing:-.6px}
h1 i{font-style:italic;background:linear-gradient(92deg,#3fb6ff,#22a7ff);-webkit-background-clip:text;background-clip:text;color:transparent}
.tag{margin-top:6px;font-size:8.5px;letter-spacing:.34em;color:#5d6a85;font-weight:700}
p{margin:22px 0 0;color:#9aa4ba;font-size:13.5px;line-height:1.7}
label{display:block;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:#6b7690;font-weight:800;margin:24px 0 8px}
input{width:100%;padding:13px 14px;font-size:15px;color:#fff;outline:none;border-radius:11px;
 background:rgba(255,255,255,.04);border:1px solid rgba(120,165,255,.18)}
input:focus{border-color:rgba(150,110,255,.6)}
button{width:100%;margin-top:18px;height:46px;border:0;border-radius:999px;cursor:pointer;color:#fff;font-size:14.5px;font-weight:800;
 font-family:inherit;background:linear-gradient(100deg,#7c3aed,#c026d3 60%,#e0359b);box-shadow:0 10px 30px rgba(160,50,220,.35)}
button:disabled{opacity:.6;cursor:default}
.err{margin-top:14px;font-size:13px;color:#ff7d97;min-height:18px}
code{background:rgba(255,255,255,.06);padding:2px 7px;border-radius:6px;font-size:12.5px}
</style></head><body><div class="box">
<div class="mark"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9fb6ff" stroke-width="1.9" stroke-linecap="round">
<path d="M4 14v-2a8 8 0 0116 0v2"/><rect x="2.5" y="13.5" width="4.2" height="7" rx="2.1" fill="#9fb6ff" stroke="none"/>
<rect x="17.3" y="13.5" width="4.2" height="7" rx="2.1" fill="#9fb6ff" stroke="none"/></svg></div>
<h1>911<i>.COM</i></h1><div class="tag">MUSIC BEYOND LIMITS</div>
${body}</div></body></html>`;

const loginPage = () => SHELL('911.COM · 登录', `
<p>这是一个私人音乐库。请输入访问密码。</p>
<label for="pw">访问密码</label>
<input id="pw" type="password" autocomplete="current-password" autofocus>
<button id="go">进入</button>
<div class="err" id="err"></div>
<script>
const pw = document.getElementById('pw'), go = document.getElementById('go'), err = document.getElementById('err');
async function submit(){
  if(!pw.value){ pw.focus(); return; }
  go.disabled = true; err.textContent = '';
  try{
    const r = await fetch('/api/login', {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ password: pw.value })
    });
    if(r.ok){ location.replace('/'); return; }
    const d = await r.json().catch(() => ({}));
    err.textContent = d.error === 'rate' ? '尝试过于频繁，请稍后再试。' : '密码不正确。';
  }catch(e){ err.textContent = '网络错误，请重试。'; }
  go.disabled = false; pw.select();
}
go.addEventListener('click', submit);
pw.addEventListener('keydown', e => { if(e.key === 'Enter') submit(); });
</script>`);

const setupPage = (missing = []) => SHELL('911.COM · 待配置', `
<p>还差最后一步：在 Cloudflare Pages 项目 <code>911</code> 的
<code>设置 → 环境变量 → Production</code> 中添加
${missing.map(m => `<code>${m}</code>`).join(' 和 ')}（勾选 Encrypt），保存后重新部署一次。</p>
<p style="color:#6b7690;font-size:12.5px">域名、HTTPS 与密码保护程序都已就绪，设好密码后这里就会变成登录页。</p>`);
