// "Continue with Google / Discord": the standard OAuth 2.0 authorisation-code flow.
// A provider switches on when its client ID and secret are set as environment variables.
'use strict';
const crypto = require('crypto');

const PROVIDERS = {
  google: {
    name: 'Google',
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    userinfo: 'https://openidconnect.googleapis.com/v1/userinfo',
    scope: 'openid profile',
    extra: { prompt: 'select_account' },
    id: u => u.sub, suggest: u => u.given_name || u.name || '',
  },
  discord: {
    name: 'Discord',
    authorize: 'https://discord.com/oauth2/authorize',
    token: 'https://discord.com/api/oauth2/token',
    userinfo: 'https://discord.com/api/users/@me',
    scope: 'identify',
    extra: {},
    id: u => u.id, suggest: u => u.global_name || u.username || '',
  },
};
const env = k => process.env[k] || '';
const creds = p => ({ id: env(p.toUpperCase() + '_CLIENT_ID'), secret: env(p.toUpperCase() + '_CLIENT_SECRET') });
const enabled = () => Object.keys(PROVIDERS).filter(p => { const c = creds(p); return c.id && c.secret; });
// only for the automated tests: send every provider to a local stand-in
const endpoint = (p, kind) => (env('OAUTH_TEST_BASE') ? `${env('OAUTH_TEST_BASE')}/${p}/${kind}` : PROVIDERS[p][kind]);

// short-lived signed values kept in cookies (the login attempt's state, and a sign-up waiting for a name)
const SECRET = env('SESSION_SECRET') || crypto.randomBytes(32).toString('hex');
function seal(obj, minutes) {
  const body = Buffer.from(JSON.stringify(Object.assign({ exp: Date.now() + minutes * 60000 }, obj))).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
}
function unseal(v) {
  const [body, sig] = String(v || '').split('.');
  if (!body || !sig) return null;
  const want = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  try { const o = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); return o.exp > Date.now() ? o : null; } catch (e) { return null; }
}

function baseUrl(req) {
  if (env('PUBLIC_URL')) return env('PUBLIC_URL').replace(/\/+$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || (req.socket.encrypted ? 'https' : 'http')).split(',')[0].trim();
  return `${proto}://${req.headers.host}`;
}
const redirectUri = (req, p) => `${baseUrl(req)}/auth/${p}/callback`;

function authorizeUrl(req, p, state) {
  const q = new URLSearchParams(Object.assign({ client_id: creds(p).id, redirect_uri: redirectUri(req, p), response_type: 'code', scope: PROVIDERS[p].scope, state }, PROVIDERS[p].extra));
  return endpoint(p, 'authorize') + '?' + q;
}
// swap the one-time code for the provider's idea of who this is
async function identify(req, p, code) {
  const c = creds(p);
  const tr = await fetch(endpoint(p, 'token'), {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ client_id: c.id, client_secret: c.secret, code, grant_type: 'authorization_code', redirect_uri: redirectUri(req, p) }),
  });
  const tok = await tr.json().catch(() => ({}));
  if (!tr.ok || !tok.access_token) throw new Error('token');
  const ur = await fetch(endpoint(p, 'userinfo'), { headers: { Authorization: 'Bearer ' + tok.access_token, Accept: 'application/json' } });
  const u = await ur.json().catch(() => ({}));
  const id = ur.ok && PROVIDERS[p].id(u);
  if (!id) throw new Error('userinfo');
  return { id: String(id), suggest: PROVIDERS[p].suggest(u) };
}
// a usable account name from whatever the provider calls you
function suggestName(s) {
  let n = String(s || '').normalize('NFKD').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 16);
  if (n.length < 3) n = 'Archer' + Math.floor(100 + Math.random() * 900);
  return n;
}

module.exports = { PROVIDERS, enabled, seal, unseal, authorizeUrl, identify, suggestName };
