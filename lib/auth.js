// Passwords (scrypt), session tokens and small helpers for the HTTP API.
'use strict';
const crypto = require('crypto');

const COOKIE = 'bf_sid';
const SESSION_DAYS = 30;

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}
function checkPassword(pw, stored) {
  const [kind, saltHex, hashHex] = String(stored || '').split('$');
  if (kind !== 'scrypt' || !saltHex || !hashHex) return false;
  const want = Buffer.from(hashHex, 'hex');
  const got = crypto.scryptSync(String(pw), Buffer.from(saltHex, 'hex'), want.length);
  return crypto.timingSafeEqual(want, got);
}
const newToken = () => crypto.randomBytes(32).toString('base64url');
const hashToken = t => crypto.createHash('sha256').update(String(t)).digest('hex');

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function sessionCookie(token, req) {
  const secure = (req.headers['x-forwarded-proto'] || '').includes('https') || !!(req.socket && req.socket.encrypted);
  const age = token ? SESSION_DAYS * 86400 : 0;
  return `${COOKIE}=${token ? encodeURIComponent(token) : ''}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure ? '; Secure' : ''}`;
}

// names: 3-16 letters, digits, _ or -; passwords: 6-100 characters
const validName = n => /^[A-Za-z0-9_-]{3,16}$/.test(String(n || ''));
const validPassword = p => typeof p === 'string' && p.length >= 6 && p.length <= 100;

// a simple sliding-window limiter: allow `max` hits per `ms` for each key
function limiter(max, ms) {
  const hits = new Map();
  setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < ms)) hits.delete(k); }, ms).unref();
  return key => {
    const now = Date.now(), list = (hits.get(key) || []).filter(t => now - t < ms);
    if (list.length >= max) { hits.set(key, list); return false; }
    list.push(now); hits.set(key, list); return true;
  };
}

module.exports = { COOKIE, SESSION_DAYS, hashPassword, checkPassword, newToken, hashToken, parseCookies, sessionCookie, validName, validPassword, limiter };
