import { json, readIndex, writeIndex, safeExt, newId, EXT_OK } from '../_lib.js';

const MAX_BYTES = 60 * 1024 * 1024;   // one song; R2 free tier is 10 GB total

export async function onRequestPost({ request, env }) {
  let form;
  try { form = await request.formData(); }
  catch { return json({ error: 'expected multipart/form-data' }, 400); }

  const file = form.get('file');
  if (!file || typeof file === 'string') return json({ error: 'no file' }, 400);
  if (file.size > MAX_BYTES) return json({ error: 'file too large', max: MAX_BYTES }, 413);

  const isAudio = (file.type && file.type.startsWith('audio')) || EXT_OK.test(file.name || '');
  if (!isAudio) return json({ error: 'not an audio file' }, 415);

  let meta = {};
  try { meta = JSON.parse(form.get('meta') || '{}'); } catch { /* defaults below */ }

  const id = newId();
  const ext = safeExt(file.name || meta.fileName);
  const mediaKey = `audio/${id}${ext}`;

  await env.MEDIA.put(mediaKey, file.stream(), {
    httpMetadata: { contentType: file.type || 'audio/mpeg', cacheControl: 'private, max-age=31536000' }
  });

  let artKey = null;
  const art = form.get('art');
  if (art && typeof art !== 'string' && art.size > 0 && art.size < 8 * 1024 * 1024) {
    artKey = `cover/${id}`;
    await env.MEDIA.put(artKey, art.stream(), {
      httpMetadata: { contentType: art.type || 'image/jpeg', cacheControl: 'private, max-age=31536000' }
    });
  }

  const list = await readIndex(env);
  const track = {
    id,
    title:  String(meta.title  || file.name || '未命名').slice(0, 200),
    artist: String(meta.artist || '未知歌手').slice(0, 200),
    album:  String(meta.album  || '本地文件').slice(0, 200),
    duration: Number(meta.duration) || 0,
    fileName: String(file.name || id + ext).slice(0, 260),
    size: file.size,
    addedAt: Date.now(),
    order: list.reduce((m, t) => Math.max(m, t.order || 0), -1) + 1,
    plays: 0,
    liked: false,
    mediaKey,
    artKey
  };
  list.push(track);
  await writeIndex(env, list);
  return json({ track });
}
