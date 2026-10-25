import { AuthError } from './auth.mjs';

export const SESSION_COOKIE_NAMES = ['sessionid', 'csrftoken', 'ds_user_id'];
const allowedDomains = new Set(['.instagram.com', 'instagram.com', 'www.instagram.com']);
const fail = () => { throw new AuthError('INVALID_COOKIES', 'Cookies inválidos: informe somente sessionid, csrftoken e ds_user_id válidos para o Instagram.'); };

export function isSessionCookie(cookie) {
  return SESSION_COOKIE_NAMES.includes(cookie.name) && allowedDomains.has(cookie.domain) && cookie.path === '/';
}

export function normalizeSessionCookies(input, now = Date.now()) {
  let entries;
  if (Array.isArray(input)) entries = input;
  else if (input && typeof input === 'object' && Object.getPrototypeOf(input) === Object.prototype) {
    entries = Object.entries(input).map(([name, value]) => ({ name, value }));
  } else return fail();
  if (entries.length !== 3) return fail();
  const seen = new Set();
  return entries.map(cookie => {
    if (!cookie || typeof cookie !== 'object' || Array.isArray(cookie)) return fail();
    const allowedKeys = ['name', 'value', 'domain', 'url', 'path', 'secure', 'httpOnly', 'sameSite', 'expires'];
    if (Object.keys(cookie).some(key => !allowedKeys.includes(key))) return fail();
    if (!SESSION_COOKIE_NAMES.includes(cookie.name) || seen.has(cookie.name)) return fail();
    seen.add(cookie.name);
    if (typeof cookie.value !== 'string' || cookie.value.length > 4096 ||
        !/^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]+$/.test(cookie.value)) return fail();
    if (cookie.name === 'ds_user_id' && !/^[1-9]\d*$/.test(cookie.value)) return fail();
    if (cookie.domain !== undefined && !allowedDomains.has(cookie.domain)) return fail();
    if (cookie.url !== undefined) {
      let url;
      try { url = new URL(cookie.url); } catch { return fail(); }
      if (url.origin !== 'https://www.instagram.com' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) return fail();
    }
    const httpOnly = cookie.name === 'sessionid';
    if ((cookie.path !== undefined && cookie.path !== '/') ||
        (cookie.secure !== undefined && cookie.secure !== true) ||
        (cookie.httpOnly !== undefined && cookie.httpOnly !== httpOnly) ||
        (cookie.sameSite !== undefined && !['None', 'Lax', 'Strict'].includes(cookie.sameSite))) return fail();
    // Sem validade informada, persistência local limitada a sete dias; o servidor continua decidindo a validade real.
    const expires = cookie.expires ?? Math.floor(now / 1000) + 7 * 86400;
    if (!Number.isFinite(expires) || (expires !== -1 && expires <= now / 1000)) return fail();
    return { name: cookie.name, value: cookie.value, domain: '.instagram.com', path: '/',
      secure: true, httpOnly, sameSite: cookie.sameSite ?? 'None', ...(expires === -1 ? {} : { expires }) };
  });
}

export function parseCookieInput(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 32768) return fail();
  let parsed;
  try { parsed = JSON.parse(text); } catch { return fail(); }
  normalizeSessionCookies(parsed);
  return parsed;
}
