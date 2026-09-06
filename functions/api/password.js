// Change the access password from inside the site. The new one is stored in KV
// as a PBKDF2 hash, and bumping the epoch invalidates every session issued under
// the old password — including on other devices.
import { json, checkPassword, setAuth, hashPw, randHex, makeToken, SESSION } from '../_lib.js';

const MIN = 6;

export async function onRequestPost({ request, env }) {
  if (!env.CONFIG) return json({ error: 'no-kv', message: '尚未绑定 KV，无法保存新密码' }, 503);

  let body = {};
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }

  const current = String(body.current || '');
  const next = String(body.next || '');

  if (!await checkPassword(env, current)) {
    await new Promise(r => setTimeout(r, 400));
    return json({ error: 'wrong-current', message: '当前密码不正确' }, 401);
  }
  if (next.length < MIN) return json({ error: 'too-short', message: `新密码至少 ${MIN} 位` }, 400);
  if (next === current) return json({ error: 'same', message: '新密码与当前密码相同' }, 400);

  const salt = randHex(16);
  const epoch = Date.now();
  await setAuth(env, { salt, hash: await hashPw(next, salt), epoch });

  // Keep this device signed in; every other session is now invalid.
  const token = await makeToken(env.SESSION_SECRET, epoch, 30);
  return json({ ok: true, message: '密码已更新，其他设备需要重新登录' }, 200, {
    'set-cookie': `${SESSION}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 86400}`
  });
}
