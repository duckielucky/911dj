import { json, makeToken, sameSecret, SESSION } from '../_lib.js';

// Small in-memory throttle. Isolates are short-lived, so this only blunts bursts.
const hits = new Map();

export async function onRequestPost({ request, env }) {
  const ip = request.headers.get('cf-connecting-ip') || 'anon';
  const now = Date.now();
  const rec = hits.get(ip) || { n: 0, until: 0 };
  if (rec.until > now) return json({ error: 'rate' }, 429);

  let password = '';
  try { ({ password } = await request.json()); } catch { /* empty body */ }

  if (await sameSecret(password, env.SITE_PASSWORD)) {
    hits.delete(ip);
    const token = await makeToken(env.SESSION_SECRET, 30);
    return json({ ok: true }, 200, {
      'set-cookie': `${SESSION}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 86400}`
    });
  }

  rec.n++;
  if (rec.n >= 6) { rec.until = now + 60000; rec.n = 0; }
  hits.set(ip, rec);
  await new Promise(r => setTimeout(r, 400));
  return json({ error: 'bad password' }, 401);
}
