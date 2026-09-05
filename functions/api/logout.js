import { json, SESSION } from '../_lib.js';

export const onRequestPost = () => json({ ok: true }, 200, {
  'set-cookie': `${SESSION}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
});
