import { json, readIndex, hasStore, noStore } from '../_lib.js';

export async function onRequestGet({ env }) {
  if (!hasStore(env)) return noStore();
  const list = await readIndex(env);
  list.sort((a, b) => (a.order - b.order) || (a.addedAt - b.addedAt));
  return json({ tracks: list });
}
