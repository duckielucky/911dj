import { json, readIndex, writeIndex } from '../../_lib.js';

const FIELDS = ['title', 'artist', 'album', 'order', 'plays', 'liked', 'duration'];

export async function onRequestPatch({ params, request, env }) {
  const list = await readIndex(env);
  const t = list.find(x => x.id === params.id);
  if (!t) return json({ error: 'not found' }, 404);

  let patch = {};
  try { patch = await request.json(); } catch { return json({ error: 'bad json' }, 400); }

  for (const k of FIELDS) {
    if (!(k in patch)) continue;
    if (k === 'liked') t.liked = !!patch.liked;
    else if (k === 'order' || k === 'plays' || k === 'duration') t[k] = Number(patch[k]) || 0;
    else t[k] = String(patch[k]).slice(0, 200);
  }
  await writeIndex(env, list);
  return json({ track: t });
}

export async function onRequestDelete({ params, env }) {
  const list = await readIndex(env);
  const i = list.findIndex(x => x.id === params.id);
  if (i < 0) return json({ error: 'not found' }, 404);

  const [t] = list.splice(i, 1);
  await writeIndex(env, list);
  await env.MEDIA.delete(t.mediaKey).catch(() => {});
  if (t.artKey) await env.MEDIA.delete(t.artKey).catch(() => {});
  return json({ ok: true });
}
