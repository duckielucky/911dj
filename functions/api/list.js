import { json, readIndex } from '../_lib.js';

export async function onRequestGet({ env }) {
  const list = await readIndex(env);
  list.sort((a, b) => (a.order - b.order) || (a.addedAt - b.addedAt));
  return json({ tracks: list });
}
