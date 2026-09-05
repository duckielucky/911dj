// Serves audio and cover art straight out of R2, with byte-range support so
// seeking in a long track does not download the whole file.
const ALLOWED = /^(audio|cover)\//;

export async function onRequestGet({ params, request, env }) {
  if (!env || !env.MEDIA) return new Response('Storage not configured', { status: 503 });
  const key = Array.isArray(params.path) ? params.path.join('/') : String(params.path || '');
  if (!ALLOWED.test(key)) return new Response('Not found', { status: 404 });

  const obj = await env.MEDIA.get(key, { range: request.headers });
  if (!obj) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('accept-ranges', 'bytes');
  headers.set('cache-control', 'private, max-age=31536000');

  if (obj.range && typeof obj.range.offset === 'number') {
    const start = obj.range.offset;
    const end = start + (obj.range.length ?? (obj.size - start)) - 1;
    headers.set('content-range', `bytes ${start}-${end}/${obj.size}`);
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set('content-length', String(obj.size));
  return new Response(obj.body, { status: 200, headers });
}
