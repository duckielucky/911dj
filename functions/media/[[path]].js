// Serves audio and cover art. R2 supports byte ranges so seeking a long track
// does not pull the whole file; KV can only hand back the entire value, so the
// range is sliced here instead.
const ALLOWED = /^(audio|cover)\//;

export async function onRequestGet({ params, request, env }) {
  const key = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '');
  if (!ALLOWED.test(key)) return new Response('Not found', { status: 404 });

  if (env.MEDIA) {
    const obj = await env.MEDIA.get(key, { range: request.headers });
    if (!obj) return new Response('Not found', { status: 404 });
    const h = new Headers();
    obj.writeHttpMetadata(h);
    h.set('etag', obj.httpEtag);
    h.set('accept-ranges', 'bytes');
    h.set('cache-control', 'private, max-age=31536000');
    if (obj.range && typeof obj.range.offset === 'number') {
      const start = obj.range.offset;
      const end = start + (obj.range.length ?? (obj.size - start)) - 1;
      h.set('content-range', `bytes ${start}-${end}/${obj.size}`);
      return new Response(obj.body, { status: 206, headers: h });
    }
    h.set('content-length', String(obj.size));
    return new Response(obj.body, { status: 200, headers: h });
  }

  if (!env.CONFIG) return new Response('Storage not configured', { status: 503 });
  const res = await env.CONFIG.getWithMetadata(key, 'arrayBuffer');
  const buf = res && res.value;
  if (!buf) return new Response('Not found', { status: 404 });
  const ct = (res.metadata && res.metadata.ct) || 'application/octet-stream';
  const total = buf.byteLength;

  const h = new Headers({ 'content-type': ct, 'accept-ranges': 'bytes', 'cache-control': 'private, max-age=31536000' });
  const range = request.headers.get('range');
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  if (m) {
    let start = m[1] ? parseInt(m[1], 10) : 0;
    let end = m[2] ? parseInt(m[2], 10) : total - 1;
    if (isNaN(start) || start < 0) start = 0;
    if (isNaN(end) || end >= total) end = total - 1;
    if (start > end) return new Response('Range Not Satisfiable', { status: 416, headers: { 'content-range': `bytes */${total}` } });
    const slice = buf.slice(start, end + 1);
    h.set('content-range', `bytes ${start}-${end}/${total}`);
    h.set('content-length', String(slice.byteLength));
    return new Response(slice, { status: 206, headers: h });
  }
  h.set('content-length', String(total));
  return new Response(buf, { status: 200, headers: h });
}
