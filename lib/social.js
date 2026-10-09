// Friends, parties and matchmaking.
// Friends: accounts only, stored on the account (social: { friends, inReq, outReq }).
// Parties: a leader and friends they've invited, kept in memory. The leader queues the party for 1v1, 2v2 or 3v3.
// Matchmaking: every second, the longest-waiting party is matched with others whose rating is close (the allowed gap widens
// the longer they wait). If nobody suitable turns up within FILL_AFTER seconds, the empty places go to AI players:
// accounts with their own name, rating, skill, favourite archetype and playstyle, who show on the leaderboards marked as AI.
'use strict';
const crypto = require('crypto');

const MODES = { '1v1': 1, '2v2': 2, '3v3': 3 };
const FILL_AFTER = 20;       // seconds of searching before AI players fill the gaps
const JOIN_WAIT = 15;        // seconds a found match waits for everyone to arrive
const DRAFT = 25;            // seconds to pick an element and role once everyone's in (less if everyone's ready)
const chat = require('./ai-chat');
// the AI players themselves: made by tools/seed-ai.js, which plays them against each other for thousands of matches
// so they arrive with settled ratings, careers and achievements
const AI_PLAYERS = (() => { try { return require('./ai-players.json'); } catch (e) { return []; } })();
const { SEED_V } = require('./ai-scale');

module.exports = function createSocial(ctx) {
  const { store, track, markDirty, send, Sim, levelOf, flagOf, ELO_START, rooms, createRoom, sendRoom, sysChat, broadcast } = ctx;
  const conns = new Map();      // who is here: key ('u12' for accounts, 'g-c5' for guests) -> social socket
  const parties = new Map();    // party id -> { id, leader, members: [key], mode, queued: seconds or null, invited: Map(userId -> time) }
  const partyOf = new Map();    // key -> party id
  let aiUsers = [];             // AI players' accounts
  const aiBusy = new Set();     // AI players in a match right now
  const tickets = new Map();    // ticket -> { code, team, key }

  const DM_MAX = 300, DM_PAGE = 40; // longest message, and how many a conversation loads at a time
  const keyOf = ws => ws.user ? 'u' + ws.user.id : 'g-' + ws.cid;
  const nameOf = key => { const ws = conns.get(key); return ws ? (ws.user ? ws.user.name : ws.gname || 'Guest') : '?'; };
  // ratings: 1v1 (career.elo) and team games (career.eloT, starting from the 1v1 one)
  const eloOfUser = (u, mode) => Math.round(ctx.ratingOf(u, ctx.keyFor(mode)));
  const recOf = key => { const ws = conns.get(key); return ws ? ws.user || ws.guest || null : null; }; // an account, or a guest's saved record
  const eloOfKey = (key, mode) => { const r = recOf(key); return r ? eloOfUser(r, mode) : ELO_START; };
  // what the Find game screen shows about someone
  function profileOf(key) {
    const ws = conns.get(key), r = recOf(key), c = (r && r.career) || {}, got = (r && r.ach && r.ach.got) || {};
    return { key, name: nameOf(key), guest: ws && !ws.user ? 1 : 0, elo: eloOfKey(key, '1v1'), eloT: eloOfKey(key, '2v2'), games: c.matches || 0, fights: c.games || 0, place: c.ai ? 0 : Math.max(0, 5 - (c.rated != null ? c.rated : c.matches || 0)), wins: c.matchWins || 0, kills: c.kills || 0,
      lv: c.games ? levelOf(c).lv : null, cc: ws && ws.user ? flagOf(ws.user) : null, top: Sim.achBest(r && r.ach, 3), tiers: (r && r.ach && r.ach.tier) || {}, nAch: Object.keys(got).length,
      el: ws && ws.mmEl, ro: ws && ws.mmRo, avatar: ws && ws.user && ws.user.ach ? ws.user.ach.avatar || null : null, own: ws && ws.user && ws.user.admin ? 1 : 0, sp: ws && ws.user ? ctx.statusOf(ws.user).sp : null, fd: ws && ws.user ? ctx.statusOf(ws.user).fd : null, pt: ws && ws.user ? ctx.statusOf(ws.user).pt : null, inGame: keyInGame(key) ? 1 : 0, local: ws && ws.localOf ? 1 : 0,
      look: r && ctx.lookOf ? Object.assign({ ti: (ws && ws.title) || r.title || null }, ctx.lookOf(r)) : null }; // banner: border, finish, medals and title, as a lobby shows them
  }
  const soc = u => { u.social = u.social || {}; for (const k of ['friends', 'inReq', 'outReq']) u.social[k] = u.social[k] || []; return u.social; };
  const online = id => conns.has('u' + id);
  const inGame = id => { for (const r of rooms.values()) for (const c of r.clients) if (c.user && c.user.id === id) return true; return false; };
  const keyInGame = key => { const ws = conns.get(key); if (!ws) return false; for (const r of rooms.values()) for (const c of r.clients) if ((ws.user && c.user && c.user.id === ws.user.id) || (ws.guest && c.guest === ws.guest)) return true; return false; };

  // ---- AI players: made once, then they live on as accounts
  async function initAI() {
    const all = await store.leaderboard('games', 100000);
    aiUsers = all.filter(u => u.career && u.career.ai).map(track);
    const byName = new Map(aiUsers.map(u => [u.name.toLowerCase(), u]));
    for (const a of AI_PLAYERS) {
      const have = byName.get(a.name.toLowerCase());
      if (!have) { // new on the list: create them (skipping any name a real player already has)
        const u = await store.createUser(a.name, '', false);
        if (!u) continue;
        Object.assign(u, { career: JSON.parse(JSON.stringify(a.career)), ach: JSON.parse(JSON.stringify(a.ach || {})), country: a.country, title: a.title || null, created: a.created || u.created });
        u.career.ai = a.ai;
        await store.saveUser(u);
        aiUsers.push(track(u));
      } else if ((have.career.seedV || 0) < SEED_V) { // the list was re-sized since this account was made: take the new career, keep the ratings they have earned here
        const keep = {}; for (const k of ['elo', 'eloT', 'eloPeak', 'relo', 'hist']) if (have.career[k] != null) keep[k] = have.career[k];
        have.career = Object.assign(JSON.parse(JSON.stringify(a.career)), keep, { ai: a.ai });
        have.ach = JSON.parse(JSON.stringify(a.ach || {})); have.title = a.title || null; have.country = have.country || a.country;
        if (a.created && (!have.created || have.created > a.created)) have.created = a.created;
        await store.saveUser(have);
      }
    }
    // AI players who have never played a team game get a team rating of their own, near their 1v1 one (a fixed
    // amount either side, from their name), so they show on the team leaderboard. It's only set once: after that
    // it moves with their games and is kept in the database like everyone else's.
    for (const u of aiUsers) {
      const c = u.career || (u.career = {});
      if (c.eloT != null) continue;
      let h = 0; for (const ch of u.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      c.eloT = Math.max(400, Math.round((c.elo != null ? c.elo : ELO_START) + (h % 121) - 60)); c.eloTPeak = Math.max(c.eloTPeak || 0, c.eloT);
      await store.saveUser(u);
    }
  }

  // an AI player takes a bot's place in a match
  function seatAI(room, team, u) {
    const w = room.world, a = u.career.ai;
    const b = Sim.addBot(w, team);
    if (!b) return null;
    b.name = u.name; b.dparams = Sim.skillParams(a.skill); b.aiUser = u.id;
    // one of their favourite archetypes, mostly their main
    const L = a.loadouts || [[a.el, a.ro, 1]], tot = L.reduce((t, l) => t + l[2], 0); let r = Math.random() * tot, pickL = L[0];
    for (const l of L) { if ((r -= l[2]) <= 0) { pickL = l; break; } }
    Sim.setLoadout(w, b.id, pickL[0], pickL[1]);
    const ach = u.ach || {}, got = ach.got || {};
    Sim.setMeta(w, b.id, { bd: ach.border && got[ach.border] ? ach.border : null, na: Object.keys(got).length || null });
    if (u.title) Sim.setTitle(w, b.id, u.title);
    b.ai.aggr = a.aggr; if (a.style) b.ai.style = b.ai.baseStyle = a.style;
    Sim.setMeta(w, b.id, { cc: flagOf(u), lv: levelOf(u.career).lv });
    room.ai.set(b.id, u); aiBusy.add(u.id);
    return b;
  }
  // ---- AI players talk: at the start, on knockouts, clutches, deciders and big results, and back to people
  const aiSaid = new Map(); // AI account id -> the last lines they said (so they don't keep repeating themselves)
  function say(room, pid, event, about, opts = {}) {
    const u = room.ai && room.ai.get(pid); if (!u) return false;
    const a = u.career.ai, now = Date.now();
    room.aiTalk = room.aiTalk || {};
    if (now < (room.aiBusyTo || {})[pid]) return false; // still "typing" the last one
    if (now - (room.aiTalk[pid] || 0) < (event === 'reply' ? 3000 : 6000) && !opts.force) return false; // nobody spams
    // how likely they are to say something: their chattiness, and how much the moment calls for it (people saying hi usually get an answer)
    const chance = event === 'reply' ? 0.3 + 0.65 * (a.chat || 0.3) : (a.chat || 0.3) * (chat.WEIGHT[event] || 0.3);
    if (Math.random() > chance) return false;
    const kind = opts.kind || event;
    const mine = aiSaid.get(u.id) || [], avoid = new Set(mine.concat(room.aiRecent || []));
    const got = chat.line(a.tone, kind, about, avoid);
    if (!got || avoid.has(got.raw) && Math.random() < 0.7) return false;
    mine.push(got.raw); if (mine.length > 12) mine.shift(); aiSaid.set(u.id, mine);
    room.aiRecent = (room.aiRecent || []).concat(got.raw).slice(-10);
    const wait = chat.typingDelay(got.text, opts.settle) + (opts.after || 0);
    room.aiTalk[pid] = now + wait; room.aiBusyTo = room.aiBusyTo || {}; room.aiBusyTo[pid] = now + wait;
    setTimeout(() => {
      if (!rooms.has(room.code)) return;
      const p = room.world.players.find(q => q.id === pid);
      broadcast(room, { t: 'chat', n: u.name, tm: p ? p.team : 'spec', c: p ? p.color : null, m: got.text, ai: 1 });
    }, wait);
    return true;
  }
  function aiEvents(room, evs) {
    if (!room.ai || !room.ai.size) return;
    const w = room.world, M = w.match, teamOf = id => { const p = w.players.find(q => q.id === id); return p ? p.team : null; };
    const isHuman = id => { const p = w.players.find(q => q.id === id); return p && !p.bot; };
    const pts = w.cfg.pointsToWin || 3;
    for (const e of evs) {
      if (e.e === 'matchStart') { room.aiKills = {}; room.aiFirst = false; }
      else if (e.e === 'phase' && e.ph === 'play') {
        room.aiGameK = {};
        if (e.rd === 1 && e.gm === 1) { for (const pid of room.ai.keys()) say(room, pid, 'start', null, { after: Math.random() * 1500 }); }
        else if (pts > 1 && e.gm === 1 && M.wins.red === pts - 1 && M.wins.blue === pts - 1) { const pid = [...room.ai.keys()][Math.floor(Math.random() * room.ai.size)]; say(room, pid, 'decider', null, { force: true }); }
      } else if (e.e === 'kill') {
        const killer = e.k && e.k !== e.v ? e.k : null;
        if (killer && room.ai.has(killer)) {
          room.aiGameK = room.aiGameK || {}; room.aiGameK[killer] = (room.aiGameK[killer] || 0) + 1;
          if (!room.aiFirst) say(room, killer, 'firstBlood');
          else if (room.aiGameK[killer] === 3) say(room, killer, 'streak');
          else say(room, killer, ['pit', 'lava', 'water', 'spikes', 'saw', 'burn'].includes(e.c) ? 'ring' : 'kill', e.vn);
        }
        room.aiFirst = true;
        if (room.ai.has(e.v)) say(room, e.v, killer ? 'died' : 'selfDie', e.kn);
        else if (!killer && isHuman(e.v)) { const ids = [...room.ai.keys()]; say(room, ids[Math.floor(Math.random() * ids.length)], 'theyFell', e.vn); }
      } else if (e.e === 'clutch') {
        if (room.ai.has(e.id)) say(room, e.id, 'clutchMe', null, { settle: true, force: true });
        else for (const pid of room.ai.keys()) if (teamOf(pid) !== e.tm && say(room, pid, 'clutchThem', e.n, { settle: true })) break;
      } else if (e.e === 'gameEnd' && e.rw && e.rw !== 'draw' && !e.rwon) {
        for (const pid of room.ai.keys()) if (Math.random() < 0.5) say(room, pid, teamOf(pid) === e.rw ? 'gameWin' : 'gameLose', null, { settle: true });
      } else if (e.e === 'roundEnd' && e.wins) {
        const W = { red: e.wins[0], blue: e.wins[1] };
        if (W.red >= pts || W.blue >= pts) continue; // matchEnd covers it
        for (const pid of room.ai.keys()) {
          const t = teamOf(pid), o = t === 'red' ? 'blue' : 'red'; if (!t) continue;
          if (W[t] === pts - 1 && W[o] < pts - 1 && say(room, pid, 'matchPoint', null, { settle: true })) break;
          if (W[o] - W[t] >= 2 && say(room, pid, 'behind', null, { settle: true })) break;
        }
      } else if (e.e === 'matchEnd') {
        const humans = w.players.filter(p => !p.bot), star = humans.slice().sort((a, b) => (b.kills || 0) - (a.kills || 0))[0];
        for (const pid of room.ai.keys()) {
          const t = teamOf(pid); if (!t) continue;
          const won = t === e.mw, W = e.wins || [0, 0], mine = t === 'red' ? W[0] : W[1], theirs = t === 'red' ? W[1] : W[0];
          const ev = theirs === 0 && won ? 'stomp' : mine === 0 && !won ? 'stomped' : Math.abs(mine - theirs) === 1 ? (won ? 'closeWin' : 'closeLose') : (won ? 'matchWin' : 'matchLose');
          const foe = humans.filter(p => p.team !== t).sort((a, b) => (b.kills || 0) - (a.kills || 0))[0] || star;
          room.aiTalk[pid] = 0;
          if (!say(room, pid, ev, foe && foe.name, { settle: true, force: true }) && ev !== (won ? 'matchWin' : 'matchLose')) say(room, pid, won ? 'matchWin' : 'matchLose', foe && foe.name, { settle: true, force: true });
        }
      }
    }
  }
  // someone said something in chat: one or two AI players may answer (only to things worth answering)
  function aiReply(room, text, from) {
    if (!room.ai || !room.ai.size) return;
    const kind = chat.kindOf(text); if (!kind) return;
    if (from && [...room.ai.values()].some(u => u.name === from)) return;
    const named = [...room.ai.entries()].filter(([, u]) => { const sn = chat.shortName(u.name).replace(/[^a-z]/g, ''); return sn.length >= 3 && new RegExp('\\b' + sn + '\\b', 'i').test(text); });
    const ids = named.length ? named.map(([pid]) => pid) : [...room.ai.keys()].sort(() => Math.random() - 0.5).slice(0, kind === 'bot' ? 1 : 2);
    let n = 0;
    for (const pid of ids) if (n < 2 && say(room, pid, 'reply', from, { kind, after: n * 1200 })) n++;
  }
  function freeAI(room) { if (room.ai) for (const u of room.ai.values()) aiBusy.delete(u.id); }

  // ---- what a friend is doing right now, for the friends lists
  // ranked or custom game (and whether it's still in its lobby), searching, or what their page says (menu, practice…)
  function activity(id) {
    for (const r of rooms.values()) for (const c of r.clients) if (c.user && c.user.id === id) {
      const ph = r.world.match.ph, lobby = ph === 'lobby';
      if (c.watch) return { act: 'watching', mode: r.ranked && r.ranked.mode };
      if (r.ranked) return { act: 'ranked', mode: r.ranked.mode };
      return { act: lobby ? 'customLobby' : 'custom', code: r.pub ? r.code : undefined, locked: r.pwHash ? 1 : undefined, room: r.name || undefined, n: r.clients.size, max: r.max || 8 };
    }
    const k = 'u' + id, p = parties.get(partyOf.get(k)), ws = conns.get(k);
    if (p && p.queued != null) return { act: 'searching', mode: p.mode };
    return { act: (ws && ws.status) || 'menu' };
  }

  // ---- telling people what's going on
  function friendsOf(u) {
    const s = soc(u);
    const un = s.unread || {};
    const list = id => { const f = ctx.live.get(id); return f ? Object.assign({ id, name: f.name, online: online(id), inGame: inGame(id), lv: levelOf(f.career).lv, elo: eloOfUser(f), cc: flagOf(f), un: un[id] || 0 }, online(id) ? activity(id) : {}) : null; };
    return { friends: s.friends.map(list).filter(Boolean), inReq: s.inReq.map(list).filter(Boolean), outReq: s.outReq.map(list).filter(Boolean) };
  }
  function partyView(key) {
    const pid = partyOf.get(key), p = pid && parties.get(pid);
    if (!p) return null;
    return { id: p.id, leader: p.leader, you: key, mode: p.mode, queued: p.queued != null ? p.queued : null, fill: FILL_AFTER,
      ready: [...(p.ready || [])].filter(k => p.members.includes(k)), members: p.members.map(profileOf) };
  }
  function pushState(key) {
    const ws = conns.get(key); if (!ws) return;
    send(ws, Object.assign({ t: 'social', you: key, account: !!ws.user, me: profileOf(key), party: partyView(key), maps: rankedPool().map(k => ({ k, n: Sim.MAPS[k].name })) }, ws.user ? friendsOf(ws.user) : { friends: [], inReq: [], outReq: [] }));
  }
  function pushFriendsOf(u) { for (const id of soc(u).friends) if (online(id)) pushState('u' + id); }
  function pushParty(p) { for (const k of p.members) pushState(k); }
  // someone joined or left a game: their party and friends see "In a game" change straight away
  function presence(ws) {
    const u = ws.user, g = ws.guest; if (!u && !g) return;
    for (const [k, c] of conns) if ((u && c.user && c.user.id === u.id) || (g && c.guest === g)) {
      const p = parties.get(partyOf.get(k));
      if (p) pushParty(p); else pushState(k);
      if (c.user) pushFriendsOf(c.user);
    }
  }

  // make sure everyone involved is loaded, so changes land on the same objects as everywhere else
  async function loadUsers(ids) {
    const need = ids.filter(id => !ctx.live.has(id));
    if (need.length) for (const u of await store.usersByIds(need)) track(u);
  }

  // ---- parties
  function ensureParty(key) {
    let pid = partyOf.get(key);
    if (pid && parties.get(pid)) return parties.get(pid);
    const p = { id: crypto.randomBytes(6).toString('hex'), leader: key, members: [key], mode: '1v1', queued: null, invited: new Map() };
    parties.set(p.id, p); partyOf.set(key, p.id);
    return p;
  }
  function leaveParty(key) {
    const pid = partyOf.get(key), p = pid && parties.get(pid);
    partyOf.delete(key);
    if (!p) return;
    p.members = p.members.filter(k => k !== key);
    p.queued = null; if (p.ready) p.ready.delete(key);
    if (!p.members.length) { parties.delete(p.id); return; }
    if (p.leader === key) p.leader = p.members[0];
    pushParty(p);
  }

  // ---- matchmaking
  const rankedPool = () => (ctx.rankedMaps ? ctx.rankedMaps() : Sim.MAP_KEYS).filter(k => Sim.MAPS[k]);
  // the arena for a match, from everyone's favourite and least favourite: each player puts in their favourite, or
  // "any" if they have none or someone else can't stand it; one of those is drawn, and "any" is a random arena nobody dislikes
  function pickMap(pool, prefs, rnd = Math.random) {
    const ok = k => typeof k === 'string' && pool.includes(k);
    const hate = new Set(prefs.map(p => p && p.hate).filter(ok));
    const opts = prefs.map(p => (p && ok(p.fav) && !hate.has(p.fav)) ? p.fav : null);
    if (!opts.length) opts.push(null);
    const c = opts[Math.floor(rnd() * opts.length)];
    if (c) return c;
    const rest = pool.filter(k => !hate.has(k)), from = rest.length ? rest : pool;
    return from[Math.floor(rnd() * from.length)];
  }
  const cleanPref = m => { const f = m && typeof m.fav === 'string' ? m.fav.slice(0, 40) : null, h = m && typeof m.hate === 'string' ? m.hate.slice(0, 40) : null; return { fav: f, hate: h !== f ? h : null }; };
  function tick() {
    for (const p of parties.values()) if (p.queued != null) p.queued++;
    for (const [mode, n] of Object.entries(MODES)) {
      const queue = [...parties.values()].filter(p => p.queued != null && p.mode === mode && p.members.every(k => conns.has(k))).sort((a, b) => b.queued - a.queued);
      while (queue.length) {
        const head = queue[0];
        const avg = p => p.members.reduce((s, k) => s + eloOfKey(k, mode), 0) / p.members.length;
        const win = p => Math.min(700, 120 + 30 * p.queued); // how far apart ratings may be; widens while waiting
        const pool = queue.filter(p => Math.abs(avg(p) - avg(head)) <= Math.max(win(head), win(p)));
        // fill two teams of n, keeping parties together, balancing ratings
        const teams = { red: [], blue: [] }, used = [];
        for (const p of pool) {
          const opts = ['red', 'blue'].filter(t => teams[t].length + p.members.length <= n);
          if (!opts.length) continue;
          const sum = t => teams[t].reduce((s, k) => s + eloOfKey(k, mode), 0);
          const t = opts.sort((a, b) => teams[a].length - teams[b].length || sum(a) - sum(b))[0];
          teams[t].push(...p.members); used.push(p);
          if (teams.red.length === n && teams.blue.length === n) break;
        }
        const full = teams.red.length === n && teams.blue.length === n;
        if (!full && head.queued < FILL_AFTER) break;
        startMatch(mode, n, teams, used, avg(head));
        for (const p of used) queue.splice(queue.indexOf(p), 1);
      }
    }
    for (const p of parties.values()) if (p.queued != null) pushParty(p);
  }
  setInterval(tick, 1000).unref();

  function startMatch(mode, n, teams, used, target) {
    const pool = rankedPool(), prefs = [];
    for (const p of used) for (const k of p.members) { const c = conns.get(k); prefs.push((c && c.mapPref) || null); }
    // every AI player filling a place counts as someone with no favourite, so a match against AI isn't always on your favourite arena
    for (let i = teams.red.length + teams.blue.length; i < 2 * n; i++) prefs.push(null);
    const map = pickMap(pool, prefs);
    const room = createRoom({ map, diff: 'normal' });
    room.pub = false; room.name = `Ranked ${mode}`; room.ranked = { mode, until: Date.now() + JOIN_WAIT * 1000, expect: new Set() };
    room.ai = new Map(); room.host = null; room.max = 2 * n + 4;
    // AI players for the empty places, as close as possible to the rating everyone else has
    for (const team of ['red', 'blue']) {
      while (teams[team].length < n) {
        const cand = aiUsers.filter(u => !aiBusy.has(u.id)).sort((a, b) => Math.abs(eloOfUser(a, mode) - target) - Math.abs(eloOfUser(b, mode) - target));
        const pickFrom = cand.slice(0, 4), u = pickFrom[Math.floor(Math.random() * pickFrom.length)];
        if (!u || !seatAI(room, team, u)) { const b = Sim.addBot(room.world, team); if (b) b.diff = 'hard'; }
        teams[team].push('ai');
      }
    }
    for (const p of used) {
      p.queued = null; p.ready = new Set();
      for (const k of p.members) {
        const team = teams.red.includes(k) ? 'red' : 'blue', ticket = crypto.randomBytes(9).toString('hex');
        tickets.set(ticket, { code: room.code, team, key: k, until: Date.now() + JOIN_WAIT * 1000 + 5000 });
        room.ranked.expect.add(k);
        const ws = conns.get(k);
        if (ws) send(ws, { t: 'matched', code: room.code, ticket, mode });
      }
      pushParty(p); // they've stopped searching
    }
  }
  // someone arriving with a ticket: straight onto their team; the match starts once everyone's in (or after JOIN_WAIT)
  function useTicket(ws, room, ticket) {
    const tk = tickets.get(String(ticket || ''));
    if (!tk || tk.code !== room.code || tk.until < Date.now()) return 'That match has expired. Search again.';
    tickets.delete(String(ticket));
    ws.mmKey = tk.key; ws.mmTeam = tk.team;
    return null;
  }
  function arrived(room, ws) {
    if (!room.ranked) return;
    room.ranked.expect.delete(ws.mmKey);
    if (!room.ranked.expect.size) begin(room);
  }
  function begin(room) {
    if (!room.ranked || room.ranked.started) return;
    room.ranked.started = true;
    const w = room.world;
    if (!room.clients.size) { freeAI(room); rooms.delete(room.code); return; } // nobody came
    // anyone who didn't turn up: an AI player takes their place
    for (const team of ['red', 'blue']) {
      const n = MODES[room.ranked.mode];
      while (w.players.filter(p => p.team === team).length < n) {
        const u = aiUsers.find(u => !aiBusy.has(u.id));
        if (!u || !seatAI(room, team, u)) break;
      }
    }
    // everyone's here: a short draft to choose an element and role for this arena, then the match
    room.ranked.draftUntil = Date.now() + DRAFT * 1000; room.ranked.ready = new Set();
    sysChat(room, `Ranked ${room.ranked.mode} on ${Sim.MAPS[w.cfg.map].name}. Choose your element and role!`);
    sendRoom(room);
  }
  function draftReady(room, ws) {
    if (!room.ranked || !room.ranked.draftUntil || room.ranked.go) return;
    room.ranked.ready.add(ws.cid);
    const humans = [...room.clients].filter(c => c.pid);
    if (humans.every(c => room.ranked.ready.has(c.cid))) room.ranked.draftUntil = Math.min(room.ranked.draftUntil, Date.now() + 1500);
    sendRoom(room);
  }
  function go(room) {
    room.ranked.go = true;
    Sim.startMatch(room.world);
    sysChat(room, 'Good luck!');
    sendRoom(room);
  }
  setInterval(() => {
    for (const room of rooms.values()) if (room.ranked && room.ranked.draftUntil && !room.ranked.go && Date.now() > room.ranked.draftUntil) go(room);
    for (const room of rooms.values()) if (room.ranked && !room.ranked.started && Date.now() > room.ranked.until) begin(room);
    for (const [t, tk] of tickets) if (tk.until < Date.now()) tickets.delete(t);
  }, 1000).unref();

  // ---- messages
  async function handle(ws, m) {
    const key = ws.user || ws.social ? keyOf(ws) : null;
    switch (m.t) {
      case 'hello': {
        ws.social = true; ws.gname = String(m.name || '').slice(0, 16) || 'Guest';
        if (m.mp) ws.mapPref = cleanPref(m.mp);
        if (!ws.user && m.gt && ctx.loadGuest) ws.guest = await ctx.loadGuest(m.gt, ws.gname);
        if (Sim.ELEMENTS[m.el]) ws.mmEl = m.el; if (Sim.ROLES[m.ro]) ws.mmRo = m.ro;
        ws.hint = m.hint && typeof m.hint === 'object' ? { bot: +m.hint.bot || 0, tut: m.hint.tut ? 1 : 0 } : null;
        if (ctx.seedRating && ws.hint && (ws.user || ws.guest)) ctx.seedRating(ws.user || ws.guest, ws.hint); // a starting rating for the unrated
        const k = keyOf(ws), old = conns.get(k);
        if (old && old !== ws) { old.social = false; send(old, { t: 'note', msg: 'Signed in somewhere else.' }); }
        conns.set(k, ws);
        if (ws.user) { const s = soc(ws.user); await loadUsers(s.friends.concat(s.inReq, s.outReq)); pushFriendsOf(ws.user); }
        pushState(k);
        if (ws.guest || ws.user) send(ws, { t: 'ach', keys: [], ach: (ws.guest || ws.user).ach || {} }); // their achievements, for the game's screens
        return true;
      }
      case 'friend': {
        if (!ws.user) { send(ws, { t: 'note', msg: 'Sign in to add friends.' }); return true; }
        const me = ws.user, S = soc(me);
        let other = null;
        if (m.op === 'add') {
          other = await store.userByName(String(m.name || '').trim()).catch(() => null);
          if (!other || (other.career && other.career.ai)) { send(ws, { t: 'note', msg: 'No player with that name.' }); return true; }
          other = track(other);
          if (other.id === me.id) { send(ws, { t: 'note', msg: "That's you!" }); return true; }
          const O = soc(other);
          if (S.friends.includes(other.id)) { send(ws, { t: 'note', msg: `${other.name} is already your friend.` }); return true; }
          if (S.inReq.includes(other.id)) { m.op = 'accept'; m.id = other.id; }
          else {
            if (!S.outReq.includes(other.id)) S.outReq.push(other.id);
            if (!O.inReq.includes(me.id)) O.inReq.push(me.id);
            markDirty(me); markDirty(other);
            send(ws, { t: 'note', msg: `Friend request sent to ${other.name}.` });
            if (online(other.id)) { pushState('u' + other.id); send(conns.get('u' + other.id), { t: 'note', msg: `${me.name} sent you a friend request. Accept it in the Friends panel on the main menu.` }); }
            pushState(keyOf(ws));
            return true;
          }
        }
        const id = +m.id;
        await loadUsers([id]);
        other = ctx.live.get(id);
        if (!other) return true;
        const O = soc(other);
        const drop = (arr, v) => { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); };
        if (m.op === 'accept' && S.inReq.includes(id)) {
          drop(S.inReq, id); drop(O.outReq, me.id);
          if (!S.friends.includes(id)) S.friends.push(id);
          if (!O.friends.includes(me.id)) O.friends.push(me.id);
          if (online(id)) send(conns.get('u' + id), { t: 'note', msg: `${me.name} accepted your friend request.` });
        } else if (m.op === 'decline') { drop(S.inReq, id); drop(O.outReq, me.id); }
        else if (m.op === 'cancel') { drop(S.outReq, id); drop(O.inReq, me.id); }
        else if (m.op === 'remove') { drop(S.friends, id); drop(O.friends, me.id); if (S.unread) delete S.unread[id]; if (O.unread) delete O.unread[me.id]; }
        markDirty(me); markDirty(other);
        pushState(keyOf(ws)); if (online(id)) pushState('u' + id);
        return true;
      }
      case 'party': {
        if (!key || !conns.has(key)) return true;
        if (m.op === 'invite') {
          if (!ws.user) { send(ws, { t: 'note', msg: 'Sign in to invite friends.' }); return true; }
          const id = +m.id, fk = 'u' + id;
          if (!soc(ws.user).friends.includes(id)) return true;
          if (!online(id)) { send(ws, { t: 'note', msg: "They're not online." }); return true; }
          const p = ensureParty(key);
          if (p.leader !== key) { send(ws, { t: 'note', msg: 'Only the party leader can invite.' }); return true; }
          if (p.members.length >= 3) { send(ws, { t: 'note', msg: 'Parties are up to 3 players.' }); return true; }
          p.invited.set(id, Date.now());
          send(conns.get(fk), { t: 'invite', party: p.id, from: ws.user.name });
          send(ws, { t: 'note', msg: `Invited ${ctx.live.get(id) ? ctx.live.get(id).name : 'them'}.` });
          pushParty(p);
        } else if (m.op === 'accept') {
          const p = parties.get(String(m.party));
          if (!p || !ws.user || !p.invited.has(ws.user.id) || Date.now() - p.invited.get(ws.user.id) > 120000) { send(ws, { t: 'note', msg: 'That invite has expired.' }); return true; }
          if (p.members.length >= 3) { send(ws, { t: 'note', msg: 'That party is full.' }); return true; }
          p.invited.delete(ws.user.id);
          leaveParty(key);
          p.members.push(key); partyOf.set(key, p.id); p.queued = null;
          if (p.members.length > MODES[p.mode]) p.mode = p.members.length === 2 ? '2v2' : '3v3';
          pushParty(p);
        } else if (m.op === 'linkcode') {
          // the main player's computer asks for a one-off code its extra (controller) players use to join the party
          const p = ensureParty(key); p.link = p.link || crypto.randomBytes(6).toString('hex');
          send(ws, { t: 'linkcode', party: p.id, code: p.link });
        } else if (m.op === 'link') {
          const p = parties.get(String(m.party));
          if (!p || !p.link || p.link !== String(m.code)) { send(ws, { t: 'note', msg: "Couldn't join the party." }); return true; }
          if (p.members.length >= 3) { send(ws, { t: 'note', msg: 'Parties are up to 3 players.' }); return true; }
          if (p.members.includes(key)) return true;
          leaveParty(key); ws.localOf = p.leader;
          p.members.push(key); partyOf.set(key, p.id); p.queued = null;
          if (p.members.length > MODES[p.mode]) p.mode = p.members.length === 2 ? '2v2' : '3v3';
          pushParty(p);
        } else if (m.op === 'leave') { leaveParty(key); pushState(key); }
        else if (m.op === 'ready') { // party members say they're ready; the leader can only search once everyone is
          const p = parties.get(partyOf.get(key)); if (!p || p.leader === key) return true;
          p.ready = p.ready || new Set();
          const on = !!m.on; if (on === p.ready.has(key)) return true;
          if (on) p.ready.add(key); else p.ready.delete(key);
          for (const k of p.members) if (k !== key) send(conns.get(k), { t: 'partyReady', name: nameOf(key), on });
          pushParty(p);
        }
        else if (m.op === 'loadout') {
          if (Sim.ELEMENTS[m.el]) ws.mmEl = m.el; if (Sim.ROLES[m.ro]) ws.mmRo = m.ro;
          const p = parties.get(partyOf.get(key)); if (p) pushParty(p); else pushState(key);
        }
        else if (m.op === 'kick') {
          const p = parties.get(partyOf.get(key));
          if (p && p.leader === key && m.key !== key && p.members.includes(String(m.key))) { const k = String(m.key); leaveParty(k); pushState(k); send(conns.get(k), { t: 'note', msg: 'You were removed from the party.' }); }
        } else if (m.op === 'mode') {
          const p = ensureParty(key);
          if (p.leader !== key || !MODES[m.mode]) return true;
          if (p.members.length > MODES[m.mode]) { send(ws, { t: 'note', msg: `Your party has ${p.members.length} players: too many for ${m.mode}.` }); return true; }
          p.mode = m.mode; p.queued = null; pushParty(p);
        }
        return true;
      }
      case 'status': { // what the page is showing: the main menu, practice or the tutorial (games and searches are known here)
        if (!key || !conns.has(key)) return true;
        const v = ['menu', 'practice', 'tutorial'].includes(m.s) ? m.s : 'menu';
        if (ws.status !== v) { ws.status = v; if (ws.user) pushFriendsOf(ws.user); }
        return true;
      }
      case 'mappref': { ws.mapPref = cleanPref(m); return true; }
      case 'dm': { // messages between friends (accounts only)
        if (!ws.user || !ws.social || !store.dmAdd) return true;
        const me = ws.user, S = soc(me), id = +m.with;
        if (m.op === 'close') { ws.dmOpen = null; return true; }
        if (!S.friends.includes(id)) { if (m.op === 'send') send(ws, { t: 'note', msg: 'You can only message friends.' }); return true; }
        await loadUsers([id]);
        const other = ctx.live.get(id); if (!other) return true;
        if (m.op === 'open' || m.op === 'more') {
          if (m.op === 'open') { ws.dmOpen = id; if (S.unread && S.unread[id]) { delete S.unread[id]; markDirty(me); pushState(keyOf(ws)); } }
          const before = m.op === 'more' ? +m.before || 0 : 0;
          const list = await store.dmHistory(me.id, id, before, DM_PAGE).catch(() => []);
          send(ws, { t: 'dmHist', with: id, name: other.name, more: list.length === DM_PAGE, older: !!before, list });
          return true;
        }
        if (m.op === 'send') {
          const body = String(m.body || '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, DM_MAX);
          if (!body) return true;
          const now = Date.now(); ws.dmT = (ws.dmT || []).filter(t => now - t < 10000);
          if (ws.dmT.length >= 8) { send(ws, { t: 'note', msg: 'Slow down a little.' }); return true; }
          ws.dmT.push(now);
          const msg = await store.dmAdd(me.id, id, body).catch(() => null);
          if (!msg) { send(ws, { t: 'note', msg: "Couldn't send that. Try again." }); return true; }
          send(ws, { t: 'dm', msg, name: other.name });
          const to = conns.get('u' + id);
          if (!(to && to.dmOpen === me.id)) { const O = soc(other); O.unread = O.unread || {}; O.unread[me.id] = Math.min(99, (O.unread[me.id] || 0) + 1); markDirty(other); }
          if (to) { send(to, { t: 'dm', msg, name: me.name }); pushState('u' + id); }
        }
        return true;
      }
      case 'queue': {
        if (!key || !conns.has(key)) return true;
        if (m.mp) ws.mapPref = cleanPref(m.mp);
        const p = ensureParty(key);
        if (p.leader !== key) { send(ws, { t: 'note', msg: 'The party leader starts the search.' }); return true; }
        if (m.op === 'start') {
          if (p.members.some(keyInGame)) { send(ws, { t: 'note', msg: 'Waiting for everyone in your party to get back from their game.' }); return true; }
          // everyone but the leader readies up first (players on the leader's own controllers count as ready)
          const waiting = p.members.filter(k => k !== key && !(p.ready && p.ready.has(k)) && !(conns.get(k) || {}).localOf);
          if (waiting.length) { send(ws, { t: 'note', msg: `Waiting for ${waiting.map(nameOf).join(' and ')} to ready up.` }); return true; }
          if (MODES[m.mode] && p.members.length <= MODES[m.mode]) p.mode = m.mode;
          if (p.members.length > MODES[p.mode]) { send(ws, { t: 'note', msg: 'Too many in your party for that mode.' }); return true; }
          p.queued = 0;
        } else p.queued = null;
        pushParty(p);
        for (const k of p.members) { const c = conns.get(k); if (c && c.user) pushFriendsOf(c.user); } // friends see "Finding a game"
        return true;
      }
    }
    return false;
  }
  function gone(ws) {
    if (!ws.social) return;
    const k = keyOf(ws);
    if (conns.get(k) !== ws) return;
    conns.delete(k);
    leaveParty(k);
    if (ws.user) pushFriendsOf(ws.user);
  }
  function walletNote(u, msg) { const ws = conns.get('u' + u.id); if (ws) send(ws, msg); }
  return { isOnline: online, walletNote, handle, gone, presence, initAI, useTicket, arrived, freeAI, aiEvents, aiReply, draftReady, isAI: u => !!(u && u.career && u.career.ai), MODES, FILL_AFTER, _tick: tick, _ai: () => aiUsers, pickMap };
};
