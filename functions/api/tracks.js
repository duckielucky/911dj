// Bulk metadata update. Reordering the grid touches every track at once, and doing
// that as N separate requests would race: each one reads index.json, mutates its own
// copy and writes it back, so all but the last write are lost. One request, one
// read-modify-write, no lost updates.
import { json, readIndex, writeIndex, hasStore, noStore } from '../_lib.js';

const FIELDS = ['title', 'artist', 'album', 'order', 'plays', 'liked', 'duration'];
const MAX = 2000;

export async function onRequestPatch({ request, env }) {
  if (!hasStore(env)) return noStore();
  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400); }

  const updates = Array.isArray(body && body.updates) ? body.updates : null;
  if (!updates) return json({ error: 'expected {updates:[...]}' }, 400);
  if (updates.length > MAX) return json({ error: 'too many updates' }, 413);

  const list = await readIndex(env);
  const byId = new Map(list.map(t => [t.id, t]));
  let changed = 0;

  for (const u of updates) {
    const t = u && byId.get(u.id);
    if (!t) continue;
    for (const k of FIELDS) {
      if (!(k in u)) continue;
      if (k === 'liked') t.liked = !!u.liked;
      else if (k === 'order' || k === 'plays' || k === 'duration') t[k] = Number(u[k]) || 0;
      else t[k] = String(u[k]).slice(0, 200);
    }
    changed++;
  }
  if (changed) await writeIndex(env, list);
  return json({ ok: true, changed });
}
