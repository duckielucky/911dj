// Shared helpers for every 911.COM function.
const enc = new TextEncoder();

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
  });

const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = s => {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - s.length % 4) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};
const hmacKey = (secret, use) =>
  crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [use]);

/* ---- session cookie: "<expiry>.<epoch>.<hmac>" ----
   The epoch is bumped whenever the password changes, which invalidates every
   cookie issued under the old one. ---- */
export async function makeToken(secret, epoch, days = 30) {
  const payload = String(Date.now() + days * 86400000) + '.' + String(epoch || 0);
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), enc.encode(payload));
  return payload + '.' + b64url(sig);
}
export async function validToken(token, secret, epoch) {
  if (!token) return false;
  const parts = String(token).split('.');
  if (parts.length !== 3) return false;
  const [exp, ep, sig] = parts;
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  if (String(ep) !== String(epoch || 0)) return false;
  try {
    return await crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), unb64url(sig), enc.encode(exp + '.' + ep));
  } catch { return false; }
}
export function cookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}
export const SESSION = 'dj911_session';

/* ---- compare digests, not strings, so a wrong password leaks no timing ---- */
export async function sameSecret(a, b) {
  const [x, y] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(a ?? ''))),
    crypto.subtle.digest('SHA-256', enc.encode(String(b ?? '')))
  ]);
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < u.length; i++) diff |= u[i] ^ v[i];
  return diff === 0;
}

/* ---- the live password lives in KV; SITE_PASSWORD is only the initial one ----
   Cached per isolate for a minute so the gate does not read KV on every asset. */
const AUTH_KEY = 'auth';
let authCache = null, authAt = 0;
export async function getAuth(env) {
  const now = Date.now();
  if (authCache !== null && now - authAt < 60000) return authCache;
  let v = null;
  try { if (env.CONFIG) v = await env.CONFIG.get(AUTH_KEY, 'json'); } catch { v = null; }
  authCache = v; authAt = now;
  return v;
}
export async function setAuth(env, obj) {
  if (!env.CONFIG) throw new Error('no-kv');
  await env.CONFIG.put(AUTH_KEY, JSON.stringify(obj));
  authCache = obj; authAt = Date.now();
}
export async function authEpoch(env) {
  const a = await getAuth(env);
  return (a && a.epoch) || 0;
}
export const randHex = (n = 16) => {
  const a = new Uint8Array(n); crypto.getRandomValues(a);
  return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
};
export async function hashPw(pw, salt) {
  const key = await crypto.subtle.importKey('raw', enc.encode(String(pw)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(String(salt)), iterations: 100000, hash: 'SHA-256' }, key, 256);
  return b64url(bits);
}
/* Checks the KV password when one has been set, otherwise the deploy-time one. */
export async function checkPassword(env, pw) {
  const a = await getAuth(env);
  if (a && a.hash && a.salt) return sameSecret(await hashPw(pw, a.salt), a.hash);
  return sameSecret(pw, env.SITE_PASSWORD);
}

/* ---- storage may not be bound yet (no R2 bucket configured) ---- */
export const hasStore = env => !!(env && env.MEDIA);
export const noStore = () => json({ error: 'storage-not-configured' }, 503);

/* ---- the track index lives as one JSON object in R2 ---- */
const INDEX_KEY = 'index.json';
export async function readIndex(env) {
  const obj = await env.MEDIA.get(INDEX_KEY);
  if (!obj) return [];
  try { const v = await obj.json(); return Array.isArray(v) ? v : []; } catch { return []; }
}
export async function writeIndex(env, list) {
  await env.MEDIA.put(INDEX_KEY, JSON.stringify(list), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' }
  });
}
export const EXT_OK = /\.(mp3|m4a|aac|wav|flac|ogg|oga|opus|webm|aiff?)$/i;
export const safeExt = name => {
  const m = String(name || '').match(EXT_OK);
  return m ? m[0].toLowerCase() : '.mp3';
};
export const newId = () =>
  (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2));
