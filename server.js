// Bowfall server: the website, accounts, forum, room list, and each room's match (run authoritatively here).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const Sim = require('./public/sim.js');
const { createStore, BOARD_KEYS } = require('./lib/db');
const ROLE_MIN = 10; // games in a role before you appear on that role's board
const A = require('./lib/auth');
const O = require('./lib/oauth');
const { levelOf } = require('./lib/level');
const { countryOf } = require('./lib/geo');
const { rateGame, START: ELO_START } = require('./lib/rating');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const TICK = 1 / 60;          // simulation step
const SNAP_EVERY = 2;         // send a snapshot every 2 ticks (30 per second)
const MAX_ROOMS = 50;
const MAX_PEOPLE = 16;        // players plus spectators in one room
const ADMINS = String(process.env.ADMIN_USERS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
let nextCid = 1;

const store = createStore();

// every finished game is appended here (one JSON object per line) for balance stats
const DATA_FILE = process.env.BOWFALL_DATA || path.join(__dirname, 'data', 'games.jsonl');
fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

// ---------------- accounts in memory ----------------
// Signed-in players' records live here while they're around and are written back every few seconds.
const live = new Map();   // user id -> user object
const dirty = new Set();
function track(u) { if (!u) return null; const have = live.get(u.id); if (have) return have; live.set(u.id, u); return u; }
function markDirty(u) { if (u) dirty.add(u.id); }
async function flushUsers() {
  const ids = [...dirty]; dirty.clear();
  for (const id of ids) { const u = live.get(id); if (u) await store.saveUser(u).catch(e => console.error('Could not save a player:', e.message)); }
}
setInterval(flushUsers, 5000).unref();
async function userFromReq(req) {
  const tok = A.parseCookies(req.headers.cookie)[A.COOKIE];
  if (!tok) return null;
  const u = await store.sessionUser(A.hashToken(tok)).catch(() => null);
  return u ? track(u) : null;
}
// a player's flag: the country they picked, none if they hid it ('-'), or unset (we fill it in from their location)
const flagOf = u => (u && u.country && u.country !== '-' ? u.country : null);
const publicUser = u => ({ name: u.name, title: u.title, admin: !!u.admin, created: u.created, career: u.career || {}, got: Object.keys((u.ach && u.ach.got) || {}), stats: (u.ach && u.ach.stats) || {},
  country: flagOf(u), level: levelOf(u.career), border: (u.ach && u.ach.border) || null, avatar: (u.ach && u.ach.avatar) || null });
// the look of a signed-in player's name banner: the border they picked (if they've earned it) and how many achievements they have
const lookOf = u => { const got = (u.ach && u.ach.got) || {}, bd = u.ach && u.ach.border; return { bd: bd && got[bd] ? bd : null, na: Object.keys(got).length || null }; };

function careerAdd(u, rec, team) {
  const c = u.career || (u.career = {});
  const add = (k, n) => { c[k] = Math.round(((c[k] || 0) + (n || 0)) * 10) / 10; };
  if (rec.type === 'game') {
    const p = rec.pl;
    add('games', 1); if (p.w === 1) add('wins', 1); add('kills', p.k); if (!p.s) add('deaths', 1);
    add('dmg', p.dmg); add('ring', p.ring); add('shots', p.sh); add('hits', p.hi);
    c.roles = c.roles || {}; c.roles[p.ro] = (c.roles[p.ro] || 0) + 1;
    c.roleW = c.roleW || {}; if (p.w === 1) c.roleW[p.ro] = (c.roleW[p.ro] || 0) + 1;
    // personal bests in a single game, for the highscores
    c.best = c.best || {};
    for (const [k, v] of [['k', p.k], ['dmg', Math.round(p.dmg || 0)], ['ring', p.ring]]) if ((v || 0) > (c.best[k] || 0)) c.best[k] = v;
    c.els = c.els || {}; c.els[p.el] = (c.els[p.el] || 0) + 1;
  } else if (rec.type === 'match') {
    add('matches', 1); if (rec.win === team) add('matchWins', 1);
  }
  c.bull = (u.ach && u.ach.stats && u.ach.stats.bull) || 0;
  markDirty(u);
}

function saveRecords(room) {
  const recs = room.world.records.splice(0);
  if (!recs.length) return;
  const humans = room.world.players.filter(p => !p.bot).length;
  // credit signed-in players
  for (const r of recs) {
    if (r.type === 'game') {
      const users = new Map();
      for (const p of r.p) { const ws = [...room.clients].find(c => c.pid === p.id && c.user); if (ws) users.set(p.id, ws.user); }
      const rated = rateGame(r, users); // worked out for everyone first, from the ratings before this game
      for (const p of r.p) { const u = users.get(p.id); if (u) careerAdd(u, { type: 'game', pl: p }); }
      for (const [pid, u] of users) {
        const x = rated.get(u.id); if (!x) continue;
        const c = u.career; c.elo = x.elo; c.eloPeak = Math.max(c.eloPeak || ELO_START, x.elo);
        c.relo = c.relo || {}; c.relo[x.role] = x.roleElo;
        const ws = [...room.clients].find(q => q.user === u);
        if (ws) send(ws, { t: 'rated', elo: x.elo, d: x.delta });
      }
    } else if (r.type === 'match') {
      for (const ws of room.clients) if (ws.user && ws.pid) { const q = room.world.players.find(q => q.id === ws.pid); if (q) careerAdd(ws.user, r, q.team); }
    }
  }
  for (const ws of room.clients) if (ws.user && ws.pid) Sim.setMeta(room.world, ws.pid, { lv: levelOf(ws.user.career).lv });
  if (recs.some(r => r.type === 'game')) sendRoom(room); // fresh stats for the hover cards
  const lines = recs.map(r => JSON.stringify(Object.assign({ src: 'online', room: room.code, humans }, r, r.p ? { p: r.p.map(({ id, ...x }) => x) } : {}))).join('\n') + '\n';
  fs.appendFile(DATA_FILE, lines, err => { if (err) console.error('Could not save game stats:', err.message); });
}

// ---------------- HTTP ----------------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2' };
function json(res, code, obj, headers = {}) {
  res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers));
  res.end(JSON.stringify(obj));
}
function readBody(req, limit = 16 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('too big')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { const v = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; resolve(v && typeof v === 'object' ? v : null); } catch (e) { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}
const ip = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
const authLimit = A.limiter(12, 60 * 1000), postLimit = A.limiter(6, 60 * 1000), threadLimit = A.limiter(3, 5 * 60 * 1000);
const cleanText = (s, max) => String(s || '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max);

async function api(req, res, url) {
  const route = url.pathname.slice(4); // after /api
  const method = req.method;
  const me = await userFromReq(req);
  const body = method === 'POST' ? await readBody(req).catch(() => null) : null;
  if (method === 'POST' && !body) return json(res, 400, { error: 'Bad request.' });

  // balance data for the in-game screen
  if (route === '/balance' && method === 'GET') {
    return fs.readFile(DATA_FILE, 'utf8', (err, text) => {
      const recs = [];
      if (!err) for (const line of text.split('\n')) { if (!line.trim()) continue; try { recs.push(JSON.parse(line)); } catch (e) { /* half-written line */ } }
      json(res, 200, { records: recs });
    });
  }
  // ---- accounts
  if (route === '/register' && method === 'POST') {
    if (!authLimit(ip(req))) return json(res, 429, { error: 'Too many attempts. Wait a minute and try again.' });
    const name = String(body.name || '').trim();
    if (!A.validName(name)) return json(res, 400, { error: 'Names are 3 to 16 letters, numbers, _ or -.' });
    if (!A.validPassword(body.password)) return json(res, 400, { error: 'Passwords need at least 6 characters.' });
    const first = (await store.userCount()) === 0;
    const u = await store.createUser(name, A.hashPassword(body.password), first || ADMINS.includes(name.toLowerCase()));
    if (!u) return json(res, 409, { error: 'That name is taken.' });
    return login(req, res, u);
  }
  if (route === '/login' && method === 'POST') {
    if (!authLimit(ip(req))) return json(res, 429, { error: 'Too many attempts. Wait a minute and try again.' });
    const u = await store.userByName(String(body.name || '').trim());
    if (!u || !A.checkPassword(body.password, u.passHash)) return json(res, 401, { error: 'Wrong name or password.' });
    return login(req, res, u);
  }
  if (route === '/logout' && method === 'POST') {
    const tok = A.parseCookies(req.headers.cookie)[A.COOKIE];
    if (tok) await store.deleteSession(A.hashToken(tok));
    return json(res, 200, { ok: true }, { 'Set-Cookie': A.sessionCookie(null, req) });
  }
  if (route === '/me' && method === 'GET') {
    if (!me) return json(res, 200, { user: null });
    return json(res, 200, { user: Object.assign(publicUser(me), { ach: me.ach || {}, logins: await store.loginsOf(me.id), hasPassword: !!me.passHash, countryRaw: me.country || null }) });
  }
  if (route === '/version' && method === 'GET') return json(res, 200, { version: Sim.VERSION });
  // the flag next to your name: a two-letter country code, '-' to hide it, or '' to go back to your location
  if (route === '/country' && method === 'POST') {
    if (!me) return json(res, 401, { error: 'Sign in first.' });
    let v = String(body.country || '').toLowerCase().trim();
    if (v && v !== '-' && !/^[a-z]{2}$/.test(v)) return json(res, 400, { error: 'Pick a country from the list.' });
    if (!v) v = (await countryOf(req)) || null;
    me.country = v; markDirty(me);
    for (const r of rooms.values()) for (const c of r.clients) if (c.user && c.user.id === me.id && c.pid) Sim.setMeta(r.world, c.pid, { cc: flagOf(me) });
    return json(res, 200, { ok: true, country: flagOf(me), countryRaw: me.country });
  }
  // ---- Google, Discord and friends
  if (route === '/auth-providers' && method === 'GET') return json(res, 200, { providers: O.enabled().map(k => ({ key: k, name: O.PROVIDERS[k].name })) });
  if (route === '/oauth/pending' && method === 'GET') {
    const pend = O.unseal(A.parseCookies(req.headers.cookie).bf_pending);
    if (!pend) return json(res, 200, { pending: null });
    let name = O.suggestName(pend.suggest);
    for (let i = 2; await store.userByName(name) && i < 99; i++) name = O.suggestName(pend.suggest).slice(0, 14) + i;
    return json(res, 200, { pending: { provider: O.PROVIDERS[pend.p].name, name, next: pend.next || '' } });
  }
  if (route === '/oauth/finish' && method === 'POST') {
    const pend = O.unseal(A.parseCookies(req.headers.cookie).bf_pending);
    if (!pend) return json(res, 400, { error: 'That sign-in has expired. Try again.' });
    const name = String(body.name || '').trim();
    if (!A.validName(name)) return json(res, 400, { error: 'Names are 3 to 16 letters, numbers, _ or -.' });
    if (await store.userForLogin(pend.p, pend.id)) return json(res, 409, { error: 'That account is already set up. Sign in again.' });
    const first = (await store.userCount()) === 0;
    const u = await store.createUser(name, '', first || ADMINS.includes(name.toLowerCase()));
    if (!u) return json(res, 409, { error: 'That name is taken.' });
    await store.addLogin(pend.p, pend.id, u.id);
    return login(req, res, u, [clearCookie('bf_pending', req)]);
  }
  if (route === '/unlink' && method === 'POST') {
    if (!me) return json(res, 401, { error: 'Sign in first.' });
    const p = String(body.provider || ''), have = await store.loginsOf(me.id);
    if (!have.includes(p)) return json(res, 400, { error: "That isn't linked." });
    if (!me.passHash && have.length < 2) return json(res, 400, { error: 'Set a password first, or you would have no way to sign in.' });
    await store.removeLogin(p, me.id);
    return json(res, 200, { ok: true });
  }
  if (route === '/password' && method === 'POST') {
    if (!me) return json(res, 401, { error: 'Sign in first.' });
    if (me.passHash && !A.checkPassword(body.current, me.passHash)) return json(res, 401, { error: 'Your current password is wrong.' });
    if (!A.validPassword(body.password)) return json(res, 400, { error: 'Passwords need at least 6 characters.' });
    me.passHash = A.hashPassword(body.password);
    await store.setPassword(me.id, me.passHash);
    return json(res, 200, { ok: true });
  }
  if (route === '/title' && method === 'POST') {
    if (!me) return json(res, 401, { error: 'Sign in first.' });
    const key = body.title ? String(body.title) : null;
    if (key && !(me.ach && me.ach.got && me.ach.got[key])) return json(res, 400, { error: "You haven't unlocked that title." });
    me.title = key; markDirty(me);
    return json(res, 200, { ok: true, title: me.title });
  }
  let m;
  if ((m = route.match(/^\/users\/([A-Za-z0-9_-]{1,16})$/)) && method === 'GET') {
    const u = await store.userByName(m[1]);
    if (!u) return json(res, 404, { error: 'No player with that name.' });
    return json(res, 200, { user: publicUser(live.get(u.id) || u) });
  }
  if (route === '/leaderboard' && method === 'GET') {
    const by = BOARD_KEYS.includes(url.searchParams.get('by')) ? url.searchParams.get('by') : 'elo';
    const role = Sim.ROLES[url.searchParams.get('role')] ? url.searchParams.get('role') : null;
    if (role) {
      // a role's board: rating in that role, for players with enough games in it; win rate alongside
      const all = (await store.leaderboard('games', 100000)).map(u => live.get(u.id) || u);
      const rows = all.filter(u => ((u.career || {}).roles || {})[role] >= ROLE_MIN)
        .map(u => { const c = u.career, g = c.roles[role], wn = (c.roleW || {})[role] || 0; return { name: u.name, title: u.title, country: flagOf(u), level: levelOf(c).lv, value: Math.round((c.relo || {})[role] || ELO_START), games: g, wins: wn, rate: Math.round(wn / g * 100) }; })
        .sort((a, b) => b.value - a.value).slice(0, 50);
      return json(res, 200, { by: 'elo', role, min: ROLE_MIN, rows });
    }
    const rows = (await store.leaderboard(by, 50)).map(u => live.get(u.id) || u).filter(u => (u.career || {}).games > 0);
    return json(res, 200, { by, rows: rows.map(u => ({ name: u.name, title: u.title, country: flagOf(u), level: levelOf(u.career).lv, value: by === 'elo' ? Math.round((u.career || {}).elo || ELO_START) : (u.career || {})[by] || 0, games: (u.career || {}).games || 0, wins: (u.career || {}).wins || 0, kills: (u.career || {}).kills || 0, rate: (u.career || {}).games ? Math.round(((u.career || {}).wins || 0) / u.career.games * 100) : 0 })) });
  }
  // single-game records
  if (route === '/highscores' && method === 'GET') {
    const all = (await store.leaderboard('games', 100000)).map(u => live.get(u.id) || u);
    const top = k => all.filter(u => ((u.career || {}).best || {})[k] > 0).sort((a, b) => b.career.best[k] - a.career.best[k]).slice(0, 10)
      .map(u => ({ name: u.name, country: flagOf(u), level: levelOf(u.career).lv, value: u.career.best[k] }));
    const peak = all.filter(u => (u.career || {}).eloPeak).sort((a, b) => b.career.eloPeak - a.career.eloPeak).slice(0, 10)
      .map(u => ({ name: u.name, country: flagOf(u), level: levelOf(u.career).lv, value: Math.round(u.career.eloPeak) }));
    return json(res, 200, { kills: top('k'), dmg: top('dmg'), ring: top('ring'), peak });
  }
  if (route === '/look' && method === 'POST') {
    if (!me) return json(res, 401, { error: 'Sign in first.' });
    me.ach = me.ach || {};
    // the profile picture: a drawing of an archer in the element, role and colour you choose
    if (body.avatar && typeof body.avatar === 'object') {
      const a = body.avatar;
      if (!Sim.ELEMENTS[a.el] || !Sim.ROLES[a.ro] || !/^#[0-9a-f]{6}$/i.test(String(a.c || ''))) return json(res, 400, { error: 'Pick a picture from the list.' });
      me.ach.avatar = { el: a.el, ro: a.ro, c: String(a.c) }; markDirty(me);
      if (!('border' in body)) return json(res, 200, { ok: true, avatar: me.ach.avatar });
    }
    const bd = body.border ? String(body.border) : null;
    if (bd && !(me.ach.got && me.ach.got[bd])) return json(res, 400, { error: "You haven't unlocked that border." });
    me.ach.border = bd; markDirty(me);
    for (const r of rooms.values()) for (const c of r.clients) if (c.user && c.user.id === me.id) { Object.assign(c, lookOf(me)); if (c.pid) Sim.setMeta(r.world, c.pid, lookOf(me)); sendRoom(r); }
    return json(res, 200, { ok: true, border: bd });
  }
  // ---- rooms
  if (route === '/rooms' && method === 'GET') {
    const list = [...rooms.values()].filter(r => r.pub && r.clients.size).map(r => {
      const w = r.world, h = hostWs(r);
      return { code: r.code, name: r.name, host: h ? h.name : '', locked: !!r.pwHash, map: w.cfg.map, mapName: Sim.MAPS[w.cfg.map].name, phase: w.match.ph,
        players: w.players.filter(p => !p.bot).length, bots: w.players.filter(p => p.bot).length, people: r.clients.size, max: r.max || 8 };
    });
    return json(res, 200, { rooms: list, online: [...rooms.values()].reduce((n, r) => n + r.clients.size, 0) });
  }
  // ---- forum
  if (route === '/forum' && method === 'GET') return json(res, 200, { categories: await store.categories(), recent: await store.recentThreads(8) });
  if ((m = route.match(/^\/forum\/c\/([a-z0-9-]+)$/)) && method === 'GET') {
    const c = await store.category(m[1]);
    if (!c) return json(res, 404, { error: 'No such category.' });
    const page = Math.max(0, parseInt(url.searchParams.get('page'), 10) || 0);
    return json(res, 200, { category: c, threads: await store.threads(c.id, 30, page * 30), page });
  }
  if ((m = route.match(/^\/forum\/t\/(\d+)$/)) && method === 'GET') {
    const t = await store.thread(+m[1]);
    if (!t) return json(res, 404, { error: 'That thread is gone.' });
    const c = await store.category(t.catId);
    const posts = (await store.posts(t.id)).map(p => { const u = live.get(p.userId); if (u) { p.authorCountry = flagOf(u); p.authorCareer = u.career; } p.authorLevel = levelOf(p.authorCareer).lv; p.authorCountry = p.authorCountry && p.authorCountry !== '-' ? p.authorCountry : null; delete p.authorCareer; return p; });
    return json(res, 200, { thread: t, category: c, posts });
  }
  if (route === '/forum/threads' && method === 'POST') {
    if (!me) return json(res, 401, { error: 'Sign in to post.' });
    const c = await store.category(String(body.cat || ''));
    if (!c) return json(res, 400, { error: 'Pick a category.' });
    if (c.adminOnly && !me.admin) return json(res, 403, { error: 'Only admins post here.' });
    const title = cleanText(body.title, 90), text = cleanText(body.body, 5000);
    if (title.length < 3 || text.length < 2) return json(res, 400, { error: 'Give it a title and write something.' });
    if (!threadLimit('u' + me.id)) return json(res, 429, { error: "You're starting threads too fast. Try again in a few minutes." });
    return json(res, 200, { id: await store.createThread(c.id, me.id, title, text) });
  }
  if ((m = route.match(/^\/forum\/t\/(\d+)\/posts$/)) && method === 'POST') {
    if (!me) return json(res, 401, { error: 'Sign in to reply.' });
    const t = await store.thread(+m[1]);
    if (!t) return json(res, 404, { error: 'That thread is gone.' });
    if (t.locked && !me.admin) return json(res, 403, { error: 'This thread is locked.' });
    const text = cleanText(body.body, 5000);
    if (text.length < 2) return json(res, 400, { error: 'Write something first.' });
    if (!postLimit('u' + me.id)) return json(res, 429, { error: "You're posting too fast. Wait a moment." });
    return json(res, 200, { id: await store.createPost(t.id, me.id, text) });
  }
  if ((m = route.match(/^\/forum\/p\/(\d+)\/delete$/)) && method === 'POST') {
    if (!me) return json(res, 401, { error: 'Sign in first.' });
    const p = await store.post(+m[1]);
    if (!p) return json(res, 404, { error: 'No such post.' });
    if (p.userId !== me.id && !me.admin) return json(res, 403, { error: 'You can only delete your own posts.' });
    await store.deletePost(p.id);
    return json(res, 200, { ok: true });
  }
  if ((m = route.match(/^\/forum\/t\/(\d+)\/mod$/)) && method === 'POST') {
    if (!me || !me.admin) return json(res, 403, { error: 'Admins only.' });
    const f = {}; for (const k of ['locked', 'pinned', 'deleted']) if (k in body) f[k] = !!body[k];
    await store.setThread(+m[1], f);
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { error: 'Not found.' });
}
async function sessionFor(req, u) {
  const tok = A.newToken();
  await store.createSession(A.hashToken(tok), u.id, Date.now() + A.SESSION_DAYS * 86400 * 1000);
  return A.sessionCookie(tok, req);
}
async function login(req, res, u, extraCookies = []) {
  const ck = await sessionFor(req, u), t = track(u);
  return json(res, 200, { user: Object.assign(publicUser(t), { ach: t.ach || {} }) }, { 'Set-Cookie': [ck].concat(extraCookies) });
}
const secure = req => (req.headers['x-forwarded-proto'] || '').includes('https');
const tempCookie = (name, value, req, minutes) => `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${minutes * 60}${secure(req) ? '; Secure' : ''}`;
const clearCookie = (name, req) => `${name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure(req) ? '; Secure' : ''}`;
const redirect = (res, to, cookies = []) => { res.writeHead(302, { Location: to, 'Set-Cookie': cookies, 'Cache-Control': 'no-store' }); res.end(); };
const safeNext = n => (typeof n === 'string' && /^\/(?!\/)/.test(n) ? n.slice(0, 200) : '');

// /auth/google starts a sign-in; /auth/google/callback is where the provider sends people back
async function oauth(req, res, url) {
  const m = url.pathname.match(/^\/auth\/([a-z]+)(\/callback)?$/);
  const p = m && m[1];
  if (!p || !O.enabled().includes(p)) return redirect(res, '/#/login?err=' + encodeURIComponent('That sign-in option is not set up on this server.'));
  const me = await userFromReq(req);
  if (!m[2]) {
    const state = crypto.randomBytes(16).toString('hex');
    const st = O.seal({ s: state, p, next: safeNext(url.searchParams.get('next')), link: !!(me && url.searchParams.get('link')) }, 10);
    return redirect(res, O.authorizeUrl(req, p, state), [tempCookie('bf_oauth', st, req, 10)]);
  }
  const st = O.unseal(A.parseCookies(req.headers.cookie).bf_oauth), clear = clearCookie('bf_oauth', req);
  const fail = msg => redirect(res, '/#/login?err=' + encodeURIComponent(msg), [clear]);
  if (url.searchParams.get('error')) return fail('Sign-in was cancelled.');
  if (!st || st.p !== p || st.s !== url.searchParams.get('state')) return fail('That sign-in link has expired. Try again.');
  let who;
  try { who = await O.identify(req, p, String(url.searchParams.get('code') || '')); } catch (e) { return fail(`Couldn't sign in with ${O.PROVIDERS[p].name}. Try again.`); }
  const existing = await store.userForLogin(p, who.id);
  if (st.link && me) {
    // adding this sign-in method to the account you're already signed in to
    if (existing && existing.id !== me.id) return redirect(res, `/#/u/${encodeURIComponent(me.name)}?err=` + encodeURIComponent(`That ${O.PROVIDERS[p].name} account already belongs to another player.`), [clear]);
    await store.addLogin(p, who.id, me.id);
    return redirect(res, `/#/u/${encodeURIComponent(me.name)}`, [clear]);
  }
  if (existing) return redirect(res, st.next || '/#/u/' + encodeURIComponent(existing.name), [clear, await sessionFor(req, existing)]);
  // someone new: choose a player name first
  const pend = O.seal({ p, id: who.id, suggest: who.suggest, next: st.next }, 15);
  return redirect(res, '/#/finish', [clear, tempCookie('bf_pending', pend, req, 15)]);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/health') { res.writeHead(200); return res.end('ok'); }
  // with PUBLIC_URL set (e.g. https://bowfall.com), anyone arriving at another address (the onrender.com one, www.) is sent there,
  // so sign-ins and links always use one address
  const pub = process.env.PUBLIC_URL && new URL(process.env.PUBLIC_URL);
  if (pub && req.headers.host && req.headers.host !== pub.host && !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host)) {
    res.writeHead(301, { Location: pub.origin + req.url }); return res.end();
  }
  if (url.pathname.startsWith('/auth/')) {
    try { return await oauth(req, res, url); } catch (e) { console.error(e); return redirect(res, '/#/login?err=' + encodeURIComponent('Something went wrong signing in.')); }
  }
  if (url.pathname.startsWith('/api/')) {
    try { return await api(req, res, url); } catch (e) { console.error(e); return json(res, 500, { error: 'Something went wrong on the server.' }); }
  }
  // old room links (/?room=ABCD) go straight to the game
  if (url.pathname === '/' && url.searchParams.get('room')) { res.writeHead(302, { Location: '/play?room=' + encodeURIComponent(url.searchParams.get('room')) }); return res.end(); }
  const page = url.pathname === '/' ? 'site.html' : url.pathname === '/play' ? 'index.html' : url.pathname;
  const file = path.normalize(path.join(PUBLIC, page));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ---------------- rooms ----------------
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096 });
const rooms = new Map();

function makeCode() {
  const L = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  let c;
  do { c = Array.from({ length: 4 }, () => L[Math.floor(Math.random() * L.length)]).join(''); } while (rooms.has(c));
  return c;
}
function send(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function cleanName(n) { return String(n || '').replace(/[^\p{L}\p{N} _\-.]/gu, '').trim().slice(0, 16) || 'Archer'; }
const cleanRoomName = n => String(n || '').replace(/[^\p{L}\p{N} _\-.,!?'&()]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 32);
const pwHash = pw => crypto.createHash('sha256').update('bowfall-room:' + pw).digest('hex');
function pwOk(room, pw) {
  if (!room.pwHash) return true;
  const a = Buffer.from(room.pwHash, 'hex'), b = Buffer.from(pwHash(String(pw || '')), 'hex');
  return crypto.timingSafeEqual(a, b);
}
function applyRoomCfg(room, o, hostName) {
  if (!o || typeof o !== 'object') return;
  if ('name' in o) room.name = cleanRoomName(o.name) || `${hostName}'s game`;
  if ('pub' in o) room.pub = !!o.pub;
  if ('max' in o) room.max = Math.max(2, room.clients.size, Math.min(MAX_PEOPLE, parseInt(o.max, 10) || 8));
  if ('pw' in o) { const pw = String(o.pw || '').slice(0, 32); room.pwHash = pw ? pwHash(pw) : null; }
}

// the host's changes to the match, told to everyone in the room's chat ("Aim assist set to Heavy.")
const DIFF_NAMES = { easy: 'Easy', normal: 'Normal', hard: 'Hard', extreme: 'Extreme' };
const cfgState = w => ({ diff: w.cfg.diff, map: w.cfg.map, ptw: w.cfg.pointsToWin, opt: Object.assign({}, w.cfg.opt) });
function announceCfg(room, a, b) {
  const lines = [];
  if (a.map !== b.map) lines.push(`Arena set to ${Sim.MAPS[b.map].name}.`);
  if (a.diff !== b.diff) lines.push(`Bot skill set to ${DIFF_NAMES[b.diff] || b.diff}.`);
  if (a.ptw !== b.ptw) lines.push(`Match length set to first to ${b.ptw} points.`);
  for (const k of Object.keys(Sim.OPTIONS)) if (a.opt[k] !== b.opt[k]) lines.push(`${Sim.OPTIONS[k].label} set to ${Sim.OPT_NAMES[b.opt[k]] || b.opt[k]}.`);
  for (const l of lines) sysChat(room, l);
}
const roomState = r => ({ name: r.name, pub: r.pub, max: r.max, pw: !!r.pwHash, pwh: r.pwHash });
function announceRoom(room, a, b) {
  if (a.name !== b.name) sysChat(room, `Game renamed to ${b.name}.`);
  if (a.max !== b.max) sysChat(room, `Maximum players set to ${b.max}.`);
  if (a.pub !== b.pub) sysChat(room, b.pub ? 'The game is now public: it shows in the games list.' : 'The game is now private: code only.');
  if (a.pw !== b.pw) sysChat(room, b.pw ? 'A password is now needed to join.' : 'The password was removed.');
  else if (b.pw && a.pwh !== b.pwh) sysChat(room, 'The password was changed.');
}
function createRoom(opts = {}) {
  const code = makeCode();
  const diff = Sim.DIFF[opts.diff] ? opts.diff : 'normal';
  const map = Sim.MAPS[opts.map] ? opts.map : 'meadow';
  const room = { code, name: '', pub: true, max: 8, pwHash: null, clients: new Set(), host: null, tick: 0, world: Sim.createWorld({ diff, map }) };
  rooms.set(code, room);
  return room;
}

// room.host is the host's connection id (cid); players on a team also have a sim id (pid), spectators don't
function hostWs(room) { return [...room.clients].find(c => c.cid === room.host) || null; }
function roomInfo(room, ws) {
  const h = hostWs(room);
  return {
    t: 'room', code: room.code, host: h ? h.pid : null, hostName: h ? h.name : '', amHost: room.host === ws.cid,
    name: room.name, pub: room.pub, locked: !!room.pwHash, max: room.max || 8, people: room.clients.size,
    cards: Object.fromEntries([...room.clients].map(c => [c.pid ? 'p' + c.pid : 'c' + c.cid, cardOf(c)])),
    spec: [...room.clients].filter(c => !c.pid).map(c => ({ cid: c.cid, n: c.name, h: c.cid === room.host ? 1 : 0, you: c === ws ? 1 : 0, cc: c.cc || undefined, lv: c.lv || undefined, bd: c.bd || undefined, na: c.na || undefined })),
  };
}
// what the lobby's hover card shows about someone: accounts get their record, guests just what their browser says they've earned
const topAch = got => Sim.ACH_ORDER.filter(k => got && got[k]).slice(0, 2);
function cardOf(c) {
  if (c.user) {
    const k = c.user.career || {};
    return { a: 1, g: k.games || 0, w: k.wins || 0, elo: Math.round(k.elo || ELO_START), lv: levelOf(k).lv, top: topAch(c.user.ach && c.user.ach.got) };
  }
  return { top: c.top || [] };
}
function sendRoom(room) { for (const c of room.clients) send(c, roomInfo(room, c)); }
function broadcast(room, obj) { const s = JSON.stringify(obj); for (const c of room.clients) if (c.readyState === 1) c.send(s); }
function sysChat(room, text) { broadcast(room, { t: 'chat', sys: 1, m: text }); }

// put a connection onto a team (from spectating), replacing a bot if the team is full of them
function joinTeam(room, ws, team) {
  const w = room.world;
  if (!Sim.TEAMS.includes(team)) return 'No such team.';
  if (!['lobby', 'over', 'post'].includes(w.match.ph)) return 'You can join a team once this game ends.';
  const on = w.players.filter(p => p.team === team);
  if (on.length >= Sim.MAX_TEAM) {
    const bot = on.filter(p => p.bot).pop();
    if (!bot) return 'That team is full.';
    Sim.removeBot(w, bot.id);
  }
  const p = Sim.join(w, { name: ws.name, team, element: ws.el, role: ws.ro });
  if (!p) return 'That team is full.';
  ws.pid = p.id;
  if (ws.title) Sim.setTitle(w, p.id, ws.title);
  Sim.setMeta(w, p.id, { cc: ws.cc, lv: ws.lv, bd: ws.bd, na: ws.na });
  send(ws, { t: 'you', id: p.id });
  return null;
}
function toSpectator(room, ws) {
  if (!ws.pid) return;
  Sim.leave(room.world, ws.pid);
  ws.pid = null;
  send(ws, { t: 'you', id: null });
}

function leave(ws) {
  const room = ws.room;
  if (!room) return;
  room.clients.delete(ws);
  if (ws.pid) Sim.leave(room.world, ws.pid);
  ws.room = null; ws.pid = null;
  if (!room.clients.size) { rooms.delete(room.code); return; }
  if (room.host === ws.cid) {
    // hand the room to someone on a team if possible, otherwise anyone
    const next = [...room.clients].find(c => c.pid) || [...room.clients][0];
    room.host = next.cid;
    sysChat(room, `${ws.name} left. ${next.name} is now the host.`);
  } else sysChat(room, `${ws.name} left.`);
  sendRoom(room);
}

async function handle(ws, m) {
  if (!m || typeof m !== 'object') return;

  if (m.t === 'join') {
    if (ws.room) leave(ws);
    let room;
    if (m.create) {
      if (rooms.size >= MAX_ROOMS) return send(ws, { t: 'err', msg: 'The server is full. Try again later.' });
      room = createRoom({ diff: m.diff, map: m.map });
    } else {
      room = rooms.get(String(m.code || '').toUpperCase().trim());
      if (!room) return send(ws, { t: 'err', msg: 'No game with that code. Check it and try again.' });
      if (!pwOk(room, m.pw)) return send(ws, { t: 'needpw', code: room.code, msg: m.pw ? 'Wrong password.' : 'This game needs a password.' });
    }
    if (!m.create && room.clients.size >= (room.max || 8)) return send(ws, { t: 'err', msg: `That game is full (${room.clients.size}/${room.max || 8} players).` });
    // signed-in players always play under their account name and wear their account's title
    ws.name = ws.user ? ws.user.name : cleanName(m.name);
    // guests can't pass themselves off as a registered player
    if (!ws.user && await store.userByName(ws.name).catch(() => null)) ws.name = ws.name.slice(0, 15) + '~';
    // nobody shares a name inside one game: a second "Archer" becomes "Archer 2"
    { const taken = n => [...room.clients].some(c => c !== ws && c.name && c.name.toLowerCase() === n.toLowerCase()); const base = ws.name.slice(0, 13);
      for (let i = 2; taken(ws.name) && i < 99; i++) ws.name = base + ' ' + i; }
    ws.title = ws.user ? ws.user.title : null;
    ws.lv = ws.user ? levelOf(ws.user.career).lv : null;
    if (ws.user) Object.assign(ws, lookOf(ws.user));
    if (ws.user) ws.cc = ws.user.country ? flagOf(ws.user) : ws.geo || null;
    ws.el = String(m.el || ''); ws.ro = String(m.ro || ''); ws.pid = null;
    ws.room = room;
    room.clients.add(ws);
    // whoever creates the room starts on Red; everyone else arrives unassigned (or spectating a match in progress) and picks a team
    if (m.create) { room.host = ws.cid; applyRoomCfg(room, Object.assign({ name: '' }, m.room || {}), ws.name); joinTeam(room, ws, 'red'); }
    else if (!room.host) room.host = ws.cid;
    send(ws, { t: 'welcome', id: ws.pid, code: room.code, account: ws.user ? ws.user.name : null });
    sendRoom(room);
    sysChat(room, room.world.match.ph === 'lobby' || room.world.match.ph === 'over' ? `${ws.name} joined.` : `${ws.name} joined and is spectating until this game ends.`);
    return;
  }

  const room = ws.room;
  if (!room) return;
  const w = room.world, isHost = room.host === ws.cid;
  switch (m.t) {
    case 'in': if (ws.pid) Sim.setInput(w, ws.pid, m); break;
    case 'ping': send(ws, { t: 'pong', c: m.c }); break;
    case 'loadout': ws.el = String(m.el); ws.ro = String(m.ro); if (ws.pid) Sim.setLoadout(w, ws.pid, ws.el, ws.ro); break;
    case 'title': {
      // accounts can only wear titles they've earned on this server; guests pick from their own browser's list
      const v = m.v ? String(m.v) : null;
      if (ws.user) { if (v && !(ws.user.ach && ws.user.ach.got && ws.user.ach.got[v])) break; ws.user.title = v; markDirty(ws.user); }
      ws.title = v; if (ws.pid) Sim.setTitle(w, ws.pid, v);
      break;
    }
    case 'choose': if (ws.pid) Sim.choose(w, ws.pid, m.i | 0); break;
    case 'look': {
      // accounts show what the server knows they've earned; guests show what their browser says
      const look = ws.user ? lookOf(ws.user) : { bd: Sim.ACHIEVEMENTS[m.bd] ? String(m.bd) : null, na: Math.max(0, Math.min(Object.keys(Sim.ACHIEVEMENTS).length, m.na | 0)) || null };
      if (!ws.user) ws.top = (Array.isArray(m.top) ? m.top : []).map(String).filter(k => Sim.ACHIEVEMENTS[k]).slice(0, 2);
      Object.assign(ws, look);
      if (ws.pid) Sim.setMeta(w, ws.pid, look);
      sendRoom(room);
      break;
    }
    case 'team': {
      const team = String(m.team);
      if (ws.pid) Sim.setTeam(w, ws.pid, team);
      else { const err = joinTeam(room, ws, team); if (err) send(ws, { t: 'note', msg: err }); else sendRoom(room); }
      break;
    }
    case 'spec': if (ws.pid) { toSpectator(room, ws); sendRoom(room); } break;
    case 'chat': {
      const text = String(m.m || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 140);
      if (!text) break;
      const now = Date.now(); ws.chatT = ws.chatT.filter(t => now - t < 5000);
      if (ws.chatT.length >= 5) { send(ws, { t: 'note', msg: 'Slow down a little.' }); break; }
      ws.chatT.push(now);
      const p = ws.pid && w.players.find(q => q.id === ws.pid);
      broadcast(room, { t: 'chat', n: ws.name, tm: p ? p.team : 'spec', c: p ? p.color : null, m: text, acc: ws.user ? 1 : 0 });
      break;
    }
    // host-only controls
    case 'roomcfg': if (isHost) { const before = roomState(room); applyRoomCfg(room, m, ws.name); announceRoom(room, before, roomState(room)); sendRoom(room); } break;
    case 'bot':
      if (!isHost) break;
      if (m.op === 'add') Sim.addBot(w, String(m.team));
      if (m.op === 'remove') Sim.removeBot(w, String(m.id));
      break;
    case 'cfg': {
      if (!isHost) break;
      const before = cfgState(w);
      if (m.diff) Sim.setBotDifficulty(w, String(m.diff));
      if (m.map) Sim.setMap(w, String(m.map));
      if (m.ptw) Sim.setPointsToWin(w, m.ptw | 0);
      if (m.opt && typeof m.opt === 'object') for (const [k, v] of Object.entries(m.opt)) Sim.setOption(w, String(k), String(v));
      announceCfg(room, before, cfgState(w));
      break;
    }
    case 'hcap': if (isHost) Sim.setHandicap(w, String(m.id), m.v | 0); break;
    case 'start': if (isHost) Sim.startMatch(w); break;
    case 'lobby': if (isHost) Sim.toLobby(w); break;
    case 'restart': if (isHost && w.match.ph === 'over') Sim.resetMatch(w); break;
  }
}

wss.on('connection', (ws, req) => {
  ws.isAlive = true; ws.cid = 'c' + (nextCid++); ws.chatT = [];
  // find out who this is (from the sign-in cookie) before handling anything they send
  ws.ready = userFromReq(req).then(u => { ws.user = u; }).catch(() => { ws.user = null; });
  // where they're playing from, for the flag by their name (doesn't hold anything up; fills in when it arrives)
  countryOf(req).then(cc => {
    ws.geo = cc;
    ws.ready.then(() => {
      if (ws.user && !ws.user.country && cc) { ws.user.country = cc; markDirty(ws.user); }
      ws.cc = ws.user ? flagOf(ws.user) : cc;
      if (ws.room && ws.pid) Sim.setMeta(ws.room.world, ws.pid, { cc: ws.cc });
      if (ws.room) sendRoom(ws.room);
    });
  }).catch(() => {});
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    // one message at a time, in order (joining may wait on the database)
    ws.ready = ws.ready.then(() => handle(ws, m)).catch(e => console.error(e));
  });
  let gone = false;
  const bye = () => { if (gone) return; gone = true; ws.ready.then(() => { leave(ws); if (ws.user) { markDirty(ws.user); flushUsers(); } }); };
  ws.on('close', bye);
  ws.on('error', bye);
});

// drop dead connections
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 10000);

// achievements for signed-in players, worked out here from the game's own events
function creditAchievements(room, evs) {
  for (const ws of room.clients) {
    if (!ws.user || !ws.pid) continue;
    const p = room.world.players.find(q => q.id === ws.pid);
    const adds = Sim.achFromEvents(evs, ws.pid, p ? p.team : null);
    if (!adds.length) continue;
    const u = ws.user; u.ach = u.ach || {};
    const fresh = Sim.achApply(u.ach, adds);
    markDirty(u);
    if (fresh.length) { Object.assign(ws, lookOf(u)); Sim.setMeta(room.world, ws.pid, lookOf(u)); }
    send(ws, { t: 'ach', keys: fresh, ach: u.ach });
  }
}

// fixed-step game loop
let last = process.hrtime.bigint(), acc = 0;
setInterval(() => {
  const now = process.hrtime.bigint();
  acc += Number(now - last) / 1e9; last = now;
  if (acc > 0.25) acc = 0.25; // don't spiral after a stall
  while (acc >= TICK) {
    acc -= TICK;
    for (const room of rooms.values()) {
      Sim.step(room.world, TICK);
      room.tick++;
      if (room.tick % SNAP_EVERY === 0) {
        const evs = room.world.events.splice(0);
        if (evs.length) creditAchievements(room, evs);
        const msg = JSON.stringify({ t: 'snap', s: Sim.snapshot(room.world), ev: evs });
        for (const c of room.clients) if (c.readyState === 1) c.send(msg);
      }
      if (room.world.records.length) saveRecords(room);
    }
  }
}, 5);

store.init().then(() => {
  server.listen(PORT, () => console.log(`Bowfall server running on http://localhost:${PORT} (${store.kind === 'postgres' ? 'Postgres database' : 'local database file'})`));
}).catch(e => { console.error('Could not open the database:', e.message); process.exit(1); });
process.on('SIGTERM', () => { flushUsers().finally(() => process.exit(0)); });
