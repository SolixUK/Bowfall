// Bowfall server: the website, accounts, forum, room list, and each room's match (run authoritatively here).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
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
// the one admin account (by name); everyone else is an ordinary player
const OWNER = String(process.env.ADMIN_NAME || 'Tom').trim().toLowerCase();
const isOwner = u => !!(u && !u.guest && u.name && u.name.toLowerCase() === OWNER);
let nextCid = 1;

const store = createStore();

// every finished game is appended here (one JSON object per line) for balance stats
const DATA_FILE = process.env.BOWFALL_DATA || path.join(__dirname, 'data', 'games.jsonl');
fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });

// ---------------- accounts in memory ----------------
// Signed-in players' records live here while they're around and are written back every few seconds.
const live = new Map();   // user id -> user object
const dirty = new Set();
function track(u) { if (!u) return null; const have = live.get(u.id); if (have) return have; u.admin = isOwner(u); live.set(u.id, u); return u; }
function markDirty(u) { if (!u) return; if (u.guest) guestDirty.add(u); else dirty.add(u.id); }
async function flushUsers() {
  const ids = [...dirty]; dirty.clear();
  for (const id of ids) { const u = live.get(id); if (u) await store.saveUser(u).catch(e => console.error('Could not save a player:', e.message)); }
  const gs = [...guestDirty]; guestDirty.clear();
  for (const g of gs) await store.guestSave(g.key, { name: g.name, career: g.career, ach: g.ach }).catch(e => console.error('Could not save a guest:', e.message));
}
// ---------------- guests ----------------
// A guest's browser keeps a random id; their rating, stats and achievements are kept against it (hashed) on the server,
// so they carry on between visits, and move to an account when they make one or sign in to a fresh one.
const guests = new Map(), guestDirty = new Set();
const guestKey = tok => /^[A-Za-z0-9]{16,48}$/.test(String(tok || '')) ? crypto.createHash('sha256').update('bowfall-guest:' + tok).digest('hex').slice(0, 40) : null;
async function loadGuest(tok, name) {
  const key = guestKey(tok); if (!key) return null;
  let g = guests.get(key);
  if (!g) {
    const d = await store.guestGet(key).catch(() => null);
    g = { guest: true, id: 'g:' + key, key, name: (d && d.name) || 'Guest', career: (d && d.career) || {}, ach: (d && d.ach) || {} };
    guests.set(key, g);
  }
  if (name) g.name = String(name).slice(0, 16);
  return g;
}
// signing up or in: a guest's record becomes the account's, if the account hasn't played yet
async function adoptGuest(u, tok) {
  const key = guestKey(tok); if (!key || !u) return null;
  const g = guests.get(key) || await store.guestGet(key).catch(() => null);
  if (!g || !(g.career && g.career.games)) return null;
  if (u.career && u.career.games) return { skipped: true };
  u.career = Object.assign({}, g.career);
  u.ach = u.ach || {}; const st = u.ach.stats = u.ach.stats || {}, got = u.ach.got = u.ach.got || {};
  for (const [k, v] of Object.entries((g.ach && g.ach.stats) || {})) st[k] = Math.max(st[k] || 0, v);
  Object.assign(got, (g.ach && g.ach.got) || {});
  guests.delete(key); guestDirty.forEach(x => { if (x.key === key) guestDirty.delete(x); });
  await store.guestSave(key, null);
  await store.saveUser(u);
  return { elo: Math.round(u.career.elo || ELO_START), games: u.career.games };
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
const publicUser = u => ({ name: u.name, title: u.title, admin: !!u.admin, created: u.created, career: Object.assign({}, u.career || {}, { ai: undefined }), got: Object.keys((u.ach && u.ach.got) || {}), stats: (u.ach && u.ach.stats) || {},
  ai: !!(u.career && u.career.ai), country: flagOf(u), level: levelOf(u.career), border: (u.ach && u.ach.border) || null, avatar: (u.ach && u.ach.avatar) || null });
// the look of a signed-in player's name banner: the border they picked (if they've earned it) and how many achievements they have
const lookOf = u => { const got = (u.ach && u.ach.got) || {}, bd = u.ach && u.ach.border; return { bd: bd && got[bd] ? bd : null, na: Object.keys(got).length || null, ow: u.admin ? 1 : null }; };

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

// the account (or guest record, or matchmaking AI player) behind a player in a room
function userOfPid(room, pid) {
  const ws = [...room.clients].find(c => c.pid === pid && (c.user || c.guest));
  if (ws) return ws.user || ws.guest;
  return room.ai && room.ai.has(pid) ? room.ai.get(pid) : null;
}
const boardCache = new Map(); // leaderboard and highscores answers, briefly
let balanceCache = null; // the /api/balance response, until the next game is saved
function saveRecords(room) {
  const recs = room.world.records.splice(0);
  if (!recs.length) return;
  const humans = room.world.players.filter(p => !p.bot).length;
  // credit signed-in players
  for (const r of recs) {
    if (r.type === 'game') {
      for (const p of r.p) { const u = userOfPid(room, p.id); if (u) careerAdd(u, { type: 'game', pl: p }); }
      // ratings only change when the whole match is decided, so remember who played (and as what) for then
      room.rateRoster = { mid: r.mid, df: r.df, p: r.p.map(p => ({ id: p.id, b: p.b, df: p.df, tm: p.tm, ro: p.ro })) };
    } else if (r.type === 'match') {
      const ros = room.rateRoster && room.rateRoster.mid === r.mid ? room.rateRoster : null;
      room.rateRoster = null;
      if (ros && r.win && room.ranked) { // only matchmade (ranked) games change ratings; custom games don't
        const users = new Map();
        for (const p of ros.p) { const u = userOfPid(room, p.id); if (u) users.set(p.id, u); }
        const rec = { win: r.win, df: ros.df, p: ros.p.map(p => Object.assign({}, p, { w: p.tm === r.win ? 1 : 0 })) };
        const rated = rateGame(rec, users); // worked out for everyone first, from the ratings before this match
        for (const [pid, u] of users) {
          const x = rated.get(u.id); if (!x) continue;
          const c = u.career; c.elo = x.elo; c.eloPeak = Math.max(c.eloPeak || ELO_START, x.elo);
          c.relo = c.relo || {}; c.relo[x.role] = x.roleElo;
          const ws = [...room.clients].find(q => q.user === u || q.guest === u);
          if (ws) send(ws, { t: 'rated', elo: x.elo, d: x.delta, guest: u.guest ? 1 : undefined });
        }
      }
      for (const ws of room.clients) if ((ws.user || ws.guest) && ws.pid) { const q = room.world.players.find(q => q.id === ws.pid); if (q) careerAdd(ws.user || ws.guest, r, q.team); }
      if (room.ai) for (const [pid, u] of room.ai) { const q = room.world.players.find(q => q.id === pid); if (q) careerAdd(u, r, q.team); }
    }
  }
  for (const ws of room.clients) if ((ws.user || ws.guest) && ws.pid) Sim.setMeta(room.world, ws.pid, { lv: levelOf((ws.user || ws.guest).career).lv });
  if (room.ai) for (const [pid, u] of room.ai) Sim.setMeta(room.world, pid, { lv: levelOf(u.career).lv });
  if (recs.some(r => r.type === 'game')) sendRoom(room); // fresh stats for the hover cards
  const lines = recs.map(r => JSON.stringify(Object.assign({ src: 'online', room: room.code, humans }, r, r.p ? { p: r.p.map(({ id, ...x }) => x) } : {}))).join('\n') + '\n';
  balanceCache = null;
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
    // built once and reused until a new game is saved (it's the whole history, so it's worth not redoing per visit)
    if (balanceCache) { res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(balanceCache); }
    return fs.readFile(DATA_FILE, 'utf8', (err, text) => {
      const recs = [];
      if (!err) for (const line of text.split('\n')) { if (!line.trim()) continue; try { recs.push(JSON.parse(line)); } catch (e) { /* half-written line */ } }
      balanceCache = JSON.stringify({ records: recs });
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(balanceCache);
    });
  }
  // ---- accounts
  if (route === '/register' && method === 'POST') {
    if (!authLimit(ip(req))) return json(res, 429, { error: 'Too many attempts. Wait a minute and try again.' });
    const name = String(body.name || '').trim();
    if (!A.validName(name)) return json(res, 400, { error: 'Names are 3 to 16 letters, numbers, _ or -.' });
    if (!A.validPassword(body.password)) return json(res, 400, { error: 'Passwords need at least 6 characters.' });
    const u = await store.createUser(name, A.hashPassword(body.password), name.toLowerCase() === OWNER);
    if (!u) return json(res, 409, { error: 'That name is taken.' });
    return login(req, res, u, [], await adoptGuest(u, body.guest));
  }
  if (route === '/device-login' && method === 'POST') {
    if (!authLimit(ip(req))) return json(res, 429, { error: 'Too many attempts. Wait a minute and try again.' });
    const u = await store.userByName(String(body.name || '').trim());
    if (!u || !u.passHash || !A.checkPassword(body.password, u.passHash)) return json(res, 401, { error: 'Wrong name or password.' });
    if (u.career && u.career.ai) return json(res, 401, { error: 'Wrong name or password.' });
    const tok = A.newToken();
    await store.createSession(A.hashToken(tok), u.id, Date.now() + A.SESSION_DAYS * 86400 * 1000);
    const t = track(u);
    return json(res, 200, { token: tok, user: publicUser(t) });
  }
  if (route === '/login' && method === 'POST') {
    if (!authLimit(ip(req))) return json(res, 429, { error: 'Too many attempts. Wait a minute and try again.' });
    const u = await store.userByName(String(body.name || '').trim());
    if (!u || !A.checkPassword(body.password, u.passHash)) return json(res, 401, { error: 'Wrong name or password.' });
    return login(req, res, track(u), [], await adoptGuest(track(u), body.guest));
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
    const u = await store.createUser(name, '', name.toLowerCase() === OWNER);
    if (!u) return json(res, 409, { error: 'That name is taken.' });
    await store.addLogin(pend.p, pend.id, u.id);
    return login(req, res, u, [clearCookie('bf_pending', req)], await adoptGuest(u, body.guest));
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
  // leaderboards and highscores read every account, so each answer is kept for 30 seconds
  if ((route === '/leaderboard' || route === '/highscores') && method === 'GET') {
    const hit = boardCache.get(route + url.search);
    if (hit && hit.until > Date.now()) return json(res, 200, hit.v);
  }
  const board = v => { if (boardCache.size > 200) boardCache.clear(); boardCache.set(route + url.search, { v, until: Date.now() + 30000 }); return json(res, 200, v); };
  if (route === '/leaderboard' && method === 'GET') {
    const by = BOARD_KEYS.includes(url.searchParams.get('by')) ? url.searchParams.get('by') : 'elo';
    const role = Sim.ROLES[url.searchParams.get('role')] ? url.searchParams.get('role') : null;
    if (role) {
      // a role's board: rating in that role, for players with enough games in it; win rate alongside
      const all = (await store.leaderboard('games', 100000)).map(u => live.get(u.id) || u);
      const rows = all.filter(u => ((u.career || {}).roles || {})[role] >= ROLE_MIN)
        .map(u => { const c = u.career, g = c.roles[role], wn = (c.roleW || {})[role] || 0; return { name: u.name, ai: social.isAI(u) ? 1 : undefined, own: u.admin ? 1 : undefined, title: u.title, country: flagOf(u), level: levelOf(c).lv, value: Math.round((c.relo || {})[role] || ELO_START), games: g, wins: wn, rate: Math.round(wn / g * 100) }; })
        .sort((a, b) => b.value - a.value).slice(0, 50);
      return board({ by: 'elo', role, min: ROLE_MIN, rows });
    }
    const rows = (await store.leaderboard(by, 50)).map(u => live.get(u.id) || u).filter(u => (u.career || {}).games > 0);
    return board({ by, rows: rows.map(u => ({ name: u.name, ai: social.isAI(u) ? 1 : undefined, own: u.admin ? 1 : undefined, title: u.title, country: flagOf(u), level: levelOf(u.career).lv, value: by === 'elo' ? Math.round((u.career || {}).elo || ELO_START) : (u.career || {})[by] || 0, games: (u.career || {}).games || 0, wins: (u.career || {}).wins || 0, kills: (u.career || {}).kills || 0, rate: (u.career || {}).games ? Math.round(((u.career || {}).wins || 0) / u.career.games * 100) : 0 })) });
  }
  // single-game records
  if (route === '/highscores' && method === 'GET') {
    const all = (await store.leaderboard('games', 100000)).map(u => live.get(u.id) || u);
    const top = k => all.filter(u => ((u.career || {}).best || {})[k] > 0).sort((a, b) => b.career.best[k] - a.career.best[k]).slice(0, 10)
      .map(u => ({ name: u.name, ai: social.isAI(u) ? 1 : undefined, own: u.admin ? 1 : undefined, country: flagOf(u), level: levelOf(u.career).lv, value: u.career.best[k] }));
    const peak = all.filter(u => (u.career || {}).eloPeak).sort((a, b) => b.career.eloPeak - a.career.eloPeak).slice(0, 10)
      .map(u => ({ name: u.name, ai: social.isAI(u) ? 1 : undefined, own: u.admin ? 1 : undefined, country: flagOf(u), level: levelOf(u.career).lv, value: Math.round(u.career.eloPeak) }));
    return board({ kills: top('k'), dmg: top('dmg'), ring: top('ring'), peak });
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
async function login(req, res, u, extraCookies = [], moved = null) {
  const ck = await sessionFor(req, u), t = track(u);
  return json(res, 200, { user: Object.assign(publicUser(t), { ach: t.ach || {} }), guestMoved: moved }, { 'Set-Cookie': [ck].concat(extraCookies) });
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
  sendStatic(req, res, file);
});

// static files are compressed once (brotli and gzip, about a quarter of the size) and kept in memory with an ETag,
// so a returning visitor's browser gets a tiny "not changed" answer instead of the whole game again
const staticCache = new Map();
function sendStatic(req, res, file) {
  const done = f => {
    if (req.headers['if-none-match'] === f.etag) { res.writeHead(304, { ETag: f.etag, 'Cache-Control': 'no-cache' }); return res.end(); }
    const ae = String(req.headers['accept-encoding'] || ''), enc = f.br && /\bbr\b/.test(ae) ? 'br' : f.gz && /\bgzip\b/.test(ae) ? 'gzip' : null;
    const h = { 'Content-Type': f.type, 'Cache-Control': 'no-cache', ETag: f.etag, Vary: 'Accept-Encoding' };
    if (enc) h['Content-Encoding'] = enc;
    res.writeHead(200, h); res.end(enc === 'br' ? f.br : enc === 'gzip' ? f.gz : f.raw);
  };
  const have = staticCache.get(file);
  if (have) return done(have);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    const type = TYPES[path.extname(file)] || 'application/octet-stream', text = /^(text|application\/json|image\/svg)/.test(type) || /javascript/.test(type);
    const f = { type, raw: data, etag: '"' + crypto.createHash('sha1').update(data).digest('base64').slice(0, 20) + '"',
      gz: text && data.length > 1024 ? zlib.gzipSync(data, { level: 9 }) : null, br: text && data.length > 1024 ? zlib.brotliCompressSync(data) : null };
    staticCache.set(file, f);
    done(f);
  });
}

// ---------------- rooms ----------------
// messages over about 200 bytes (snapshots, room updates) are compressed, which cuts game traffic by around two thirds
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 4096,
  perMessageDeflate: { threshold: 200, zlibDeflateOptions: { level: 1, memLevel: 7 }, serverMaxWindowBits: 12, clientNoContextTakeover: true, concurrencyLimit: 16 } });
const rooms = new Map();
// friends, parties and matchmaking (lib/social.js)
const social = require('./lib/social')({ store, track, markDirty, send, Sim, levelOf, flagOf, ELO_START, rooms, createRoom, sendRoom, sysChat, broadcast, live, loadGuest });

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
const DIFF_NAMES = { easy: 'Easy', normal: 'Normal', hard: 'Hard', extreme: 'Extreme', master: 'Master' };
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
    ranked: room.ranked ? room.ranked.mode : undefined,
    // the ranked draft: seconds left to choose, and who's ready
    draft: room.ranked && room.ranked.draftUntil && !room.ranked.go ? Math.max(0, Math.ceil((room.ranked.draftUntil - Date.now()) / 1000)) : undefined,
    ready: room.ranked && room.ranked.ready ? [...room.clients].filter(c => room.ranked.ready.has(c.cid) && c.pid).map(c => c.pid) : undefined,
    cards: Object.fromEntries([...room.clients].map(c => [c.pid ? 'p' + c.pid : 'c' + c.cid, cardOf(c)]).concat([...(room.ai || new Map())].map(([pid, u]) => ['p' + pid, Object.assign(cardOf({ user: u }), { ai: 1 })]))),
    spec: [...room.clients].filter(c => !c.pid).map(c => ({ cid: c.cid, n: c.name, h: c.cid === room.host ? 1 : 0, you: c === ws ? 1 : 0, cc: c.cc || undefined, lv: c.lv || undefined, bd: c.bd || undefined, na: c.na || undefined, ow: c.ow || undefined })),
  };
}
// what the lobby's hover card shows about someone: accounts get their record, guests just what their browser says they've earned
const topAch = got => Sim.ACH_ORDER.filter(k => got && got[k]).slice(0, 2);
function cardOf(c) {
  if (c.guest && !c.user && c.guest.career.games) { const k = c.guest.career; return { a: 1, guest: 1, g: k.games || 0, w: k.wins || 0, elo: Math.round(k.elo || ELO_START), lv: levelOf(k).lv, top: c.top || [] }; }
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
  Sim.setMeta(w, p.id, { cc: ws.cc, lv: ws.lv, bd: ws.bd, na: ws.na, ow: ws.ow });
  send(ws, { t: 'you', id: p.id });
  return null;
}
function toSpectator(room, ws) {
  if (!ws.pid) return;
  Sim.leave(room.world, ws.pid, true);
  ws.pid = null;
  send(ws, { t: 'you', id: null });
}

function leave(ws) {
  const room = ws.room;
  if (!room) return;
  room.clients.delete(ws);
  if (ws.pid) Sim.leave(room.world, ws.pid);
  ws.room = null; ws.pid = null;
  setTimeout(() => social.presence(ws), 0);
  if (!room.clients.size) { social.freeAI(room); rooms.delete(room.code); return; }
  if (room.ranked) { sysChat(room, `${ws.name} left.`); sendRoom(room); return; }
  if (room.host === ws.cid) {
    // hand the room to someone on a team if possible, otherwise anyone
    const next = [...room.clients].find(c => c.pid) || [...room.clients][0];
    room.host = next.cid;
    sysChat(room, `${ws.name} left. ${next.name} is now the host.`);
  } else sysChat(room, `${ws.name} left.`);
  sendRoom(room);
}

// ---------------- chat commands ----------------
// Anyone: /help, /roll. The admin account also gets moderation and server tools.
const guestBans = new Map(); // ip -> reason (guests; lasts until the server restarts)
const bannedWs = ws => ws.user ? !!(ws.user.social && ws.user.social.ban) : guestBans.has(ws.ip);
const CMD_HELP = {
  all: ['/help – this list', '/roll [max] – roll a number (1–100 unless you give a max)'],
  admin: ['/kick <name> – remove someone from this game', '/mute <name> [minutes] – stop someone chatting here (default 10)', '/unmute <name>',
    '/ban <name> – ban an account (or a guest, until the server restarts) and kick them from every game', '/unban <name>',
    '/announce <text> – message every game on the server', '/host <name> – hand this game to someone', '/start – start the match', '/end – end the match and go back to the lobby',
    '/rooms – list the games running on the server', '/who <name> – rating, games and where they are playing', '/setelo <name> <rating> – set an account\'s rating'],
};
function findIn(clients, q) {
  q = String(q || '').toLowerCase(); if (!q) return null;
  const list = [...clients].filter(c => c.name);
  return list.find(c => c.name.toLowerCase() === q) || (list.filter(c => c.name.toLowerCase().startsWith(q)).length === 1 ? list.find(c => c.name.toLowerCase().startsWith(q)) : null);
}
const everyone = () => [...rooms.values()].flatMap(r => [...r.clients]);
async function chatCommand(room, ws, text) {
  const [cmd0, ...args] = text.slice(1).split(/\s+/), cmd = (cmd0 || '').toLowerCase(), rest = text.slice(1 + cmd0.length).trim();
  const tell = msg => send(ws, { t: 'chat', sys: 1, m: msg });
  const admin = !!(ws.user && ws.user.admin), w = room.world;
  if (cmd === 'help') { for (const l of CMD_HELP.all.concat(admin ? CMD_HELP.admin : [])) tell(l); return; }
  if (cmd === 'roll') { const max = Math.max(2, Math.min(1e6, parseInt(args[0], 10) || 100)); sysChat(room, `${ws.name} rolled ${1 + Math.floor(Math.random() * max)} (1–${max}).`); return; }
  if (!admin) return tell(`Unknown command /${cmd}. Type /help for the list.`);
  const target = () => { const c = findIn(room.clients, args[0]); if (!c) tell(`No one called "${args[0] || ''}" in this game.`); return c; };
  switch (cmd) {
    case 'kick': { const c = target(); if (!c) return; if (c === ws) return tell('You can\'t kick yourself.'); send(c, { t: 'kicked', msg: 'You were removed from the game by an admin.' }); leave(c); sysChat(room, `${c.name} was removed by an admin.`); return; }
    case 'mute': { const c = target(); if (!c) return; const mins = Math.max(1, Math.min(1440, parseInt(args[1], 10) || 10)); (room.muted || (room.muted = new Map())).set(c.name.toLowerCase(), Date.now() + mins * 60000); sysChat(room, `${c.name} was muted for ${mins} minute${mins === 1 ? '' : 's'}.`); return; }
    case 'unmute': { const c = target(); if (!c) return; if (room.muted) room.muted.delete(c.name.toLowerCase()); sysChat(room, `${c.name} can chat again.`); return; }
    case 'ban': {
      const name = args[0]; if (!name) return tell('Usage: /ban <name>');
      const online = findIn(everyone(), name);
      let u = online && online.user ? online.user : (!online ? track(await store.userByName(name).catch(() => null)) : null);
      if (u && u.admin) return tell('You can\'t ban the admin account.');
      if (u) { u.social = u.social || {}; u.social.ban = { t: Date.now(), by: ws.user.name }; markDirty(u); flushUsers(); }
      else if (online) guestBans.set(online.ip, online.name);
      else return tell(`No account or player called "${name}".`);
      for (const c of everyone()) if (c.name && ((u && c.user === u) || (!u && c.ip === online.ip))) { const r = c.room; send(c, { t: 'kicked', msg: 'You have been banned from online games.' }); leave(c); if (r) sysChat(r, `${c.name} was banned.`); }
      return tell(`${u ? u.name : online.name} is banned${u ? '' : ' (guest, until the server restarts)'}.`);
    }
    case 'unban': {
      const name = args[0]; if (!name) return tell('Usage: /unban <name>');
      const u = track(await store.userByName(name).catch(() => null));
      if (u && u.social && u.social.ban) { delete u.social.ban; markDirty(u); flushUsers(); return tell(`${u.name} is no longer banned.`); }
      for (const [k, n] of guestBans) if (n.toLowerCase() === name.toLowerCase()) { guestBans.delete(k); return tell(`${n} (guest) is no longer banned.`); }
      return tell(`"${name}" isn't banned.`);
    }
    case 'announce': case 'a': { if (!rest) return tell('Usage: /announce <text>'); for (const r of rooms.values()) sysChat(r, `[Announcement] ${rest.slice(0, 140)}`); return; }
    case 'host': { const c = target(); if (!c) return; if (room.ranked) return tell('Matchmade games have no host.'); room.host = c.cid; sysChat(room, `${c.name} is now the host.`); sendRoom(room); return; }
    case 'start': if (w.match.ph !== 'lobby') return tell('The match has already started.'); Sim.startMatch(w); if (w.match.ph === 'lobby') return tell('Could not start: each team needs at least one archer.'); sysChat(room, 'An admin started the match.'); return;
    case 'end': if (w.match.ph === 'lobby') return tell('No match is running.'); Sim.toLobby(w); sysChat(room, 'An admin ended the match.'); return;
    case 'rooms': {
      if (!rooms.size) return tell('No games running.');
      tell(`${rooms.size} game${rooms.size === 1 ? '' : 's'}, ${everyone().length} player${everyone().length === 1 ? '' : 's'}:`);
      for (const r of rooms.values()) tell(`${r.code}${r.name ? ' “' + r.name + '”' : ''}${r.ranked ? ' (ranked)' : ''} – ${r.world.match.ph} – ${[...r.clients].map(c => c.name).filter(Boolean).join(', ')}`);
      return;
    }
    case 'who': {
      const name = args[0]; if (!name) return tell('Usage: /who <name>');
      const online = findIn(everyone(), name);
      const u = online ? (online.user || online.guest) : track(await store.userByName(name).catch(() => null));
      if (!u && !online) return tell(`No one called "${name}".`);
      const c = (u && u.career) || {};
      tell(`${online ? online.name : u.name}: ${online && !online.user ? 'guest' : 'account'}${u && u.social && u.social.ban ? ' (banned)' : ''} · rating ${Math.round(c.elo || ELO_START)} · ${c.matches || 0} matches, ${c.games || 0} battles · ${online && online.room ? 'in game ' + online.room.code : 'not in a game'}`);
      return;
    }
    case 'setelo': {
      const name = args[0], v = parseInt(args[1], 10); if (!name || !Number.isFinite(v)) return tell('Usage: /setelo <name> <rating>');
      const online = findIn(everyone(), name);
      const u = online && online.user ? online.user : track(await store.userByName(name).catch(() => null));
      if (!u) return tell(`No account called "${name}".`);
      u.career = u.career || {}; u.career.elo = Math.max(0, Math.min(4000, v)); markDirty(u); flushUsers();
      return tell(`${u.name}'s rating is now ${u.career.elo}.`);
    }
    default: return tell(`Unknown command /${cmd}. Type /help for the list.`);
  }
}

async function handle(ws, m) {
  if (!m || typeof m !== 'object') return;
  if ((m.t === 'join' || m.t === 'hello') && m.local && !ws.localSet) {
    ws.localSet = true; ws.quiet = m.t === 'join'; // an extra player's game connection doesn't need its own copy of every snapshot
    ws.user = null;
    if (m.auth && typeof m.auth === 'string') { const u = await store.sessionUser(A.hashToken(m.auth)).catch(() => null); ws.user = u ? track(u) : null; }
  }
  if (m.t === 'queue' && m.op !== 'stop' && m.op !== 'cancel' && bannedWs(ws)) return send(ws, { t: 'note', msg: 'You have been banned from online games.' });
  if (await social.handle(ws, m)) return;

  if (m.t === 'join') {
    if (ws.room) leave(ws);
    if (bannedWs(ws)) return send(ws, { t: 'err', msg: 'You have been banned from online games.' });
    let room;
    if (m.create) {
      if (rooms.size >= MAX_ROOMS) return send(ws, { t: 'err', msg: 'The server is full. Try again later.' });
      room = createRoom({ diff: m.diff, map: m.map });
    } else {
      room = rooms.get(String(m.code || '').toUpperCase().trim());
      if (!room) return send(ws, { t: 'err', msg: m.ticket ? 'That match has expired. Search again.' : 'No game with that code. Check it and try again.' });
      // a matchmade game: only people it was made for, with their ticket
      if (room.ranked || m.ticket) { const err = room.ranked ? social.useTicket(ws, room, m.ticket) : 'That match has expired. Search again.'; if (err) return send(ws, { t: 'err', msg: err }); }
      else if (!pwOk(room, m.pw)) return send(ws, { t: 'needpw', code: room.code, msg: m.pw ? 'Wrong password.' : 'This game needs a password.' });
    }
    if (!m.create && !room.ranked && room.clients.size >= (room.max || 8)) return send(ws, { t: 'err', msg: `That game is full (${room.clients.size}/${room.max || 8} players).` });
    // signed-in players always play under their account name and wear their account's title
    ws.name = ws.user ? ws.user.name : cleanName(m.name);
    // guests can't pass themselves off as a registered player
    if (!ws.user && await store.userByName(ws.name).catch(() => null)) ws.name = ws.name.slice(0, 15) + '~';
    // nobody shares a name inside one game: a second "Archer" becomes "Archer 2"
    { const taken = n => [...room.clients].some(c => c !== ws && c.name && c.name.toLowerCase() === n.toLowerCase()); const base = ws.name.slice(0, 13);
      for (let i = 2; taken(ws.name) && i < 99; i++) ws.name = base + ' ' + i; }
    if (!ws.user && m.gt) ws.guest = await loadGuest(m.gt, ws.name);
    ws.title = ws.user ? ws.user.title : null;
    ws.lv = ws.user ? levelOf(ws.user.career).lv : ws.guest && ws.guest.career.games ? levelOf(ws.guest.career).lv : null;
    if (ws.user) Object.assign(ws, lookOf(ws.user));
    if (ws.user) ws.cc = ws.user.country ? flagOf(ws.user) : ws.geo || null;
    ws.el = String(m.el || ''); ws.ro = String(m.ro || ''); ws.pid = null;
    ws.room = room;
    room.clients.add(ws);
    // whoever creates the room starts on Red; everyone else arrives unassigned (or spectating a match in progress) and picks a team
    if (m.create) { room.host = ws.cid; applyRoomCfg(room, Object.assign({ name: '' }, m.room || {}), ws.name); joinTeam(room, ws, 'red'); }
    else if (room.ranked) { if (ws.mmTeam) joinTeam(room, ws, ws.mmTeam); }
    else if (!room.host) room.host = ws.cid;
    send(ws, { t: 'welcome', id: ws.pid, code: room.code, account: ws.user ? ws.user.name : null, v: Sim.VERSION });
    sendRoom(room);
    sysChat(room, room.world.match.ph === 'lobby' || room.world.match.ph === 'over' ? `${ws.name} joined.` : `${ws.name} joined and is spectating until this game ends.`);
    if (room.ranked) social.arrived(room, ws);
    social.presence(ws);
    return;
  }

  const room = ws.room;
  if (!room) return;
  const w = room.world, isHost = room.host === ws.cid;
  switch (m.t) {
    case 'in': if (ws.pid) Sim.setInput(w, ws.pid, m); break;
    case 'ping': send(ws, { t: 'pong', c: m.c }); break;
    case 'loadout': ws.el = String(m.el); ws.ro = String(m.ro); if (ws.pid) Sim.setLoadout(w, ws.pid, ws.el, ws.ro); if (room.ranked && !room.ranked.go) sendRoom(room); break;
    case 'title': {
      // accounts can only wear titles they've earned on this server; guests pick from their own browser's list
      const v = m.v ? String(m.v) : null;
      if (ws.user) { if (v && !(ws.user.ach && ws.user.ach.got && ws.user.ach.got[v])) break; ws.user.title = v; markDirty(ws.user); }
      ws.title = v; if (ws.pid) Sim.setTitle(w, ws.pid, v);
      break;
    }
    case 'choose': if (ws.pid) Sim.choose(w, ws.pid, m.i | 0); break;
    case 'ready': social.draftReady(room, ws); break;
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
      if (ws.chatT.length >= 5 && !(ws.user && ws.user.admin)) { send(ws, { t: 'note', msg: 'Slow down a little.' }); break; }
      ws.chatT.push(now);
      if (text[0] === '/') { await chatCommand(room, ws, text); break; }
      const mute = room.muted && room.muted.get(ws.name.toLowerCase());
      if (mute && mute > now) { send(ws, { t: 'chat', sys: 1, m: `You're muted for ${Math.ceil((mute - now) / 60000)} more minute(s).` }); break; }
      const p = ws.pid && w.players.find(q => q.id === ws.pid);
      broadcast(room, { t: 'chat', n: ws.name, tm: p ? p.team : 'spec', c: p ? p.color : null, m: text, acc: ws.user ? 1 : 0, adm: ws.user && ws.user.admin ? 1 : undefined });
      social.aiReply(room, text);
      break;
    }
    // host-only controls
    case 'roomcfg': if (isHost) { const before = roomState(room); applyRoomCfg(room, m, ws.name); announceRoom(room, before, roomState(room)); sendRoom(room); } break;
    case 'bot':
      if (!isHost) break;
      if (m.op === 'add') Sim.addBot(w, String(m.team));
      if (m.op === 'remove') Sim.removeBot(w, String(m.id));
      if (m.op === 'diff' && Sim.setBotSkill(w, String(m.id), String(m.diff))) { const b = w.players.find(q => q.id === String(m.id)); sysChat(room, `${b.name} is now ${String(m.diff)[0].toUpperCase() + String(m.diff).slice(1)}.`); }
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
  ws.isAlive = true; ws.cid = 'c' + (nextCid++); ws.chatT = []; ws.ip = ip(req);
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
  const bye = () => { if (gone) return; gone = true; ws.ready.then(() => { social.gone(ws); leave(ws); if (ws.user) { markDirty(ws.user); flushUsers(); } }); };
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
    if (!(ws.user || ws.guest) || !ws.pid) continue;
    const p = room.world.players.find(q => q.id === ws.pid);
    const adds = Sim.achFromEvents(evs, ws.pid, p ? p.team : null);
    if (!adds.length) continue;
    const u = ws.user || ws.guest; u.ach = u.ach || {};
    const fresh = Sim.achApply(u.ach, adds);
    markDirty(u);
    if (fresh.length) { Object.assign(ws, lookOf(u)); Sim.setMeta(room.world, ws.pid, lookOf(u)); }
    if (ws.user) send(ws, { t: 'ach', keys: fresh, ach: u.ach }); // guests' browsers keep their own copy
  }
  // matchmaking's AI players earn achievements from real games too, just like everyone else
  if (room.ai) for (const [pid, u] of room.ai) {
    const p = room.world.players.find(q => q.id === pid); if (!p) continue;
    const adds = Sim.achFromEvents(evs, pid, p.team);
    if (!adds.length) continue;
    u.ach = u.ach || {};
    if (Sim.achApply(u.ach, adds).length) Sim.setMeta(room.world, pid, lookOf(u));
    markDirty(u);
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
      // 30 snapshots a second while archers are fighting; 10 in the lobby, upgrade picks and results, where little moves
      const ph = room.world.match.ph;
      // leaving or going back to the lobby: friends' lists say "in a custom game" or "in a lobby"
      if ((ph === 'lobby') !== (room.lastPh === 'lobby') && room.lastPh) for (const c of room.clients) if (c.user && c.pid) social.presence(c);
      room.lastPh = ph;
      const every = ph === 'play' || ph === 'pre' || ph === 'post' ? SNAP_EVERY : SNAP_EVERY * 3;
      if (room.tick % every === 0) {
        const evs = room.world.events.splice(0);
        if (evs.length) { creditAchievements(room, evs); social.aiEvents(room, evs); }
        let watchers = 0; for (const c of room.clients) if (c.readyState === 1 && !c.quiet) watchers++;
        if (watchers) { // built once and sent to everyone in the room, leaving out fields at their resting value
          const msg = JSON.stringify({ t: 'snap', s: Sim.packSnap(Sim.snapshot(room.world)), ev: evs });
          for (const c of room.clients) if (c.readyState === 1 && !c.quiet) c.send(msg);
        }
      }
      if (room.world.records.length) saveRecords(room);
    }
  }
}, 5);

store.init().then(() => store.setOnlyAdmin(OWNER)).then(() => social.initAI()).then(() => {
  server.listen(PORT, () => console.log(`Bowfall server running on http://localhost:${PORT} (${store.kind === 'postgres' ? 'Postgres database' : 'local database file'})`));
}).catch(e => { console.error('Could not open the database:', e.message); process.exit(1); });
process.on('SIGTERM', () => { flushUsers().finally(() => process.exit(0)); });
