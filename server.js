// Bowfall server: the website, accounts, forum, room list, and each room's match (run authoritatively here).
'use strict';
// On a host with a CPU allowance (Render: half a core), work spread over many threads at once uses the allowance up in a
// few milliseconds and the whole server is then paused for the rest of each 100 ms slice. So: compression runs on at most
// two helper threads (and garbage collection on the main thread only: see "start" in package.json).
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || '2';
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
const MAIL = require('./lib/mail');
const O = require('./lib/oauth');
const E = require('./lib/economy')(require('./public/sim.js'));
const PAY = require('./lib/pay');
const { levelOf } = require('./lib/level');
const { countryOf } = require('./lib/geo');
const { rateGame, keyFor, ratingOf, seedRating, START: ELO_START } = require('./lib/rating');

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
const SEASON = require('./lib/season')({ store, Sim, live, track: u => track(u), markDirty: u => markDirty(u), give: (u, n, why) => E.give(u, n, why), START: ELO_START });
setInterval(() => SEASON.check().catch(e => console.error('Season:', e.message)), 60 * 60 * 1000).unref();
function track(u) { if (!u) return null; const have = live.get(u.id); if (have) return have; u.admin = isOwner(u); u.ach = Sim.achMigrate(u.ach || {}); live.set(u.id, u); return u; }
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
    g = { guest: true, id: 'g:' + key, key, name: (d && d.name) || 'Guest', career: (d && d.career) || {}, ach: Sim.achMigrate((d && d.ach) || {}) };
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
  u.ach = Sim.achMigrate(JSON.parse(JSON.stringify(g.ach || {}))); // they hadn't played, so the guest's achievements become theirs
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
const placedOf = u => { const c = u.career || {}; return !!c.ai || (c.rated != null ? c.rated : c.matches || 0) >= 5; };
const publicUser = u => ({ placed: placedOf(u), season: SEASON.info(), status: (u.career && u.career.ai) ? {} : E.statusOf(u), name: u.name, title: u.title, admin: !!u.admin, created: u.created, career: Object.assign({}, u.career || {}, { ai: undefined }), got: Object.keys((u.ach && u.ach.got) || {}), stats: (u.ach && u.ach.stats) || {},
  ai: !!(u.career && u.career.ai), country: flagOf(u), level: levelOf(u.career), border: (u.ach && u.ach.border) || null, avatar: (u.ach && u.ach.avatar) || null,
  tier: (u.ach && u.ach.tier) || {}, play: playstyleOf(u), clip: (u.ach && u.ach.clip) || null, prof: (u.ach && u.ach.prof) || null,
  look: u.career && u.career.ai ? null : lookOf(u), clan: u.career && u.career.ai ? null : (CLANS.of(u.id) ? { tag: CLANS.tagOf(u.id), em: CLANS.emOf(u.id), col: CLANS.colOf(u.id), name: CLANS.of(u.id).name } : null) });
// profile page settings: a backdrop arena, an accent colour, a motto and up to four pinned stats
const PROF_STATS = ['elo', 'eloT', 'matches', 'matchWins', 'rate', 'wins', 'kills', 'kd', 'acc', 'ring', 'bulls', 'dmg', 'best', 'level'];
const PROF_COLS = ['#ffcf5a', '#ff6b5a', '#ff9f43', '#7dff8a', '#4fe3c6', '#5ad1ff', '#7fb6ff', '#c77dff', '#ff7ac8', '#e9edf2'];
function cleanProf(p, prev) {
  const o = Object.assign({}, prev || {});
  if ('bg' in p) o.bg = Sim.MAPS[p.bg] && !Sim.MAPS[p.bg].hidden ? p.bg : null;
  if ('acc' in p) o.acc = PROF_COLS.includes(p.acc) ? p.acc : null;
  if ('motto' in p) o.motto = cleanText(p.motto, 80).replace(/\n/g, ' ') || null;
  if ('pins' in p) o.pins = (Array.isArray(p.pins) ? p.pins : []).map(String).filter((k, i, a) => PROF_STATS.includes(k) && a.indexOf(k) === i).slice(0, 4);
  if ('flag' in p) o.flag = p.flag === 'off' ? 'off' : null; // the big faded flag behind your name (on unless switched off)
  return o;
}

// ---------------- playstyle and achievement rarity ----------------
// Every 10 minutes the server looks at everyone: what share of players has each achievement tier, and where each
// playstyle measure sits among players with at least 10 games (so a profile can say "top 8%").
const PLAY = [
  { k: 'dmg', name: 'Damage dealer', what: 'damage per game', v: c => c.dmg / c.games, fmt: v => Math.round(v) },
  { k: 'acc', name: 'Sharpshooter', what: 'of shots hit', v: c => (c.shots >= 30 ? c.hits / c.shots : null), fmt: v => Math.round(v * 100) + '%' },
  { k: 'surv', name: 'Survivor', what: 'of games survived', v: c => 1 - (c.deaths || 0) / c.games, fmt: v => Math.round(v * 100) + '%' },
  { k: 'evade', name: 'Evasive', what: 'damage taken per game (less is better)', v: c => (c.taken != null && c.tg >= 10 ? c.taken / c.tg : null), low: true, fmt: v => Math.round(v) },
  { k: 'kpg', name: 'Finisher', what: 'knockouts per game', v: c => (c.kills || 0) / c.games, fmt: v => v.toFixed(2) },
  { k: 'apg', name: 'Team player', what: 'assists per game', v: c => (c.assists != null && c.tg >= 10 ? c.assists / c.tg : null), fmt: v => v.toFixed(2) },
  { k: 'ring', name: 'Ring-out specialist', what: 'of knockouts into hazards', v: c => (c.kills >= 10 ? (c.ring || 0) / c.kills : null), fmt: v => Math.round(v * 100) + '%' },
  { k: 'carry', name: 'Carry', what: 'of the team\'s damage in team games', v: c => (c.shareN >= 5 ? c.shareSum / c.shareN : null), fmt: v => Math.round(v * 100) + '%' },
];
let RANKS = { rarity: {}, dist: {}, players: 0, at: 0 };
const pctBelow = (arr, v) => { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; } return arr.length ? lo / arr.length : 0; };
function playstyleOf(u) {
  const c = u && u.career; if (!c || !c.games) return null;
  const out = [];
  for (const P of PLAY) {
    const v = P.v(c); if (v == null || !isFinite(v)) continue;
    const arr = RANKS.dist[P.k] || [], enough = c.games >= 10 && arr.length >= 10, why = c.games < 10 ? 'needs 10 games' : arr.length < 10 ? 'not enough players yet' : null;
    let pct = enough ? pctBelow(arr, v) : null; if (pct != null && P.low) pct = 1 - pct - 1 / arr.length;
    out.push({ k: P.k, name: P.name, what: P.what, value: P.fmt(v), pct: pct == null ? null : Math.max(0, Math.min(1, pct)), why: why || undefined });
  }
  const best = out.filter(x => x.pct != null && x.pct >= 0.6).sort((a, b) => b.pct - a.pct).slice(0, 2).map(x => x.name);
  return { traits: out, style: best.length ? best : (c.games >= 10 ? ['All-rounder'] : []) };
}
async function computeRanks() {
  const all = (await store.leaderboard('games', 100000).catch(() => [])).map(u => live.get(u.id) || u).filter(u => (u.career || {}).games > 0);
  const real = all.filter(u => !social.isAI(u));
  const rarity = {};
  for (const k of Sim.ACH_ORDER) rarity[k] = [1, 2, 3, 4, 5].map(t => real.length ? Math.round(real.filter(u => (Sim.achMigrate(u.ach || (u.ach = {})).tier || {})[k] >= t).length / real.length * 1000) / 10 : null);
  const dist = {};
  for (const P of PLAY) dist[P.k] = all.filter(u => u.career.games >= 10).map(u => P.v(u.career)).filter(v => v != null && isFinite(v)).sort((a, b) => a - b);
  RANKS = { rarity, dist, players: real.length, at: Date.now() };
}
setInterval(() => computeRanks().catch(e => console.error('Ranks:', e.message)), 10 * 60 * 1000).unref();
// training bests: every account's best in each drill, sorted, for "top X%"
const TRAIN = { dist: null, at: 0 };
async function trainDist() {
  if (TRAIN.dist && Date.now() - TRAIN.at < 10 * 60 * 1000) return;
  const all = (await store.leaderboard('games', 100000).catch(() => [])).map(u => live.get(u.id) || u);
  const dist = {}; for (const k of Object.keys(Sim.TRAIN_MAX)) dist[k] = [];
  for (const u of all) { const t = u.career && u.career.train; if (t) for (const k in dist) if (t[k]) dist[k].push(t[k].s); }
  for (const k in dist) dist[k].sort((a, b) => a - b);
  TRAIN.dist = dist; TRAIN.at = Date.now();
}
function trainInsert(k, v) { const d = TRAIN.dist[k]; let i = 0; while (i < d.length && d[i] < v) i++; d.splice(i, 0, v); }
// "top X%": the share of players whose best is at least this good (counting you); in: your score is already in the list
function trainTop(k, v, inList) {
  const d = TRAIN.dist[k], n = d.length + (inList ? 0 : 1);
  const better = d.filter(x => x > v).length;
  return Math.max(0.1, Math.round((better + 1) / Math.max(1, n) * 1000) / 10);
}
const trainHits = new Map();
function trainLimit(key) { const now = Date.now(), h = (trainHits.get(key) || []).filter(t => now - t < 60000); h.push(now); trainHits.set(key, h); return h.length <= 20; }
// the look of a signed-in player's name banner: the border they picked (if they've earned it) and how many achievements they have
const lookOf = u => { const got = (u.ach && u.ach.got) || {}, bd = u.ach && u.ach.border, st = u.guest ? {} : E.statusOf(u); return Object.assign({ bd: bd && got[bd] ? bd : null, na: Object.keys(got).length || null, ow: u.admin ? 1 : null, sp: st.sp || null, fd: st.fd || null, pt: st.pt || null, ct: u.guest ? null : CLANS.tagOf(u.id), cl: u.guest ? null : CLANS.colOf(u.id), ce: u.guest ? null : CLANS.emOf(u.id) }, Sim.bannerOf(u.ach, st)); };
// ---- the owner's switches (kept in the database): whether ranked drafts respect unlocks, and a pinned free rotation
const SETTINGS = { locks: false, rotPin: null, events: [] };
async function loadSettings() {
  const l = await store.getSetting('locks').catch(() => null), r = await store.getSetting('rotPin').catch(() => null), ev = await store.getSetting('stripeEvents').catch(() => null);
  SETTINGS.locks = !!(l && l.on); SETTINGS.rotPin = r || null; SETTINGS.events = Array.isArray(ev) ? ev : [];
  SETTINGS.foundersOff = !!(await store.getSetting('foundersOff').catch(() => null));
}
const rot = () => E.rotation(Date.now(), SETTINGS.rotPin);
const walletOf = u => Object.assign(E.wallet(u, SETTINGS.locks, rot()), { payments: PAY.configured() });
// tell someone online that their Crests, unlocks or status changed (and refresh how their name looks in games)
function walletNote(u, gained, why) {
  const w = walletOf(u);
  for (const r of rooms.values()) for (const c of r.clients) if (c.user === u) { send(c, Object.assign({ t: 'wallet', gained: gained || 0, why: why || null }, w)); if (c.pid) { Object.assign(c, lookOf(u)); Sim.setMeta(r.world, c.pid, lookOf(u)); } }
  social.walletNote(u, Object.assign({ t: 'wallet', gained: gained || 0, why: why || null }, w));
}
// the founder pack is on sale until FOUNDERS_UNTIL (a date, e.g. 2027-03-31) if set, or until the owner closes it (/founders off)
const foundersOpen = () => SETTINGS.foundersOff ? false : process.env.FOUNDERS_UNTIL ? Date.now() < +new Date(process.env.FOUNDERS_UNTIL) : true;
// what Stripe tells us: payments completed, membership renewals and cancellations. Each event is applied once.
async function stripeEvent(ev) {
  if (!ev || !ev.id || SETTINGS.events.includes(ev.id)) return;
  const o = (ev.data && ev.data.object) || {};
  const uidOf = x => +((x && x.metadata && x.metadata.uid) || 0);
  let uid = 0;
  if (ev.type === 'checkout.session.completed') uid = uidOf(o) || +o.client_reference_id;
  else if (ev.type === 'invoice.paid') uid = uidOf(o.subscription_details) || uidOf(o.parent && o.parent.subscription_details) || uidOf(((o.lines || {}).data || [])[0]);
  else if (ev.type.startsWith('customer.subscription.')) uid = uidOf(o);
  else return;
  const u = uid ? track(await store.userById(uid)) : null;
  if (!u) { console.error('Stripe event for unknown account', ev.type, uid); return; }
  const c = u.career || (u.career = {}), soc = u.social || (u.social = {}), bill = soc.bill || (soc.bill = {});
  let gained = 0, why = null;
  if (ev.type === 'checkout.session.completed') {
    if (o.payment_status && o.payment_status !== 'paid' && o.mode !== 'subscription') return; // not paid yet (e.g. bank transfer): wait for the next event
    if (o.customer) bill.cust = o.customer;
    const kind = (o.metadata || {}).kind, item = (o.metadata || {}).item;
    if (kind === 'supporter') { bill.sub = o.subscription || bill.sub; const sp = c.sup || (c.sup = {}); sp.active = true; sp.cancelling = false; sp.since = sp.since || Date.now(); sp.until = Math.max(sp.until || 0, Date.now() + 32 * 86400000); why = 'supporter'; }
    else if (kind === 'founder') { if (!c.founder) { c.founder = Date.now(); gained = E.give(u, E.FOUNDER_CRESTS, 'founder'); } why = 'founder'; }
    else if (kind === 'donate') { c.patron = true; bill.donated = (bill.donated || 0) + (o.amount_total || 0); why = 'donate'; }
    else if (kind === 'unlock') { E.unlock(u, item); why = 'unlock'; }
    (bill.log = bill.log || []).unshift({ t: Date.now(), kind, item, amount: o.amount_total || 0, id: o.id }); bill.log.length = Math.min(bill.log.length, 50);
  } else if (ev.type === 'invoice.paid') {
    const sp = c.sup || (c.sup = {}); sp.active = true; sp.since = sp.since || Date.now(); sp.months = (sp.months || 0) + 1;
    const end = (((o.lines || {}).data || [])[0] || {}).period ? o.lines.data[0].period.end : o.period_end;
    sp.until = Math.max(sp.until || 0, (end ? end * 1000 : Date.now() + 31 * 86400000) + 86400000);
    gained = E.give(u, E.SUP_STIPEND, 'stipend'); why = 'renewal';
  } else if (ev.type === 'customer.subscription.updated' || ev.type === 'customer.subscription.deleted') {
    const sp = c.sup || (c.sup = {});
    if (ev.type === 'customer.subscription.deleted' || ['canceled', 'unpaid', 'incomplete_expired'].includes(o.status)) { sp.active = false; sp.cancelling = false; why = 'ended'; }
    else { sp.active = ['active', 'trialing', 'past_due'].includes(o.status); sp.cancelling = !!o.cancel_at_period_end; if (o.current_period_end) sp.until = o.current_period_end * 1000 + 86400000; why = sp.cancelling ? 'cancelling' : 'updated'; }
  }
  SETTINGS.events.push(ev.id); if (SETTINGS.events.length > 500) SETTINGS.events.splice(0, SETTINGS.events.length - 500);
  markDirty(u); await flushUsers(); store.setSetting('stripeEvents', SETTINGS.events).catch(() => {});
  walletNote(u, gained, why);
}
// in a ranked room with locks on, swap a locked element or role for a free one
function lockedFix(ws) {
  if (!SETTINGS.locks) return;
  const u = ws.user || ws.guest, R = rot();
  if (!E.owns(u, ws.el, true, R)) ws.el = 'frost';
  if (!E.owns(u, ws.ro, true, R)) ws.ro = 'sniper';
}
// supporter / founder / patron flags for lists (leaderboards)
const stOf = u => { if (!u || u.guest || (u.career && u.career.ai)) return {}; const st = E.statusOf(u); const o = {}; if (st.sp) o.sp = st.sp; if (st.fd) o.fd = 1; if (st.pt) o.pt = 1; return o; };
// ---- player arenas: loaded from the database and registered with the simulation as 'a<id>'
const ARENAS = new Map(); // id -> the database row (def, name, author, flags)
const arenaKey = id => 'a' + id;
const canPublish = u => !!u && (E.supActive(u) || !!(u.career && u.career.founder) || !!u.admin);
const arenaLimit = u => (canPublish(u) ? 25 : 3);
function useArenaRow(a) { if (!a) return null; ARENAS.set(a.id, a); return Sim.registerArena(arenaKey(a.id), a.def, { author: a.author }) ? a : null; }
async function loadArena(id) { const have = ARENAS.get(id); if (have && Sim.MAPS[arenaKey(id)]) return have; return useArenaRow(await store.arenaGet(id).catch(() => null)); }
const arenaOut = (a, me) => ({ id: a.id, code: Sim.arenaCode(a.id), name: a.name, author: a.author, theme: a.def && a.def.theme, pub: a.pub, featured: a.featured, ranked: a.ranked, votes: a.votes, plays: a.plays, voted: me ? (a.voters || []).includes(me.id) : false, mine: me ? a.userId === me.id : false, def: a.def, updated: a.updated });
// what clients need to draw a room's arena when it's a player-made one
function arenaInfo(key) { const M = Sim.MAPS[key]; if (!M || !M.custom) return undefined; const id = +key.slice(1), a = ARENAS.get(id); return { key, id, code: Sim.arenaCode(id), name: M.name, author: a ? a.author : null, def: M.def }; }
// the ranked map pool: the built-in arenas plus any the owner has put in the ranked rotation
let RANKED_ARENAS = [];
async function loadRankedArenas() { const list = await store.arenasWhere('ranked').catch(() => []); RANKED_ARENAS = list.filter(useArenaRow).map(a => arenaKey(a.id)); }
const rankedMaps = () => Sim.MAP_KEYS.concat(RANKED_ARENAS.filter(k => Sim.MAPS[k]));
const isAccount = (room, u) => !!u && !u.guest && !(u.career && u.career.ai) && [...room.clients].some(c => c.user === u);

function careerAdd(u, rec, team) {
  const c = u.career || (u.career = {});
  const add = (k, n) => { c[k] = Math.round(((c[k] || 0) + (n || 0)) * 10) / 10; };
  if (rec.type === 'game') {
    const p = rec.pl;
    add('games', 1); if (p.w === 1) add('wins', 1); add('kills', p.k); if (!p.s) add('deaths', 1);
    add('dmg', p.dmg); add('ring', p.ring); add('shots', p.sh); add('hits', p.hi);
    add('taken', p.tk); add('assists', p.a); add('bulls', p.bu); add('tg', 1);
    // share of the team's damage in team games (for the playstyle "carry" measure)
    if (rec.teamDmg != null && rec.teamSize > 1) { add('shareSum', rec.teamDmg > 0 ? Math.round(p.dmg / rec.teamDmg * 1000) / 1000 : 1 / rec.teamSize); add('shareN', 1); }
    c.roles = c.roles || {}; c.roles[p.ro] = (c.roles[p.ro] || 0) + 1;
    c.roleW = c.roleW || {}; if (p.w === 1) c.roleW[p.ro] = (c.roleW[p.ro] || 0) + 1;
    // personal bests in a single game, for the highscores
    c.best = c.best || {};
    for (const [k, v] of [['k', p.k], ['dmg', Math.round(p.dmg || 0)], ['ring', p.ring]]) if ((v || 0) > (c.best[k] || 0)) c.best[k] = v;
    c.els = c.els || {}; c.els[p.el] = (c.els[p.el] || 0) + 1;
    c.elW = c.elW || {}; if (p.w === 1) c.elW[p.el] = (c.elW[p.el] || 0) + 1; // element wins, for mastery
  } else if (rec.type === 'match') {
    add('matches', 1); if (rec.win === team) add('matchWins', 1);
  }
  markDirty(u);
}
// the account (or guest record, or matchmaking AI player) behind a player in a room
function userOfPid(room, pid) {
  const ws = [...room.clients].find(c => c.pid === pid && (c.user || c.guest));
  if (ws) return ws.user || ws.guest;
  if (room.away) for (const a of room.away.values()) if (a.pid === pid) return a.u; // dropped out of a ranked match: still theirs

  return room.ai && room.ai.has(pid) ? room.ai.get(pid) : null;
}
const boardCache = new Map(); // leaderboard and highscores answers, briefly
let balanceCache = null; // the /api/balance response, until the next game is saved
function saveRecords(room) {
  const recs = room.world.records.splice(0);
  if (!recs.length) return;
  const humans = room.world.players.filter(p => !p.bot).length, counts = achCounts(room);
  for (const r of recs) {
    if (r.type === 'game') {
      // this match so far: games won by each side, and each archer's knockouts, assists, deaths, damage and ring-outs
      const T = room.tally && room.tally.mid === r.mid ? room.tally : (room.tally = { mid: r.mid, gw: { red: 0, blue: 0 }, p: {} });
      if (r.win) T.gw[r.win]++;
      for (const p of r.p) {
        const t = T.p[p.id] || (T.p[p.id] = { k: 0, a: 0, d: 0, dmg: 0, ring: 0, games: 0 });
        t.k += p.k; t.a += p.a || 0; t.d += p.s ? 0 : 1; t.dmg += p.dmg; t.ring += p.ring; t.games++; t.el = p.el; t.ro = p.ro; t.tm = p.tm;
      }
      for (const p of r.p) {
        const u = userOfPid(room, p.id); if (!u) continue;
        const team = r.p.filter(q => q.tm === p.tm);
        careerAdd(u, { type: 'game', pl: p, teamDmg: team.reduce((s2, q) => s2 + q.dmg, 0), teamSize: team.length });
        if (counts && isAccount(room, u)) { const n = E.earnGame(u, p.w === 1); (room.crestGain || (room.crestGain = new Map())).set(u, ((room.crestGain.get(u)) || 0) + n); }
        if (counts) achNote(u, Sim.achApply(u.ach || (u.ach = {}), Sim.achFromGame(r, p.id, (u.ach.stats || {}))));
      }
      // ratings only change when the whole match is decided, so remember who played (and as what) for then
      room.rateRoster = { mid: r.mid, df: r.df, p: r.p.map(p => ({ id: p.id, b: p.b, df: p.df, tm: p.tm, ro: p.ro })) };
    } else if (r.type === 'match') {
      const ros = room.rateRoster && room.rateRoster.mid === r.mid ? room.rateRoster : null;
      const T = room.tally && room.tally.mid === r.mid ? room.tally : { gw: { red: 0, blue: 0 }, p: {} };
      room.rateRoster = null; room.tally = null;
      const rated = new Map(), users = new Map();
      if (ros) for (const p of ros.p) { const u = userOfPid(room, p.id); if (u) users.set(p.id, u); }
      if (ros && r.win && room.ranked) { // only matchmade (ranked) games change ratings; custom games don't
        const key = keyFor(room.ranked.mode);
        // each player's share of what their team did this match: knockouts, assists (half) and damage (per 40)
        const contrib = pid => { const t = T.p[pid] || {}; return (t.k || 0) + 0.5 * (t.a || 0) + (t.dmg || 0) / 40; };
        const share = p => { const team = ros.p.filter(q => q.tm === p.tm), tot = team.reduce((s2, q) => s2 + contrib(q.id), 0); return tot > 0 ? contrib(p.id) / tot * team.length : 1; };
        const rec = { win: r.win, df: ros.df, key, p: ros.p.map(p => Object.assign({}, p, { w: p.tm === r.win ? 1 : 0, share: share(p) })) };
        // clans: a team made up only of one clan's members (two or more, no AI players, guests or outsiders) plays for
        // the clan's rating, against the other team's clan rating if it is a clan team too, or its players' average rating
        const side = tm => { const ps = ros.p.filter(p => p.tm === tm), us = ps.map(p => users.get(p.id));
          const clan = ps.length >= 2 && us.every(u => u && !u.guest && !(u.career && u.career.ai)) ? CLANS.of(us[0].id) : null;
          const ok = clan && us.every(u => CLANS.of(u.id) === clan);
          const rs = us.filter(Boolean).map(u => ratingOf(u, key));
          return { tm, us, clan: ok ? clan : null, avg: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : ELO_START }; };
        const sides = [side('red'), side('blue')];
        if (sides[0].clan && sides[0].clan === sides[1].clan) sides[0].clan = sides[1].clan = null; // a clan playing itself doesn't count
        const before = sides.map(S => (S.clan ? S.clan.rating : S.avg));
        sides.forEach((S, i) => {
          if (!S.clan) return;
          const out = CLANS.record(S.clan.id, r.win === S.tm, before[1 - i]); if (!out) return;
          for (const u of S.us) { const ws = [...room.clients].find(q => q.user === u); if (ws) send(ws, { t: 'clanRated', tag: out.tag, em: out.em, name: out.name, rating: out.rating, d: out.d }); }
        });
        for (const [k, v] of rateGame(rec, users)) rated.set(k, v); // worked out for everyone first, from the ratings before this match
        for (const [pid, u] of users) {
          const x = rated.get(u.id); if (!x) continue;
          const c = u.career; c[key] = x.elo; c.rated = (c.rated != null ? c.rated : Math.max(0, (c.matches || 0) - 1)) + 1;
          const pk = key === 'elo' ? 'eloPeak' : 'eloTPeak'; c[pk] = Math.max(c[pk] || ELO_START, x.elo);
          SEASON.noteRating(u, key, x.elo);
          c.relo = c.relo || {}; c.relo[x.role] = x.roleElo;
          const ws = [...room.clients].find(q => q.user === u || q.guest === u);
          if (ws) send(ws, { t: 'rated', elo: x.elo, d: x.delta, key, guest: u.guest ? 1 : undefined, pl: placedOf(u) ? 1 : 0, left: Math.max(0, 5 - (c.rated || 0)) });
        }
      }
      for (const [pid, u] of users) {
        const q = room.world.players.find(q2 => q2.id === pid), t = T.p[pid]; if (!q) continue;
        careerAdd(u, r, q.team);
        const won = r.win === q.team, opp = q.team === 'red' ? 'blue' : 'red', x = rated.get(u.id);
        if (counts && isAccount(room, u)) { const n = E.earnMatch(u, won); (room.crestGain || (room.crestGain = new Map())).set(u, ((room.crestGain.get(u)) || 0) + n); }
        if (counts) achNote(u, Sim.achApply(u.ach || (u.ach = {}), Sim.achFromMatch(won, { lostGames: T.gw[opp], ring: t ? t.ring : 0, giant: !!(x && x.opp - x.mine >= 150) }, (u.ach.stats || {}))));
        // match history: the last 10 ranked matches
        if (room.ranked && t) {
          const c = u.career; c.hist = c.hist || [];
          c.hist.unshift({ t: Date.now(), mode: room.ranked.mode, won: won ? 1 : 0, score: [T.gw[q.team], T.gw[opp]], k: t.k, d: t.d, a: t.a, el: t.el, ro: t.ro, map: r.map, de: x ? x.delta : undefined });
          c.hist.length = Math.min(c.hist.length, 10);
          markDirty(u);
        }
      }
    }
  }
  if (room.crestGain && recs.some(r => r.type === 'match')) { for (const [u, n] of room.crestGain) { markDirty(u); walletNote(u, n, 'match'); } room.crestGain = null; }
  for (const ws of room.clients) if ((ws.user || ws.guest) && ws.pid) { const u = ws.user || ws.guest; Object.assign(ws, lookOf(u)); Sim.setMeta(room.world, ws.pid, Object.assign({ lv: levelOf(u.career).lv }, lookOf(u))); }
  if (room.ai) for (const [pid, u] of room.ai) Sim.setMeta(room.world, pid, Object.assign({ lv: levelOf(u.career).lv }, lookOf(u)));
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
const forgotLimit = A.limiter(5, 15 * 60 * 1000), authLimit = A.limiter(12, 60 * 1000), postLimit = A.limiter(6, 60 * 1000), threadLimit = A.limiter(3, 5 * 60 * 1000);
const clipLimit = A.limiter(6, 60 * 1000), clanLimit = A.limiter(40, 60 * 1000), clanNewLimit = A.limiter(6, 10 * 60 * 1000);
const cleanText = (s, max) => String(s || '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, max);

async function api(req, res, url) {
  const route = url.pathname.slice(4); // after /api
  const method = req.method;
  let m;
  const me = await userFromReq(req);
  const body = method === 'POST' ? await readBody(req, route === '/clip' ? 700 * 1024 : undefined).catch(() => null) : null;
  if (method === 'POST' && !body) return json(res, 400, { error: 'Bad request.' });

  // balance data for the in-game screen
  if (route === '/balance' && method === 'GET') {
    if (!me || !me.admin) return json(res, 403, { error: 'Only the game owner can see balance data.' });
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
    const email = String(body.email || '').trim();
    if (!MAIL.validEmail(email)) return json(res, 400, { error: 'Enter your email address. It is only used to reset your password.' });
    if (await userWithEmail(email)) return json(res, 409, { error: 'That email already has an account. Sign in, or reset your password.' });
    const u = await store.createUser(name, A.hashPassword(body.password), name.toLowerCase() === OWNER);
    if (!u) return json(res, 409, { error: 'That name is taken.' });
    u.social = Object.assign(u.social || {}, { email });
    await store.saveUser(u);
    return login(req, res, u, [], await adoptGuest(u, body.guest));
  }
  // forgotten password: email a one-use link that lasts an hour (the reply is the same whether or not the account exists)
  if (route === '/forgot' && method === 'POST') {
    if (!forgotLimit(ip(req))) return json(res, 429, { error: 'Too many requests. Wait a few minutes and try again.' });
    if (!MAIL.configured()) return json(res, 503, { error: "Password emails aren't set up on this server yet. Ask an admin for help." });
    const who = String(body.who || '').trim();
    const u = who.includes('@') ? await userWithEmail(who) : await store.userByName(who).then(x => x && (live.get(x.id) || x));
    const email = u && u.social && u.social.email;
    if (u && email && !(u.career && u.career.ai)) {
      const tok = A.newToken();
      u.social.reset = { h: A.hashToken(tok), exp: Date.now() + 3600 * 1000 };
      await store.saveUser(u);
      const link = siteBase(req) + '/#/reset?t=' + tok;
      MAIL.send(email, 'Reset your Bowfall password',
        `Hi ${u.name},\n\nSomeone asked to reset the password for your Bowfall account. To pick a new one, open this link within the next hour:\n\n${link}\n\nIf that wasn't you, you can ignore this email and nothing will change.`,
        `<p>Hi ${u.name},</p><p>Someone asked to reset the password for your Bowfall account. To pick a new one, open this link within the next hour:</p><p><a href="${link}">Reset my password</a></p><p>If that wasn't you, you can ignore this email and nothing will change.</p>`
      ).catch(e => console.error('Mail failed:', e.message));
    }
    return json(res, 200, { ok: true });
  }
  if (route === '/reset' && method === 'POST') {
    if (!authLimit(ip(req))) return json(res, 429, { error: 'Too many attempts. Wait a minute and try again.' });
    const h = A.hashToken(String(body.token || ''));
    let u = null;
    for (const x of live.values()) if (x.social && x.social.reset && x.social.reset.h === h) { u = x; break; }
    if (!u) { const x = await store.userByReset(h); u = x && (live.get(x.id) || x); if (u && !(u.social && u.social.reset && u.social.reset.h === h)) u = null; }
    if (!u || u.social.reset.exp < Date.now()) return json(res, 400, { error: 'That reset link has expired or was already used. Ask for a new one.' });
    if (!A.validPassword(body.password)) return json(res, 400, { error: 'Passwords need at least 6 characters.' });
    u.passHash = A.hashPassword(body.password);
    delete u.social.reset;
    await store.setPassword(u.id, u.passHash);
    await store.saveUser(u);
    await store.deleteSessionsOf(u.id);   // sign out everywhere else
    return login(req, res, u);
  }
  // add or change the account's email (needs your password if you have one)
  if (route === '/email' && method === 'POST') {
    if (!me) return json(res, 401, { error: 'Sign in first.' });
    if (me.passHash && !A.checkPassword(body.current, me.passHash)) return json(res, 401, { error: 'Your current password is wrong.' });
    const email = String(body.email || '').trim();
    if (!MAIL.validEmail(email)) return json(res, 400, { error: "That doesn't look like an email address." });
    const other = await userWithEmail(email);
    if (other && other.id !== me.id) return json(res, 409, { error: 'That email is already on another account.' });
    const old = me.social && me.social.email;
    me.social = Object.assign(me.social || {}, { email });
    await store.saveUser(me);
    if (old && old.toLowerCase() !== email.toLowerCase()) securityMail(req, me, 'The email on your Bowfall account was changed',
      `The email address on your Bowfall account (${me.name}) was changed to ${maskEmail(email)}. Password reset emails will go there from now on.`, old);
    return json(res, 200, { ok: true, email });
  }
  // delete your account: type your player name (and your password, if you have one). Your stats, ratings, achievements,
  // email, sign-in links and clan membership are removed; forum posts stay, shown as from a deleted player.
  if (route === '/account/delete' && method === 'POST') {
    if (!me) return json(res, 401, { error: 'Sign in first.' });
    if (me.admin) return json(res, 400, { error: "The owner's account can't be deleted from here." });
    if (String(body.confirm || '').trim().toLowerCase() !== me.name.toLowerCase()) return json(res, 400, { error: 'Type your player name exactly to confirm.' });
    if (me.passHash && !A.checkPassword(body.current, me.passHash)) return json(res, 401, { error: 'Your password is wrong.' });
    const email = me.social && me.social.email, oldName = me.name;
    if (CLANS.of(me.id)) await CLANS.leave(me);
    for (const p of await store.loginsOf(me.id)) await store.removeLogin(p, me.id);
    await store.deleteSessionsOf(me.id);
    await store.anonymiseUser(me.id); if (store.dmForget) await store.dmForget(me.id).catch(() => {});
    live.delete(me.id); dirty.delete(me.id);
    for (const r of rooms.values()) for (const c of r.clients) if (c.user && c.user.id === me.id) { try { c.close(); } catch (e) {} }
    if (email) MAIL.send(email, 'Your Bowfall account was deleted', `Your Bowfall account (${oldName}) has been deleted, as you asked. Thanks for playing.`).catch(() => {});
    return json(res, 200, { ok: true }, { 'Set-Cookie': A.sessionCookie(null, req) });
  }
  if (route === '/legal' && method === 'GET') return json(res, 200, { contact: process.env.CONTACT_EMAIL || null, payments: PAY.configured(), mail: MAIL.configured(), providers: O.enabled() });
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
    return json(res, 200, { user: Object.assign(publicUser(me), { id: me.id, ach: me.ach || {}, logins: await store.loginsOf(me.id), hasPassword: !!me.passHash, email: (me.social && me.social.email) || null, mailOn: MAIL.configured(), countryRaw: me.country || null }) });
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
    if (pend.email && !(await userWithEmail(pend.email))) { u.social = Object.assign(u.social || {}, { email: pend.email }); await store.saveUser(u); }
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
    const had = !!me.passHash;
    me.passHash = A.hashPassword(body.password);
    await store.setPassword(me.id, me.passHash);
    await store.deleteSessionsOf(me.id); // signed out everywhere else; this browser gets a fresh session below
    securityMail(req, me, had ? 'Your Bowfall password was changed' : 'A password was added to your Bowfall account',
      `The password for your Bowfall account (${me.name}) was ${had ? 'changed' : 'set'} just now, and any other devices were signed out.`);
    return login(req, res, me);
  }
  if (route === '/title' && method === 'POST') {
    if (!me) return json(res, 401, { error: 'Sign in first.' });
    const key = body.title ? String(body.title) : null;
    if (key && !(me.ach && me.ach.got && me.ach.got[key])) return json(res, 400, { error: "You haven't unlocked that title." });
    me.title = key; markDirty(me);
    return json(res, 200, { ok: true, title: me.title });
  }
  // ---- the store: Crests, unlocks and payments
  if (route === '/wallet' && method === 'GET') return json(res, 200, me ? walletOf(me) : Object.assign(E.wallet(null, SETTINGS.locks, rot()), { guest: true, payments: PAY.configured() }));
  if (route === '/unlock' && method === 'POST') {
    if (!me) return json(res, 401, { error: 'Sign in to unlock things.' });
    const err = E.buyWithCrests(me, String(body.key || '')); if (err) return json(res, 400, { error: err });
    markDirty(me); flushUsers(); walletNote(me, 0, 'unlock');
    return json(res, 200, walletOf(me));
  }
  if (route === '/checkout' && method === 'POST') {
    if (!me) return json(res, 401, { error: 'Sign in first, so the purchase goes on your account.' });
    if (!PAY.configured()) return json(res, 503, { error: 'Payments aren\'t set up on this server yet.' });
    const kind = String(body.kind || ''), P = E.PRICES, bill = (me.social && me.social.bill) || {};
    let o = null;
    if (kind === 'supporter') { if (E.supActive(me)) return json(res, 400, { error: 'You\'re already a supporter. Thank you!' }); o = { mode: 'subscription', name: 'Bowfall Supporter (monthly)', amount: P.supporter }; }
    else if (kind === 'founder') { if (me.career && me.career.founder) return json(res, 400, { error: 'You\'re already a founder.' }); if (!foundersOpen()) return json(res, 400, { error: 'The founder pack is no longer available.' }); o = { mode: 'payment', name: 'Bowfall Founder pack', amount: P.founder }; }
    else if (kind === 'donate') { const a = Math.round(+body.amount); if (!(a >= P.donateMin && a <= P.donateMax)) return json(res, 400, { error: 'Pick an amount between £1 and £200.' }); o = { mode: 'payment', name: 'Support Bowfall', amount: a }; }
    else if (kind === 'unlock') { const k = String(body.item || ''); if (!E.isPremium(k)) return json(res, 400, { error: 'That one is free for everyone.' }); if ((me.career.unlocks || []).includes(k) || me.career.founder) return json(res, 400, { error: 'You already own that.' }); o = { mode: 'payment', name: 'Unlock ' + ((Sim.ELEMENTS[k] || Sim.ROLES[k]).name), amount: P.unlock, item: k }; }
    else return json(res, 400, { error: 'Unknown item.' });
    const base = process.env.PUBLIC_URL ? process.env.PUBLIC_URL.replace(/\/$/, '') : (req.headers['x-forwarded-proto'] || 'http') + '://' + req.headers.host;
    try { const sess = await PAY.checkout(Object.assign(o, { uid: me.id, kind, base, customer: bill.cust })); return json(res, 200, { url: sess.url }); }
    catch (e) { console.error('Checkout:', e.message); return json(res, 502, { error: 'Could not start the payment. Try again in a moment.' }); }
  }
  if (route === '/billing' && method === 'POST') {
    if (!me) return json(res, 401, { error: 'Sign in first.' });
    const cust = me.social && me.social.bill && me.social.bill.cust; if (!cust || !PAY.configured()) return json(res, 400, { error: 'No membership to manage.' });
    const base = process.env.PUBLIC_URL ? process.env.PUBLIC_URL.replace(/\/$/, '') : (req.headers['x-forwarded-proto'] || 'http') + '://' + req.headers.host;
    try { const p2 = await PAY.portal(cust, base + '/play'); return json(res, 200, { url: p2.url }); } catch (e) { return json(res, 502, { error: 'Could not open the billing page.' }); }
  }
  // ---- player arenas
  if (route === '/arenas' && method === 'GET') {
    const which = url.searchParams.get('list') || 'pub';
    let rows;
    if (which === 'mine') { if (!me) return json(res, 200, { arenas: [], limit: 3 }); rows = await store.arenasOf(me.id); }
    else rows = await store.arenasWhere(which === 'featured' ? 'featured' : which === 'ranked' ? 'ranked' : 'pub');
    const sort = url.searchParams.get('sort');
    if (sort === 'new') rows.sort((a, b) => b.updated - a.updated);
    return json(res, 200, { arenas: rows.slice(0, 100).map(a => arenaOut(a, me)), limit: me ? arenaLimit(me) : 3, canPublish: canPublish(me) });
  }
  if ((m = route.match(/^\/arenas\/(A[0-9A-Za-z]{1,8}|\d{1,9})$/)) && method === 'GET') {
    const id = /^\d+$/.test(m[1]) ? +m[1] : Sim.arenaId(m[1]); const a = id ? await store.arenaGet(id) : null;
    if (!a) return json(res, 404, { error: 'No arena with that code.' });
    return json(res, 200, { arena: arenaOut(a, me) });
  }
  if (route === '/arenas' && method === 'POST') {
    if (!me) return json(res, 401, { error: 'Sign in to save arenas.' });
    const c = Sim.cleanArena(body.def); if (c.errors.length) return json(res, 400, { error: c.errors[0], errors: c.errors });
    const name = String(body.name || c.def.name).replace(/[\u0000-\u001f]/g, '').trim().slice(0, 32) || 'My arena'; c.def.name = name;
    const pub = !!body.pub;
    if (pub && !canPublish(me)) return json(res, 403, { error: 'Publishing arenas is a supporter perk. You can still save and share them by code.' });
    if (body.id) {
      const a = await store.arenaGet(+body.id); if (!a || a.userId !== me.id) return json(res, 404, { error: 'Not your arena.' });
      await store.arenaUpdate(a.id, { name, def: c.def, pub });
      const fresh = await store.arenaGet(a.id); useArenaRow(fresh); return json(res, 200, { arena: arenaOut(fresh, me) });
    }
    const mine = await store.arenasOf(me.id);
    if (mine.length >= arenaLimit(me)) return json(res, 403, { error: canPublish(me) ? `You can keep up to ${arenaLimit(me)} arenas.` : `Free accounts can keep ${arenaLimit(me)} arenas; supporters get 25. Delete one, or overwrite it.` });
    const id = await store.arenaCreate(me.id, name, c.def, pub); const fresh = await store.arenaGet(id); useArenaRow(fresh);
    return json(res, 200, { arena: arenaOut(fresh, me) });
  }
  if ((m = route.match(/^\/arenas\/(\d{1,9})\/(delete|vote)$/)) && method === 'POST') {
    if (!me) return json(res, 401, { error: 'Sign in first.' });
    const a = await store.arenaGet(+m[1]); if (!a) return json(res, 404, { error: 'No arena with that code.' });
    if (m[2] === 'delete') { if (a.userId !== me.id && !me.admin) return json(res, 403, { error: 'Not your arena.' }); await store.arenaUpdate(a.id, { deleted: true, pub: false, featured: false, ranked: false }); ARENAS.delete(a.id); RANKED_ARENAS = RANKED_ARENAS.filter(k => k !== arenaKey(a.id)); return json(res, 200, { ok: true }); }
    const voters = new Set(a.voters || []); if (voters.has(me.id)) voters.delete(me.id); else voters.add(me.id);
    await store.arenaUpdate(a.id, { voters: [...voters], votes: voters.size });
    return json(res, 200, { votes: voters.size, voted: voters.has(me.id) });
  }
  if (route === '/clienterr' && method === 'POST') { // errors from players' browsers (see clientError in index.html)
    if (!trainLimit('err:' + ip(req))) return json(res, 429, {});
    const t = k => String(body[k] || '').slice(0, k === 's' ? 1200 : 200);
    PERF.errors.unshift({ t: Date.now(), name: me ? me.name : 'guest', where: t('where'), m: t('m'), s: t('s'), v: t('v'), mode: t('mode'), ph: t('ph'), map: t('map'), ua: t('ua') });
    PERF.errors.length = Math.min(PERF.errors.length, 60);
    console.error('Client error:', t('where'), t('m'), '|', (t('s').split('\n')[1] || '').trim());
    return json(res, 200, { ok: true });
  }
  if (route === '/profile' && method === 'GET') {
    if (!me || !me.admin) return json(res, 403, { error: 'Only the game owner can see this.' });
    if (PROF.running) return json(res, 202, { running: true });
    if (!PROF.result) return json(res, 404, { error: 'No profile yet. Type /profile in a game chat to record one.' });
    if (url.searchParams.get('raw')) { res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="bowfall-server.cpuprofile"', 'Cache-Control': 'no-store' }); return res.end(JSON.stringify(PROF.raw)); }
    return json(res, 200, PROF.result, { 'Content-Disposition': 'attachment; filename="bowfall-server-profile.json"' });
  }
  if (route === '/perf' && method === 'GET') {
    if (!me || !me.admin) return json(res, 403, { error: 'Only the game owner can see this.' });
    return json(res, 200, { now: PERF.now, errors: PERF.errors, history: PERF.hist, reports: PERF.reports.slice(-100), node: process.version, uptime: Math.round(process.uptime()) });
  }
  if (route === '/achrarity' && method === 'GET') return json(res, 200, { rarity: RANKS.rarity, players: RANKS.players });
  // training drills: your best score in each (kept on your account), and where it ranks among everyone's bests
  if (route === '/train' && method === 'GET') {
    await trainDist();
    const mine = (me && me.career && me.career.train) || {}, out = {};
    for (const k of Object.keys(Sim.TRAIN_MAX)) { const b = mine[k]; out[k] = Object.assign({ n: TRAIN.dist[k].length }, b ? { s: b.s, g: b.g, top: trainTop(k, b.s, true) } : {}); }
    return json(res, 200, { drills: out });
  }
  if (route === '/train' && method === 'POST') {
    const k = String(body.kind || ''), sc = Math.round(+body.score);
    if (!Sim.TRAIN_MAX[k] || !isFinite(sc) || sc < 0 || sc > Sim.TRAIN_MAX[k]) return json(res, 400, { error: 'Bad score.' });
    if (!trainLimit(me ? 'u' + me.id : ip(req))) return json(res, 429, { error: 'Slow down.' });
    await trainDist();
    let best = sc, isNew = false;
    if (me) {
      const c = me.career || (me.career = {}), t = c.train || (c.train = {}), old = t[k];
      const g = Sim.trainGrade(k, sc, body.clean !== false), up = !old || sc > old.s;
      if (up || Sim.gradeBest(g, old.g) !== old.g) {
        isNew = up;
        if (up) { if (old) { const d = TRAIN.dist[k], i = d.indexOf(old.s); if (i >= 0) d.splice(i, 1); } trainInsert(k, sc); }
        t[k] = { s: up ? sc : old.s, g: old ? Sim.gradeBest(g, old.g) : g, at: Date.now() }; markDirty(me);
        const got = E.earnTraining(me, k, t[k].g); if (got) walletNote(me, got, 'train');
      }
      best = t[k].s;
    }
    return json(res, 200, { kind: k, score: sc, best, isNew, g: me ? me.career.train[k].g : Sim.trainGrade(k, sc, body.clean !== false), top: trainTop(k, sc, !!me && best === sc), topBest: me ? trainTop(k, best, true) : null, n: TRAIN.dist[k].length + (me ? 0 : 1) });
  }
  // (m is declared at the top of api)
  // featured kill cams: a player puts one of their own kill cams on their profile (the replay's frames, gzipped)
  if (route === '/clip' && method === 'POST') {
    if (!me) return json(res, 401, { error: 'Sign in first.' });
    if (!clipLimit(me.id)) return json(res, 429, { error: 'Try again in a minute.' });
    if (body.drop) { await store.clipDrop(me.id); me.ach = me.ach || {}; me.ach.clip = null; markDirty(me); return json(res, 200, { ok: true }); }
    const data = String(body.data || ''), meta = body.meta && typeof body.meta === 'object' ? body.meta : {};
    if (!/^[A-Za-z0-9+/=]+$/.test(data) || data.length > 650 * 1024) return json(res, 400, { error: 'That replay is too big.' });
    let clip;
    try { clip = JSON.parse(zlib.gunzipSync(Buffer.from(data, 'base64'), { maxOutputLength: 8 * 1024 * 1024 }).toString('utf8')); } catch (e) { return json(res, 400, { error: 'Bad replay.' }); }
    if (!clip || clip.v !== 1 || !Sim.MAPS[clip.map] || !Array.isArray(clip.f) || clip.f.length < 10 || clip.f.length > 900 || !Array.isArray(clip.segs)) return json(res, 400, { error: 'Bad replay.' });
    const id = crypto.randomBytes(6).toString('hex');
    const m2 = { map: clip.map, n: Math.max(1, Math.min(9, +clip.n || 1)), label: cleanText(meta.label, 40) || 'Kill cam', at: Date.now() };
    await store.clipSet(me.id, id, data, m2);
    me.ach = me.ach || {}; me.ach.clip = Object.assign({ id }, m2); markDirty(me);
    return json(res, 200, { ok: true, clip: me.ach.clip });
  }
  if ((m = route.match(/^\/clip\/([a-f0-9]{12})$/)) && method === 'GET') {
    const c = await store.clipGet(m[1]); if (!c) return json(res, 404, { error: 'That replay is gone.' });
    const owner = live.get(c.userId) || (await store.usersByIds([c.userId]).catch(() => []))[0];
    res.setHeader('Cache-Control', 'public, max-age=300');
    return json(res, 200, { id: c.id, data: c.data, meta: c.meta, owner: owner ? owner.name : null });
  }
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
        .map(u => { const c = u.career, g = c.roles[role], wn = (c.roleW || {})[role] || 0; return { name: u.name, ai: social.isAI(u) ? 1 : undefined, own: u.admin ? 1 : undefined, ...stOf(u), title: u.title, country: flagOf(u), level: levelOf(c).lv, value: Math.round((c.relo || {})[role] || ELO_START), games: g, wins: wn, rate: Math.round(wn / g * 100) }; })
        .sort((a, b) => b.value - a.value).slice(0, 50);
      return board({ by: 'elo', role, min: ROLE_MIN, rows });
    }
    const rows = (await store.leaderboard(by, 50)).map(u => live.get(u.id) || u).filter(u => (u.career || {}).games > 0 && (by !== 'eloT' || (u.career || {}).eloT != null));
    return board({ by, rows: rows.map(u => ({ name: u.name, ai: social.isAI(u) ? 1 : undefined, own: u.admin ? 1 : undefined, ...stOf(u), title: u.title, country: flagOf(u), level: levelOf(u.career).lv, value: by === 'elo' || by === 'eloT' ? Math.round((u.career || {})[by] || ELO_START) : (u.career || {})[by] || 0, games: (u.career || {}).matches || 0, wins: (u.career || {}).matchWins || 0, kills: (u.career || {}).kills || 0, pl: placedOf(u) ? 1 : 0, rate: (u.career || {}).matches ? Math.round(((u.career || {}).matchWins || 0) / u.career.matches * 100) : 0 })) }); // "games" here are whole matches (a match is several rounds of short fights)
  }
  // ---- clans
  if (route === '/clans' && method === 'GET') {
    const mine = me ? CLANS.of(me.id) : null;
    return json(res, 200, { top: CLANS.top(50), mine: mine ? await clanView(mine, me) : null, invites: me ? CLANS.invitesFor(me.id) : [], colours: CLANS.COLOURS, max: CLANS.MAX_MEMBERS });
  }
  if (route === '/clan' && method === 'GET') {
    const c = CLANS.get(url.searchParams.get('id')); if (!c) return json(res, 404, { error: 'That clan no longer exists.' });
    return json(res, 200, { clan: await clanView(c, me) });
  }
  if (route === '/clan' && method === 'POST') {
    if (!me) return json(res, 401, { error: 'Sign in to use clans.' });
    if (!(body.op === 'create' ? clanNewLimit : clanLimit)('u' + me.id)) return json(res, 429, { error: 'Slow down a little and try again.' });
    const byName = async n => { const x = await store.userByName(String(n || '').trim()).catch(() => null); return x ? track(x) : null; };
    const byId = async id => { const x = live.get(+id) || await store.userById(+id).catch(() => null); return x ? track(x) : null; };
    let r;
    switch (String(body.op || '')) {
      case 'create': r = await CLANS.create(me, body); break;
      case 'join': r = CLANS.join(me, body.id); break;
      case 'refuse': r = CLANS.refuse(me, body.id); break;
      case 'leave': r = await CLANS.leave(me); break;
      case 'invite': r = CLANS.invite(me, await byName(body.name)); break;
      case 'uninvite': r = CLANS.uninvite(me, body.user); break;
      case 'accept': r = CLANS.answer(me, body.user, true, await byId(body.user)); break;
      case 'decline': r = CLANS.answer(me, body.user, false); break;
      case 'kick': r = CLANS.kick(me, body.user); break;
      case 'role': r = CLANS.setRole(me, body.user, String(body.role || '')); break;
      case 'settings': r = CLANS.settings(me, body); break;
      case 'disband': r = await CLANS.disband(me); break;
      default: r = { error: 'Bad request.' };
    }
    if (r.error) return json(res, 400, { error: r.error });
    const mine = CLANS.of(me.id);
    return json(res, 200, { ok: true, asked: r.asked || undefined, joined: r.joined || undefined, mine: mine ? await clanView(mine, me) : null, top: CLANS.top(50), invites: CLANS.invitesFor(me.id) });
  }
  // single-game records
  if (route === '/highscores' && method === 'GET') {
    const all = (await store.leaderboard('games', 100000)).map(u => live.get(u.id) || u);
    const top = k => all.filter(u => ((u.career || {}).best || {})[k] > 0).sort((a, b) => b.career.best[k] - a.career.best[k]).slice(0, 10)
      .map(u => ({ name: u.name, ai: social.isAI(u) ? 1 : undefined, own: u.admin ? 1 : undefined, ...stOf(u), country: flagOf(u), level: levelOf(u.career).lv, value: u.career.best[k] }));
    const peak = all.filter(u => (u.career || {}).eloPeak).sort((a, b) => b.career.eloPeak - a.career.eloPeak).slice(0, 10)
      .map(u => ({ name: u.name, ai: social.isAI(u) ? 1 : undefined, own: u.admin ? 1 : undefined, ...stOf(u), country: flagOf(u), level: levelOf(u.career).lv, value: Math.round(u.career.eloPeak) }));
    return board({ kills: top('k'), dmg: top('dmg'), ring: top('ring'), peak });
  }
  if (route === '/look' && method === 'POST') {
    if (!me) return json(res, 401, { error: 'Sign in first.' });
    me.ach = me.ach || {};
    if (body.prof && typeof body.prof === 'object') { me.ach.prof = cleanProf(body.prof, me.ach.prof); markDirty(me); return json(res, 200, { ok: true, prof: me.ach.prof }); }
    // the profile picture: a drawing of an archer in the element, role and colour you choose
    if (body.avatar && typeof body.avatar === 'object') {
      const a = body.avatar;
      if (!Sim.ELEMENTS[a.el] || !Sim.ROLES[a.ro] || !/^#[0-9a-f]{6}$/i.test(String(a.c || ''))) return json(res, 400, { error: 'Pick a picture from the list.' });
      me.ach.avatar = { el: a.el, ro: a.ro, c: String(a.c) }; markDirty(me);
      if (!('border' in body)) return json(res, 200, { ok: true, avatar: me.ach.avatar });
    }
    if ('finish' in body || 'show' in body) { // banner finish and showcase medals, checked against what they've earned
      if ('finish' in body) { const f = body.finish ? String(body.finish) : null; if (f && !Sim.finishAllowed(f, me.ach, E.statusOf(me))) return json(res, 400, { error: "You haven't unlocked that finish." }); me.ach.finish = f; }
      if ('show' in body) { const tier = me.ach.tier || {}; me.ach.show = (Array.isArray(body.show) ? body.show : []).map(String).filter(k => tier[k] > 0).slice(0, 3); }
      markDirty(me);
      for (const r of rooms.values()) for (const c of r.clients) if (c.user && c.user.id === me.id) { Object.assign(c, lookOf(me)); if (c.pid) Sim.setMeta(r.world, c.pid, lookOf(me)); sendRoom(r); }
      if (!('border' in body)) return json(res, 200, { ok: true, finish: me.ach.finish || null, show: me.ach.show || [] });
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
// accounts by email: players online are checked first, since their newest details may not be written back yet
async function userWithEmail(e) {
  e = String(e || '').toLowerCase();
  const has = u => u && u.social && String(u.social.email || '').toLowerCase() === e;
  for (const u of live.values()) if (has(u)) return u;
  const x = await store.userByEmail(e), u = x && (live.get(x.id) || x);
  return has(u) ? u : null;
}
const siteBase = req => process.env.PUBLIC_URL ? process.env.PUBLIC_URL.replace(/\/$/, '') : (req.headers['x-forwarded-proto'] || 'http') + '://' + req.headers.host;
// a short note to the account's email when something about signing in changes (to the old address when the email itself changes)
const maskEmail = e => String(e).replace(/^(.)(.*)(@.*)$/, (m, a, b, c) => a + '*'.repeat(Math.min(6, Math.max(1, b.length))) + c);
function securityMail(req, u, subject, line, to) {
  const addr = to || (u.social && u.social.email); if (!addr) return;
  MAIL.send(addr, subject, `Hi ${u.name},\n\n${line}\n\nIf this wasn't you, reset your password straight away from the sign-in page (${siteBase(req)}/#/forgot), or reply to this email.`).catch(() => {});
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
  // the provider's confirmed email, for password recovery: added to an account that has none (and only if no other account uses it)
  const fillEmail = async u => { if (!who.email || !u || (u.social && u.social.email)) return; const other = await userWithEmail(who.email); if (other && other.id !== u.id) return; const t = live.get(u.id) || u; t.social = Object.assign(t.social || {}, { email: who.email }); await store.saveUser(t); };
  if (st.link && me) {
    // adding this sign-in method to the account you're already signed in to
    if (existing && existing.id !== me.id) return redirect(res, `/#/u/${encodeURIComponent(me.name)}?err=` + encodeURIComponent(`That ${O.PROVIDERS[p].name} account already belongs to another player.`), [clear]);
    await store.addLogin(p, who.id, me.id); await fillEmail(me);
    return redirect(res, `/#/u/${encodeURIComponent(me.name)}`, [clear]);
  }
  if (existing) { await fillEmail(existing); return redirect(res, st.next || '/#/u/' + encodeURIComponent(existing.name), [clear, await sessionFor(req, existing)]); }
  // someone new: choose a player name first
  const pend = O.seal({ p, id: who.id, suggest: who.suggest, next: st.next, email: who.email || null }, 15);
  return redirect(res, '/#/finish', [clear, tempCookie('bf_pending', pend, req, 15)]);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/health') { res.writeHead(200); return res.end('ok'); }
  // with PUBLIC_URL set (e.g. https://bowfall.com), anyone arriving at another address (the onrender.com one, www.) is sent there,
  // so sign-ins and links always use one address
  const pub = process.env.PUBLIC_URL && new URL(process.env.PUBLIC_URL);
  // (but never between bowfall.com and www.bowfall.com: the domain provider or host may already send one to the other, and
  // sending it back would loop forever; the cookies and sign-ins still work on both)
  const bare = h => String(h || '').toLowerCase().replace(/^www\./, '');
  if (pub && req.headers.host && req.headers.host !== pub.host && bare(req.headers.host) !== bare(pub.host) && !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host)) {
    res.writeHead(301, { Location: pub.origin + req.url }); return res.end();
  }
  if (url.pathname.startsWith('/auth/')) {
    try { return await oauth(req, res, url); } catch (e) { console.error(e); return redirect(res, '/#/login?err=' + encodeURIComponent('Something went wrong signing in.')); }
  }
  if (url.pathname === '/api/stripe/webhook' && req.method === 'POST') {
    const raw = await new Promise((resolve, reject) => { const ch = []; let n = 0; req.on('data', c => { n += c.length; if (n > 1e6) { reject(new Error('too big')); req.destroy(); } else ch.push(c); }); req.on('end', () => resolve(Buffer.concat(ch).toString('utf8'))); req.on('error', reject); }).catch(() => null);
    if (raw == null || !PAY.verify(raw, req.headers['stripe-signature'])) { res.writeHead(400); return res.end('bad signature'); }
    try { await stripeEvent(JSON.parse(raw)); res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"ok":true}'); }
    catch (e) { console.error('Stripe webhook:', e.message); res.writeHead(500); return res.end('error'); } // Stripe retries later
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
// clans (lib/clans.js). When someone joins or leaves, their banner in any game they're in is refreshed
const CLANS = require('./lib/clans')({ store, Sim, onChange: ids => { for (const id of ids) refreshLook(id); } });
function refreshLook(uid) {
  for (const r of rooms.values()) { let hit = false; for (const c of r.clients) if (c.user && c.user.id === uid) { Object.assign(c, lookOf(c.user)); if (c.pid) Sim.setMeta(r.world, c.pid, lookOf(c.user)); hit = true; } if (hit) sendRoom(r); }
}
// what a clan page shows about each member: rating, level and whether they're online
async function clanView(c, me) {
  const v = CLANS.view(c, me), us = await store.usersByIds(v.members.map(m => m.id)).catch(() => []);
  for (const m of v.members) { const u = live.get(m.id) || us.find(x => x.id === m.id); if (u) { const k = u.career || {}; m.elo = Math.round(k.elo || ELO_START); m.eloT = Math.round(k.eloT != null ? k.eloT : k.elo || ELO_START); m.lv = levelOf(k).lv; m.cc = flagOf(u); m.on = social.isOnline(m.id) ? 1 : 0; } }
  return v;
}
const social = require('./lib/social')({ season: () => SEASON.info(), rejoinFor: ws => { const r = awayRoomOf(ws); return r ? { code: r.code, mode: r.ranked.mode } : null; }, lookOf, seedRating: (u, h) => { if (seedRating(u, h)) markDirty(u); }, rankedMaps: () => rankedMaps(), statusOf: u => E.statusOf(u), store, track, markDirty, send, Sim, levelOf, flagOf, ELO_START, ratingOf, keyFor, rooms, createRoom, sendRoom, sysChat, broadcast, live, loadGuest });

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

// the host's changes to the match, told to everyone in the room's chat ("Arrow homing set to Heavy.")
const DIFF_NAMES = { easy: 'Easy', normal: 'Normal', hard: 'Hard', extreme: 'Extreme', master: 'Master' };
const cfgState = w => ({ diff: w.cfg.diff, map: w.cfg.map, ptw: w.cfg.pointsToWin, opt: Object.assign({}, w.cfg.opt), ban: (w.cfg.ban || []).slice() });
function announceCfg(room, a, b) {
  const lines = [];
  if (a.map !== b.map) lines.push(`Arena set to ${Sim.MAPS[b.map].name}.`);
  if (a.diff !== b.diff) lines.push(`Bot skill set to ${DIFF_NAMES[b.diff] || b.diff}.`);
  if (a.ptw !== b.ptw) lines.push(`Match length set to first to ${b.ptw} points.`);
  for (const k of Object.keys(Sim.OPTIONS)) if (a.opt[k] !== b.opt[k]) lines.push(`${Sim.OPTIONS[k].label} set to ${Sim.OPT_NAMES[b.opt[k]] || b.opt[k]}.`);
  const nm = k => (Sim.ELEMENTS[k] || Sim.ROLES[k] || {}).name || k;
  const off = b.ban.filter(k => !a.ban.includes(k)), on = a.ban.filter(k => !b.ban.includes(k));
  if (off.length) lines.push(`Taken out of this game: ${off.map(nm).join(', ')}.`);
  if (on.length) lines.push(`Allowed again: ${on.map(nm).join(', ')}.`);
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
    ranked: room.ranked ? room.ranked.mode : undefined, arena: arenaInfo(room.world.cfg.map),
    // the ranked draft: seconds left to choose, and who's ready
    draft: room.ranked && room.ranked.draftUntil && !room.ranked.go ? Math.max(0, Math.ceil((room.ranked.draftUntil - Date.now()) / 1000)) : undefined,
    ready: room.ranked && room.ranked.ready ? [...room.clients].filter(c => room.ranked.ready.has(c.cid) && c.pid).map(c => c.pid) : undefined,
    cards: Object.fromEntries([...room.clients].map(c => [c.pid ? 'p' + c.pid : 'c' + c.cid, cardOf(c)]).concat([...(room.ai || new Map())].map(([pid, u]) => ['p' + pid, Object.assign(cardOf({ user: u }), { ai: 1 })]))),
    spec: [...room.clients].filter(c => !c.pid).map(c => ({ cid: c.cid, n: c.name, h: c.cid === room.host ? 1 : 0, you: c === ws ? 1 : 0, cc: c.cc || undefined, lv: c.lv || undefined, bd: c.bd || undefined, sp: c.sp || undefined, fd: c.fd || undefined, pt: c.pt || undefined, na: c.na || undefined, ow: c.ow || undefined, fin: c.fin || undefined, ct: c.ct || undefined, cl: c.cl || undefined, ce: c.ce || undefined, sc: c.sc && c.sc.length ? c.sc : undefined })),
  };
}
// what the lobby's hover card shows about someone: accounts get their record, guests just what their browser says they've earned
const topAch = ach => Sim.achBest(ach, 2);
function cardOf(c) {
  if (c.guest && !c.user && c.guest.career.games) { const k = c.guest.career; return { a: 1, guest: 1, g: k.matches || 0, w: k.matchWins || 0, elo: Math.round(k.elo || ELO_START), lv: levelOf(k).lv, top: topAch(c.guest.ach) }; }
  if (c.user) {
    const k = c.user.career || {};
    return { a: 1, g: k.matches || 0, w: k.matchWins || 0, elo: Math.round(k.elo || ELO_START), lv: levelOf(k).lv, top: topAch(c.user.ach) };
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
  if (room.ranked) lockedFix(ws);
  const p = Sim.join(w, { name: ws.name, team, element: ws.el, role: ws.ro });
  if (!p) return 'That team is full.';
  ws.pid = p.id;
  if (ws.title) Sim.setTitle(w, p.id, ws.title);
  Sim.setMeta(w, p.id, { cc: ws.cc, lv: ws.lv, bd: ws.bd, na: ws.na, ow: ws.ow, sp: ws.sp, fd: ws.fd, pt: ws.pt, ct: ws.ct, cl: ws.cl, ce: ws.ce });
  send(ws, { t: 'you', id: p.id });
  return null;
}
function toSpectator(room, ws) {
  if (!ws.pid) return;
  Sim.leave(room.world, ws.pid, true);
  ws.pid = null;
  send(ws, { t: 'you', id: null });
}

// ranked rejoining: who someone is across connections (an account, or a guest's saved record)
const whoKey = ws => ws.user ? 'u' + ws.user.id : ws.guest ? ws.guest.id : null;
const ranked_live = room => !!room.ranked && room.world.match.ph !== 'over' && (room.world.match.ph !== 'lobby' || !!room.ranked.draftUntil); // the draft counts
function awayRoomOf(ws) { // a ranked match this person dropped out of and can get back into
  const k = whoKey(ws); if (!k) return null;
  for (const r of rooms.values()) if (r.away && r.away.has(k) && ranked_live(r)) return r;
  return null;
}
function leave(ws) {
  const room = ws.room;
  if (!room) return;
  room.clients.delete(ws);
  const k = whoKey(ws);
  if (ws.pid && !ws.watch && k && ranked_live(room)) {
    // dropped out of a ranked match: their archer stays (standing still) and their seat is kept so they can rejoin
    room.away = room.away || new Map();
    room.away.set(k, { pid: ws.pid, u: ws.user || ws.guest, name: ws.name, at: Date.now() });
    Sim.setInput(room.world, ws.pid, { mx: 0, my: 0, draw: false, aim: 0 });
    ws.room = null; ws.pid = null;
    setTimeout(() => social.presence(ws), 0);
    if ([...room.clients].every(c => c.watch)) { room.emptySince = room.emptySince || Date.now(); }
    sysChat(room, `${ws.name} disconnected. They can rejoin.`); sendRoom(room);
    return;
  }
  if (ws.pid) Sim.leave(room.world, ws.pid);
  ws.room = null; ws.pid = null;
  setTimeout(() => social.presence(ws), 0);
  if (!room.clients.size) { social.freeAI(room); if (room.z) { room.z.d.close(); room.z = null; } rooms.delete(room.code); return; }
  if (room.away && room.away.size && ranked_live(room)) { sysChat(room, `${ws.name} left.`); sendRoom(room); return; } // seats are being kept: watchers stay
  if ([...room.clients].every(c => c.watch)) { for (const c of [...room.clients]) { send(c, { t: 'kicked', msg: 'Everyone has left that game.' }); leave(c); } return; } // only people watching are left
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
    '/locks on|off – whether ranked drafts respect unlocks (off: everything free)', '/rotation [element role|clear] – show or pin this week\'s free picks', '/founders on|off – open or close Founder pack sales',
    '/grant <name> supporter <months>|founder|patron|crests <n>|unlock <key>|revoke <supporter|founder|patron> – for testing and support',
    '/feature <arena code> [ranked|off] – feature a player arena (ranked: also in the ranked map pool)',
    '/perf – how hard the server is working right now, and the last lag reports from players', '/rooms – list the games running on the server', '/who <name> – ratings, games and where they are playing', '/setelo <name> <rating> [team] – set an account\'s 1v1 (or team) rating', '/clan disband <tag> – remove a clan', '/season [end] – the ranked season, or end it now (ratings soften, rewards paid)', '/profile [seconds] – record what the server spends its CPU on (default 120s), downloadable at /api/profile'],
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
    case 'locks': {
      if (args[0] === 'on' || args[0] === 'off') { SETTINGS.locks = args[0] === 'on'; await store.setSetting('locks', { on: SETTINGS.locks }); for (const u of live.values()) if (!u.guest) walletNote(u, 0, null); }
      return tell(`Locks are ${SETTINGS.locks ? 'ON: ranked drafts use what each player owns plus this week\'s free picks' : 'OFF: everything is free to play'}.`);
    }
    case 'rotation': {
      if (args[0] === 'clear') { SETTINGS.rotPin = null; await store.setSetting('rotPin', null); }
      else if (args.length >= 1) {
        const el = args.find(a => Sim.ELEMENTS[a] && Sim.ELEMENTS[a].premium) || null, ro = args.find(a => Sim.ROLES[a] && Sim.ROLES[a].premium) || null;
        if (!el && !ro) return tell('Usage: /rotation <premium element> <premium role>, or /rotation clear');
        SETTINGS.rotPin = { el, ro }; await store.setSetting('rotPin', SETTINGS.rotPin);
      }
      const R = rot(); return tell(`Free this week${R.pinned ? ' (pinned)' : ''}: ${R.el ? Sim.ELEMENTS[R.el].name : '–'} and ${R.ro ? Sim.ROLES[R.ro].name : '–'}.`);
    }
    case 'founders': {
      if (args[0] === 'on' || args[0] === 'off') { SETTINGS.foundersOff = args[0] === 'off'; await store.setSetting('foundersOff', SETTINGS.foundersOff); }
      return tell(`Founder pack sales are ${foundersOpen() ? 'open' : 'closed'}.`);
    }
    case 'grant': {
      const name = args[0], what = (args[1] || '').toLowerCase(), n = args[2];
      if (!name || !what) return tell('Usage: /grant <name> supporter <months>|founder|patron|crests <n>|unlock <key>|revoke <what>');
      const u = track(await store.userByName(name).catch(() => null)); if (!u) return tell(`No account called "${name}".`);
      const c = u.career || (u.career = {});
      if (what === 'supporter') { const sp = c.sup || (c.sup = {}); sp.active = true; sp.since = sp.since || Date.now(); sp.months = Math.max(0, parseInt(n, 10) || 1); sp.until = Date.now() + 31 * 86400000; }
      else if (what === 'founder') { if (!c.founder) { c.founder = Date.now(); E.give(u, E.FOUNDER_CRESTS, 'founder'); } }
      else if (what === 'patron') c.patron = true;
      else if (what === 'crests') { const k = parseInt(n, 10); if (!isFinite(k)) return tell('Usage: /grant <name> crests <n> (can be negative)'); E.give(u, k, 'admin'); }
      else if (what === 'unlock') { if (!E.unlock(u, String(n || ''))) return tell('Not a premium element or role, or already owned.'); }
      else if (what === 'revoke') { if (n === 'supporter' && c.sup) c.sup.active = false; else if (n === 'founder') c.founder = null; else if (n === 'patron') c.patron = false; else return tell('Usage: /grant <name> revoke supporter|founder|patron'); }
      else return tell('Unknown grant. Try supporter, founder, patron, crests, unlock or revoke.');
      markDirty(u); flushUsers(); walletNote(u, 0, null);
      const w = walletOf(u); return tell(`${u.name}: ${w.crests} Crests · unlocks ${w.unlocks.join(', ') || 'none'}${w.founder ? ' · founder' : ''}${w.sup.active ? ` · supporter (${w.sup.months} months)` : ''}${w.patron ? ' · patron' : ''}.`);
    }
    case 'feature': {
      const id = Sim.arenaId(args[0]); const a = id ? await store.arenaGet(id) : null; if (!a) return tell('Usage: /feature <arena code> [ranked|off]');
      const mode = (args[1] || '').toLowerCase();
      const f = mode === 'off' ? { featured: false, ranked: false } : mode === 'ranked' ? { featured: true, ranked: true, pub: true } : { featured: true, pub: true };
      await store.arenaUpdate(a.id, f); await loadRankedArenas();
      return tell(`${a.name} (${Sim.arenaCode(a.id)}) by ${a.author}: ${mode === 'off' ? 'no longer featured' : mode === 'ranked' ? 'featured and in the ranked map pool' : 'featured'}.`);
    }
    case 'profile': { // /profile [seconds]: record what the server spends its CPU on, then summarise it
      if (PROF.running) return tell('A profile is already being recorded.');
      const secs = Math.max(10, Math.min(600, parseInt(args[0], 10) || 120));
      PROF.start(secs, r => {
        if (r.error) return tell('The profile failed: ' + r.error);
        tell(`Profile done (${secs}s): ${r.busyMs} ms of CPU in the game's code, garbage collection ${r.gc.ms} ms (${r.gc.count} runs, longest ${r.gc.longest} ms), held back ${r.heldBackMs} ms.`);
        tell('Busiest: ' + r.self.slice(0, 5).map(x => `${x.fn.replace(/ \S+:\d+$/, '')} ${x.pct}%`).join(', '));
        tell('Download it (signed in as the owner) at /api/profile, and the full profile for Chrome DevTools at /api/profile?raw=1');
      });
      return tell(`Recording the server for ${secs} seconds. Keep playing; I'll post the results here.`);
    }
    case 'perf': {
      const h = PERF.hist.slice(-30), s = PERF.now || {};
      const worst = k => h.reduce((m, x) => Math.max(m, x[k] || 0), 0);
      tell(`Server now (sees ${s.cores} cores): CPU ${s.cpu}% of ${s.quota ? s.quota + ' core' : 'a core'}${s.thr != null ? ` (held back ${s.thr} ms/s)` : ''} · loop stall ${s.lag} ms · tick ${s.step} ms (max ${s.stepMax}) · ${s.rooms} game${s.rooms === 1 ? '' : 's'}, ${s.players} archers · ${s.mem} MB`);
      tell(`Last 30 s worst: CPU ${worst('cpu')}% · loop stall ${worst('lag')} ms · lost time ${h.reduce((m, x) => m + (x.drop || 0), 0)} ms · tick max ${worst('stepMax')} ms`);
      for (const e of PERF.errors.slice(0, 3)) tell(`Browser error (${e.name}, ${e.where}, ${e.ph || e.mode}): ${e.m} ${(e.s.split('\n')[1] || '').trim().slice(0, 120)}`);
      const reps = PERF.reports.slice(-4).reverse();
      for (const r of reps) tell(`${r.name}: ${r.verdict || '?'} · ${r.fps} fps (worst frame ${r.fMax} ms) · ping ${r.ping} ±${r.jit} ms · late packets ${r.late}, longest gap ${r.gapMax} ms`);
      return;
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
      tell(`${online ? online.name : u.name}: ${online && !online.user ? 'guest' : 'account'}${u && u.social && u.social.ban ? ' (banned)' : ''} · 1v1 ${Math.round(c.elo || ELO_START)}, team ${Math.round(c.eloT != null ? c.eloT : c.elo || ELO_START)} · ${c.matches || 0} matches, ${c.games || 0} battles · ${online && online.room ? 'in game ' + online.room.code : 'not in a game'}`);
      return;
    }
    case 'clan': { // /clan disband <tag>
      if (!/^disband$/i.test(args[0] || '') || !args[1]) return tell('Usage: /clan disband <tag>');
      const name = await CLANS.adminDisband(args[1]);
      return tell(name ? `Clan "${name}" has been disbanded.` : `No clan with the tag "${args[1]}".`);
    }
    case 'season': { // /season: this season and when it ends; /season end: end it now (for testing; the next starts at once)
      const si = SEASON.info(); if (!si) return tell('Seasons are not running.');
      if (/^end$/i.test(args[0] || '')) { const st = SEASON._st(); st.q0 -= 1; await SEASON.check(); return tell(`Season ${si.n} ended. Season ${si.n + 1} has begun.`); }
      return tell(`Season ${si.n}: ends ${new Date(si.end).toUTCString().slice(5, 16)} (${Math.ceil((si.end - Date.now()) / 86400000)} days).`);
    }
    case 'setelo': {
      const name = args[0], v = parseInt(args[1], 10), which = /^team$/i.test(args[2] || '') ? 'eloT' : 'elo'; if (!name || !Number.isFinite(v)) return tell('Usage: /setelo <name> <rating> [team]');
      const online = findIn(everyone(), name);
      const u = online && online.user ? online.user : track(await store.userByName(name).catch(() => null));
      if (!u) return tell(`No account called "${name}".`);
      u.career = u.career || {}; u.career[which] = Math.max(0, Math.min(4000, v)); markDirty(u); flushUsers();
      return tell(`${u.name}'s ${which === 'eloT' ? 'team' : '1v1'} rating is now ${u.career[which]}.`);
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
    ws.zOk = m.z === 1 && !ws.quiet; ws.zRoom = null; // can unpack compressed snapshot streams
    if (ws.room) leave(ws);
    ws.back = null;
    if (bannedWs(ws)) return send(ws, { t: 'err', msg: 'You have been banned from online games.' });
    let room;
    ws.watch = false;
    if (m.watch != null) {
      // watching a friend's game: find the game they're in; matchmade games are watch-only, custom games are joined as usual
      const fid = +m.watch;
      if (!ws.user || !((ws.user.social || {}).friends || []).includes(fid)) return send(ws, { t: 'err', msg: 'You can only watch friends.' });
      room = [...rooms.values()].find(r => [...r.clients].some(c => c.user && c.user.id === fid && !c.watch));
      if (!room) return send(ws, { t: 'err', msg: "They're not in a game any more." });
      if (room.ranked) { ws.watch = true; if ([...room.clients].filter(c => c.watch).length >= 8) return send(ws, { t: 'err', msg: 'Too many people are watching that game.' }); }
      else if (!pwOk(room, m.pw)) return send(ws, { t: 'needpw', code: room.code, msg: m.pw ? 'Wrong password.' : 'This game needs a password.' });
    } else if (m.create) {
      if (rooms.size >= MAX_ROOMS) return send(ws, { t: 'err', msg: 'The server is full. Try again later.' });
      room = createRoom({ diff: m.diff, map: m.map });
    } else {
      room = rooms.get(String(m.code || '').toUpperCase().trim());
      if (!room) return send(ws, { t: 'err', msg: m.ticket ? 'That match has expired. Search again.' : 'No game with that code. Check it and try again.' });
      // back into a ranked match you dropped out of (from the Rejoin button, or a reload of the page): no ticket needed
      if (room.ranked && room.away && ranked_live(room)) {
        if (!ws.user && m.gt) { const g = await loadGuest(m.gt); if (g) ws.guest = g; }
        const k = whoKey(ws); if (k && room.away.has(k)) ws.back = room.away.get(k);
      }
      // a matchmade game: only people it was made for, with their ticket
      if (ws.back) { /* their seat is waiting */ }
      else if (room.ranked || m.ticket) { const err = room.ranked ? social.useTicket(ws, room, m.ticket) : 'That match has expired. Search again.'; if (err) return send(ws, { t: 'err', msg: err }); }
      else if (!pwOk(room, m.pw)) return send(ws, { t: 'needpw', code: room.code, msg: m.pw ? 'Wrong password.' : 'This game needs a password.' });
    }
    if (!m.create && !room.ranked && !ws.watch && room.clients.size >= (room.max || 8)) return send(ws, { t: 'err', msg: `That game is full (${room.clients.size}/${room.max || 8} players).` });
    // signed-in players always play under their account name and wear their account's title
    ws.name = ws.back ? ws.back.name : ws.user ? ws.user.name : cleanName(m.name);
    // guests can't pass themselves off as a registered player
    if (!ws.user && await store.userByName(ws.name).catch(() => null)) ws.name = ws.name.slice(0, 15) + '~';
    // nobody shares a name inside one game: a second "Archer" becomes "Archer 2"
    if (!ws.back) { const taken = n => [...room.clients].some(c => c !== ws && c.name && c.name.toLowerCase() === n.toLowerCase()); const base = ws.name.slice(0, 13);
      for (let i = 2; taken(ws.name) && i < 99; i++) ws.name = base + ' ' + i; }
    if (!ws.user && m.gt && !ws.back) ws.guest = await loadGuest(m.gt, ws.name);
    ws.title = ws.user ? ws.user.title : null;
    ws.lv = ws.user ? levelOf(ws.user.career).lv : ws.guest && ws.guest.career.games ? levelOf(ws.guest.career).lv : null;
    if (ws.user) Object.assign(ws, lookOf(ws.user));
    if (ws.user) ws.cc = ws.user.country ? flagOf(ws.user) : ws.geo || null;
    ws.el = String(m.el || ''); ws.ro = String(m.ro || ''); ws.pid = null;
    ws.room = room;
    room.clients.add(ws);
    // whoever creates the room starts on Red; everyone else arrives unassigned (or spectating a match in progress) and picks a team
    if (m.create) { room.host = ws.cid; applyRoomCfg(room, Object.assign({ name: '' }, m.room || {}), ws.name); joinTeam(room, ws, 'red'); }
    else if (ws.back && room.world.players.some(p => p.id === ws.back.pid)) { // their archer is still there: take it back
      ws.pid = ws.back.pid; room.away.delete(whoKey(ws)); room.emptySince = null;
      const p = room.world.players.find(q => q.id === ws.pid); ws.mmTeam = p.team;
      send(ws, { t: 'you', id: ws.pid });
    }
    else if (room.ranked) { if (ws.mmTeam && !ws.watch) joinTeam(room, ws, ws.mmTeam); }
    else if (!room.host) room.host = ws.cid;
    send(ws, { t: 'welcome', id: ws.pid, code: room.code, account: ws.user ? ws.user.name : null, v: Sim.VERSION });
    sendRoom(room);
    sysChat(room, ws.watch ? `${ws.name} is watching.` : ws.pid && ws.back ? `${ws.name} is back.` : room.world.match.ph === 'lobby' || room.world.match.ph === 'over' ? `${ws.name} joined.` : `${ws.name} joined and is spectating until this game ends.`);
    if (room.ranked && !ws.watch && !ws.back) social.arrived(room, ws);
    social.presence(ws);
    return;
  }

  const room = ws.room;
  if (!room) return;
  const w = room.world, isHost = room.host === ws.cid;
  if (ws.watch && !['ping', 'nz', 'perfRep'].includes(m.t)) return; // watching a matchmade game: no playing, picking or chatting
  switch (m.t) {
    case 'in': if (ws.pid) Sim.setInput(w, ws.pid, m); break;
    case 'ping': send(ws, { t: 'pong', c: m.c }); break;
    case 'nz': ws.zOk = false; break; // this browser couldn't unpack the stream: plain snapshots from now on
    case 'perfRep': { // a player's own view of the last 10 seconds (frame rate, ping, late packets), for the owner's lag reports
      const n = k => Math.max(0, Math.min(99999, Math.round(+m[k] || 0)));
      PERF.reports.push({ t: Date.now(), name: ws.name || 'Guest', room: room.code, fps: n('fps'), fMax: n('fMax'), slow: n('slow'), ping: n('ping'), jit: n('jit'), gapMax: n('gapMax'), late: n('late'), starve: n('starve'), verdict: String(m.v || '').slice(0, 40) });
      if (PERF.reports.length > 300) PERF.reports.shift();
      break;
    }
    case 'loadout': {
      const el = String(m.el), ro = String(m.ro), u = ws.user || ws.guest;
      // ranked drafts: only what you own, this week's free picks, or everything if locks are off
      if (room.ranked && SETTINGS.locks && !(E.owns(u, el, true, rot()) && E.owns(u, ro, true, rot()))) { send(ws, { t: 'note', msg: 'That one is locked. Unlock it in the Store, or pick from your own and this week\'s free ones.' }); break; }
      ws.el = el; ws.ro = ro; if (ws.pid) Sim.setLoadout(w, ws.pid, ws.el, ws.ro); if (room.ranked && !room.ranked.go) sendRoom(room); break;
    }
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
      let look;
      if (ws.user) look = lookOf(ws.user);
      else if (ws.guest) { // a guest's record is on the server too now: their choices are checked against it
        const g = ws.guest; g.ach = g.ach || {};
        const bd = Sim.ACHIEVEMENTS[m.bd] && (g.ach.got || {})[m.bd] ? String(m.bd) : null;
        if (m.fin !== undefined) g.ach.finish = m.fin && Sim.BANNER_FINISH[m.fin] ? String(m.fin) : null;
        if (Array.isArray(m.show)) g.ach.show = m.show.map(String).filter(k => (g.ach.tier || {})[k] > 0).slice(0, 3);
        g.ach.border = bd; markDirty(g);
        look = Object.assign({ bd, na: Object.keys(g.ach.got || {}).length || null }, Sim.bannerOf(g.ach));
      } else look = { bd: Sim.ACHIEVEMENTS[m.bd] ? String(m.bd) : null, na: Math.max(0, Math.min(Object.keys(Sim.ACHIEVEMENTS).length, m.na | 0)) || null };
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
      broadcast(room, { t: 'chat', n: ws.name, tm: p ? p.team : 'spec', c: p ? p.color : null, m: text, acc: ws.user ? 1 : 0, adm: ws.user && ws.user.admin ? 1 : undefined, sp: ws.sp || undefined, fd: ws.fd || undefined, pt: ws.pt || undefined });
      social.aiReply(room, text, ws.name);
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
      if (m.map && Sim.MAPS[String(m.map)] && !Sim.MAPS[String(m.map)].hidden && Sim.setMap(w, String(m.map)) && before.map !== String(m.map) && Sim.MAPS[before.map] && Sim.MAPS[before.map].custom) sendRoom(room);
      if (m.arena != null && w.match.ph === 'lobby') { // a player arena, by code (A1F) or id
        const id = typeof m.arena === 'number' ? m.arena : Sim.arenaId(m.arena);
        const a = id ? await loadArena(id) : null;
        if (!a) send(ws, { t: 'note', msg: 'No arena with that code.' }); else if (Sim.setMap(w, arenaKey(a.id))) sendRoom(room);
      }
      if (m.ptw) Sim.setPointsToWin(w, m.ptw | 0);
      if (m.opt && typeof m.opt === 'object') for (const [k, v] of Object.entries(m.opt)) Sim.setOption(w, String(k), String(v));
      if (Array.isArray(m.ban) && !room.ranked) Sim.setBans(w, m.ban.slice(0, 40));
      announceCfg(room, before, cfgState(w));
      break;
    }
    case 'hcap': if (isHost) Sim.setHandicap(w, String(m.id), m.v | 0); break;
    case 'start': if (isHost) { Sim.startMatch(w); const A = Sim.MAPS[w.cfg.map]; if (A && A.custom && w.match.ph !== 'lobby') { const a = ARENAS.get(+w.cfg.map.slice(1)); if (a) { a.plays = (a.plays || 0) + 1; store.arenaUpdate(a.id, { plays: a.plays }).catch(() => {}); } } } break;
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
// ranked matches everyone dropped out of: kept 90 seconds for someone to rejoin (or until the match ends), then closed
setInterval(() => {
  for (const room of [...rooms.values()]) {
    if (!room.away || !room.away.size) continue;
    const players = [...room.clients].filter(c => !c.watch);
    if (players.length) { room.emptySince = null; continue; }
    room.emptySince = room.emptySince || Date.now();
    if (Date.now() - room.emptySince < 90000 && ranked_live(room)) continue;
    for (const c of [...room.clients]) { send(c, { t: 'kicked', msg: 'Everyone has left that game.' }); c.room = null; c.pid = null; }
    room.clients.clear(); room.away.clear(); social.freeAI(room); if (room.z) { room.z.d.close(); room.z = null; } rooms.delete(room.code);
  }
}, 5000).unref();
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 10000);

// achievements for signed-in players, worked out here from the game's own events
// achievements only count in ranked games and in custom games with no bots, so they can't be farmed
const achCounts = room => !!room.ranked || room.world.players.every(p => !p.bot);
function achNote(u, fresh) { // tell the owner (an account or a guest) what they just reached
  if (!fresh.length) return;
  if (!u.guest && !(u.career && u.career.ai) && live.get(u.id) === u) { const n = E.give(u, E.EARN.achTier * fresh.length, 'ach'); markDirty(u); setTimeout(() => walletNote(u, n, 'ach'), 0); }
  for (const r of rooms.values()) for (const c of r.clients) if ((c.user && c.user === u) || (c.guest && c.guest === u)) send(c, { t: 'ach', keys: fresh, ach: u.ach });
}
function creditAchievements(room, evs) {
  if (!achCounts(room)) return;
  for (const ws of room.clients) {
    if (!(ws.user || ws.guest) || !ws.pid) continue;
    const p = room.world.players.find(q => q.id === ws.pid);
    const adds = Sim.achFromEvents(evs, ws.pid, p ? p.team : null);
    if (!adds.length) continue;
    const u = ws.user || ws.guest; u.ach = u.ach || {};
    const fresh = Sim.achApply(u.ach, adds);
    markDirty(u);
    if (fresh.length) { Object.assign(ws, lookOf(u)); Sim.setMeta(room.world, ws.pid, lookOf(u)); }
    send(ws, { t: 'ach', keys: fresh, ach: u.ach });
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

// ---- performance: how hard the server is working, so lag can be traced to the player's computer, their connection,
// or the server. Measured every second and sent to everyone in a game (a few dozen bytes); the owner also gets the last
// two minutes and players' own reports from GET /api/perf and the /perf chat command.
const { monitorEventLoopDelay } = require('perf_hooks');
const eld = monitorEventLoopDelay({ resolution: 20 }); eld.enable();
// the CPU the host gives us (Render's free plan is a tenth of one core) and how long it held us back, from the cgroup
const CG = (() => {
  const rd = f => { try { return fs.readFileSync(f, 'utf8').trim(); } catch (e) { return null; } };
  let quota = null, stat = null;
  const v2 = rd('/sys/fs/cgroup/cpu.max');
  if (v2) { const [q, per] = v2.split(/\s+/); if (q !== 'max') quota = +q / +per; stat = '/sys/fs/cgroup/cpu.stat'; }
  else { const q = +rd('/sys/fs/cgroup/cpu/cpu.cfs_quota_us'), per = +rd('/sys/fs/cgroup/cpu/cpu.cfs_period_us'); if (q > 0 && per > 0) quota = q / per; stat = '/sys/fs/cgroup/cpu/cpu.stat'; }
  const throttled = () => { const t = rd(stat); if (!t) return null; const m = t.match(/throttled_usec (\d+)/) || t.match(/throttled_time (\d+)/); return m ? (/usec/.test(m[0]) ? +m[1] / 1000 : +m[1] / 1e6) : null; };
  return { quota, throttled, last: throttled() };
})();
const PROF = require('./lib/profiler')(); // the owner's /profile command
const PERF = { errors: [], w: { gap: 0, drop: 0, catchup: 0, step: 0, steps: 0, stepMax: 0, send: 0 }, hist: [], reports: [], cpu: process.cpuUsage(), at: Date.now(), now: null };
function perfSecond() {
  const W = PERF.w, t = Date.now(), wall = (t - PERF.at) * 1000, cpu = process.cpuUsage(PERF.cpu);
  PERF.cpu = process.cpuUsage(); PERF.at = t;
  let players = 0; for (const r of rooms.values()) players += r.world.players.length;
  const th = CG.throttled(), thMs = th != null && CG.last != null ? Math.round(th - CG.last) : null; CG.last = th;
  const cores = CG.quota || 1;
  const s = { t, cpu: Math.round((cpu.user + cpu.system) / Math.max(1, wall * cores) * 100), quota: CG.quota, thr: thMs, lag: Math.round(W.gap), el: Math.round(eld.percentile(99) / 1e6), elMax: Math.round(eld.max / 1e6),
    drop: Math.round(W.drop * 1000), cu: W.catchup, step: W.steps ? Math.round(W.step / W.steps * 100) / 100 : 0, stepMax: Math.round(W.stepMax * 10) / 10, send: Math.round(W.send * 10) / 10,
    rooms: rooms.size, players, mem: Math.round(process.memoryUsage().rss / 1048576), cores: require('os').cpus().length };
  eld.reset();
  PERF.w = { gap: 0, drop: 0, catchup: 0, step: 0, steps: 0, stepMax: 0, send: 0 };
  PROF.second(s);
  PERF.now = s; PERF.hist.push(s); if (PERF.hist.length > 120) PERF.hist.shift();
  for (const room of rooms.values()) {
    const rp = room.perf || {}; room.perf = { ms: 0, n: 0, max: 0 };
    const msg = JSON.stringify({ t: 'perf', s: { cpu: s.cpu, thr: s.thr, lag: s.lag, el: s.el, drop: s.drop, step: rp.n ? Math.round(rp.ms / rp.n * 100) / 100 : 0, stepMax: Math.round((rp.max || 0) * 10) / 10, rooms: s.rooms, send: s.send, mem: s.mem, players: s.players, quota: s.quota } });
    for (const c of room.clients) if (c.readyState === 1) c.send(msg);
  }
}
setInterval(perfSecond, 1000).unref();

// Snapshots are compressed once per game, not once per player: one running deflate stream per game (so each update
// compresses against the ones before it, as well as per-connection compression did) whose output goes to everyone in
// it. Someone new to the stream (just joined, or moved games) makes it start afresh, flagged by the first byte, so
// every client can always unpack from the start. Browsers that can't unpack a stream get plain JSON.
// Each message in the stream is framed as [4-byte length][kind][body]: kind 0 is JSON (the full snapshot that starts a
// stream), kind 1 a delta: [4-byte JSON length][JSON][packed numbers] (Sim.packDelta).
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n, 0); return b; };
function frameJson(o) { const j = Buffer.from(JSON.stringify(o)); return Buffer.concat([u32(j.length + 1), Buffer.from([0]), j]); }
function frameDelta(o) {
  const { json, bytes } = Sim.packDelta(o.d); const j = Buffer.from(JSON.stringify(Object.assign({}, o, { d: json })));
  const body = Buffer.concat([Buffer.from([1]), u32(j.length), j, Buffer.from(bytes)]);
  return Buffer.concat([u32(body.length), body]);
}
function sendSnap(room, cur, evs) {
  const zc = []; let plain = null;
  for (const c of room.clients) {
    if (c.readyState !== 1 || c.quiet) continue;
    if (c.zOk) { zc.push(c); continue; }
    // browsers that can't unpack the stream: the full snapshot as before (packed, so leave cur itself alone)
    if (!plain) plain = JSON.stringify({ t: 'snap', k: room.tick, s: Sim.packSnap(JSON.parse(JSON.stringify(cur))), ev: evs });
    c.send(plain);
  }
  const prev = room.lastSnap; room.lastSnap = cur;
  if (!zc.length) { if (room.z) { room.z.d.close(); room.z = null; } return; }
  const fresh = !room.z || !prev || zc.some(c => c.zRoom !== room.z);
  // a full snapshot every 10 seconds as well, so the stream can never drift for long whatever happens
  const key = !fresh && room.tick - (room.zKey || 0) >= 600; if (fresh || key) room.zKey = room.tick;
  if (fresh) {
    if (room.z) room.z.d.close();
    const Z = room.z = { d: zlib.createDeflateRaw({ level: 1, memLevel: 7, windowBits: 12 }), out: [] };
    Z.d.on('data', ch => Z.out.push(ch)); Z.d.on('error', () => { if (room.z === Z) room.z = null; });
    for (const c of zc) c.zRoom = Z;
  }
  const Z = room.z, t0 = process.hrtime.bigint();
  Z.d.write(fresh || key ? frameJson({ t: 'snap', k: room.tick, s: cur, f: 1, ev: evs }) : frameDelta({ t: 'snap', k: room.tick, d: Sim.snapDelta(prev, cur), ev: evs }));
  // the stream finishes this update on a helper thread; updates come out in order, the same bytes for everyone
  Z.d.flush(zlib.constants.Z_SYNC_FLUSH, () => {
    const body = Buffer.concat(Z.out.splice(0)); if (!body.length) return;
    const frame = Buffer.concat([Buffer.from([fresh ? 1 : 0]), body]);
    for (const c of zc) if (c.readyState === 1 && c.zRoom === Z) c.send(frame, { binary: true, compress: false });
    PERF.w.zBytes = (PERF.w.zBytes || 0) + frame.length;
  });
  PERF.w.zMs = (PERF.w.zMs || 0) + Number(process.hrtime.bigint() - t0) / 1e6;
}

// fixed-step game loop. It wakes once per tick (about 60 times a second, not every few milliseconds) and sleeps longer
// when no games are running: on a small host the wake-ups themselves were a big share of the CPU allowance.
let last = process.hrtime.bigint(), acc = 0;
function gameLoop() {
  const now = process.hrtime.bigint(), gap = Number(now - last) / 1e6;
  acc += gap / 1000; last = now;
  if (gap > PERF.w.gap && rooms.size) PERF.w.gap = gap; // the loop should run every tick (~17 ms); a long gap means the server was stalled
  if (acc > 0.25) { PERF.w.drop += acc - 0.25; acc = 0.25; } // don't spiral after a stall (that time is lost: the game jumps)
  if (acc >= TICK * 3) PERF.w.catchup++;
  while (acc >= TICK) {
    acc -= TICK;
    for (const room of rooms.values()) {
      const t0 = process.hrtime.bigint();
      Sim.step(room.world, TICK);
      const ms = Number(process.hrtime.bigint() - t0) / 1e6, rp = room.perf || (room.perf = { ms: 0, n: 0, max: 0 });
      rp.ms += ms; rp.n++; if (ms > rp.max) rp.max = ms;
      PERF.w.step += ms; PERF.w.steps++; if (ms > PERF.w.stepMax) PERF.w.stepMax = ms;
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
        if (watchers) { // built once and sent to everyone in the room
          const t1 = process.hrtime.bigint();
          const cur = Sim.snapshot(room.world);
          // in the lobby, upgrade picks and results little moves: send only when something changed (or once a second)
          const quietPh = !(ph === 'play' || ph === 'pre' || ph === 'post');
          const skip = quietPh && room.lastSnap && !evs.length && room.tick - (room.sentTick || 0) < 60 && Sim.deltaEmpty(Sim.snapDelta(room.lastSnap, cur));
          if (!skip) { sendSnap(room, cur, evs); room.sentTick = room.tick; }
          PERF.w.send += Number(process.hrtime.bigint() - t1) / 1e6;
        }
      }
      if (room.world.records.length) saveRecords(room);
    }
  }
  setTimeout(gameLoop, rooms.size ? Math.max(1, Math.floor((TICK - acc) * 1000)) : 50);
}
setTimeout(gameLoop, 5);

store.init().then(() => CLANS.init()).then(() => loadSettings()).then(() => loadRankedArenas()).then(() => store.setOnlyAdmin(OWNER)).then(() => social.initAI()).then(() => SEASON.init()).then(() => computeRanks()).then(() => {
  server.listen(PORT, () => console.log(`Bowfall server running on http://localhost:${PORT} (${store.kind === 'postgres' ? 'Postgres database' : 'local database file'})`));
}).catch(e => { console.error('Could not open the database:', e.message); process.exit(1); });
process.on('SIGTERM', () => { flushUsers().finally(() => process.exit(0)); });
