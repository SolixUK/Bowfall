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
const chat = require('./ai-chat');
// the AI players themselves: made by tools/seed-ai.js, which plays them against each other for thousands of matches
// so they arrive with settled ratings, careers and achievements
const AI_PLAYERS = (() => { try { return require('./ai-players.json'); } catch (e) { return []; } })();

module.exports = function createSocial(ctx) {
  const { store, track, markDirty, send, Sim, levelOf, flagOf, ELO_START, rooms, createRoom, sendRoom, sysChat, broadcast } = ctx;
  const conns = new Map();      // who is here: key ('u12' for accounts, 'g-c5' for guests) -> social socket
  const parties = new Map();    // party id -> { id, leader, members: [key], mode, queued: seconds or null, invited: Map(userId -> time) }
  const partyOf = new Map();    // key -> party id
  let aiUsers = [];             // AI players' accounts
  const aiBusy = new Set();     // AI players in a match right now
  const tickets = new Map();    // ticket -> { code, team, key }

  const keyOf = ws => ws.user ? 'u' + ws.user.id : 'g-' + ws.cid;
  const nameOf = key => { const ws = conns.get(key); return ws ? (ws.user ? ws.user.name : ws.gname || 'Guest') : '?'; };
  const eloOfUser = u => Math.round((u.career && u.career.elo) || ELO_START);
  const recOf = key => { const ws = conns.get(key); return ws ? ws.user || ws.guest || null : null; }; // an account, or a guest's saved record
  const eloOfKey = key => { const r = recOf(key); return r ? eloOfUser(r) : ELO_START; };
  // what the Find game screen shows about someone
  function profileOf(key) {
    const ws = conns.get(key), r = recOf(key), c = (r && r.career) || {}, got = (r && r.ach && r.ach.got) || {};
    return { key, name: nameOf(key), guest: ws && !ws.user ? 1 : 0, elo: eloOfKey(key), games: c.games || 0, wins: c.wins || 0, kills: c.kills || 0,
      lv: c.games ? levelOf(c).lv : null, cc: ws && ws.user ? flagOf(ws.user) : null, top: Sim.ACH_ORDER.filter(k => got[k]).slice(0, 3), nAch: Object.keys(got).length,
      el: ws && ws.mmEl, ro: ws && ws.mmRo, avatar: ws && ws.user && ws.user.ach ? ws.user.ach.avatar || null : null };
  }
  const soc = u => { u.social = u.social || {}; for (const k of ['friends', 'inReq', 'outReq']) u.social[k] = u.social[k] || []; return u.social; };
  const online = id => conns.has('u' + id);
  const inGame = id => { for (const r of rooms.values()) for (const c of r.clients) if (c.user && c.user.id === id) return true; return false; };

  // ---- AI players: made once, then they live on as accounts
  async function initAI() {
    const all = await store.leaderboard('games', 100000);
    aiUsers = all.filter(u => u.career && u.career.ai).map(track);
    if (aiUsers.length) return;
    // first run: create them from the seeded list (skipping any name a real player already has)
    for (const a of AI_PLAYERS) {
      const u = await store.createUser(a.name, '', false);
      if (!u) continue;
      Object.assign(u, { career: a.career, ach: a.ach || {}, country: a.country, title: a.title || null });
      u.career.ai = a.ai;
      await store.saveUser(u);
      aiUsers.push(track(u));
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
  // ---- AI players talk: at the start, when they knock someone out or get knocked out, after games, and back to people
  function say(room, pid, event, about) {
    const u = room.ai && room.ai.get(pid); if (!u) return;
    const a = u.career.ai, now = Date.now();
    room.aiTalk = room.aiTalk || {};
    if (now - (room.aiTalk[pid] || 0) < (event === 'reply' ? 3000 : 7000)) return; // nobody spams
    // how likely they are to say something: their chattiness, and how much the moment calls for it (people saying hi usually get an answer)
    const chance = event === 'reply' ? 0.3 + 0.65 * (a.chat || 0.3) : (a.chat || 0.3) * (chat.WEIGHT[event] || 0.3);
    if (Math.random() > chance) return;
    let text = chat.line(a.tone, event, about);
    for (let i = 0; i < 4 && text && text === room.aiLast; i++) text = chat.line(a.tone, event, about); // no echoing each other
    if (!text || text === room.aiLast) return;
    room.aiLast = text;
    room.aiTalk[pid] = now;
    setTimeout(() => {
      if (!rooms.has(room.code)) return;
      const p = room.world.players.find(q => q.id === pid);
      broadcast(room, { t: 'chat', n: u.name, tm: p ? p.team : 'spec', c: p ? p.color : null, m: text, ai: 1 });
    }, 700 + Math.random() * 2200);
  }
  function aiEvents(room, evs) {
    if (!room.ai || !room.ai.size) return;
    const w = room.world, nameOf = id => { const p = w.players.find(q => q.id === id); return p ? p.name : ''; };
    for (const e of evs) {
      if (e.e === 'phase' && e.ph === 'play' && e.rd === 1 && e.gm === 1) for (const pid of room.ai.keys()) say(room, pid, 'start');
      else if (e.e === 'kill') {
        if (e.k && room.ai.has(e.k)) say(room, e.k, ['pit', 'lava', 'water', 'spikes', 'saw', 'burn'].includes(e.c) ? 'ring' : 'kill', e.vn);
        if (room.ai.has(e.v)) say(room, e.v, 'died', e.kn);
      } else if (e.e === 'gameEnd' && e.rw && e.rw !== 'draw' && !e.rwon) {
        for (const pid of room.ai.keys()) { const p = w.players.find(q => q.id === pid); if (p && Math.random() < 0.5) say(room, pid, p.team === e.rw ? 'gameWin' : 'gameLose'); }
      } else if (e.e === 'matchEnd') {
        for (const pid of room.ai.keys()) { const p = w.players.find(q => q.id === pid); if (p) { room.aiTalk[pid] = 0; say(room, pid, p.team === e.mw ? 'matchWin' : 'matchLose'); } }
      }
    }
  }
  function aiReply(room, text) {
    if (!room.ai || !room.ai.size || !/\b(gg|gl|hf|hi|hey|hello|yo|wp|glhf)\b/i.test(text)) return;
    const ids = [...room.ai.keys()].sort(() => Math.random() - 0.5);
    for (const pid of ids.slice(0, 2)) say(room, pid, 'reply');
  }
  function freeAI(room) { if (room.ai) for (const u of room.ai.values()) aiBusy.delete(u.id); }

  // ---- telling people what's going on
  function friendsOf(u) {
    const s = soc(u);
    const list = id => { const f = ctx.live.get(id); return f ? { id, name: f.name, online: online(id), inGame: inGame(id), lv: levelOf(f.career).lv, elo: eloOfUser(f), cc: flagOf(f) } : null; };
    return { friends: s.friends.map(list).filter(Boolean), inReq: s.inReq.map(list).filter(Boolean), outReq: s.outReq.map(list).filter(Boolean) };
  }
  function partyView(key) {
    const pid = partyOf.get(key), p = pid && parties.get(pid);
    if (!p) return null;
    return { id: p.id, leader: p.leader, you: key, mode: p.mode, queued: p.queued != null ? p.queued : null, fill: FILL_AFTER,
      members: p.members.map(profileOf) };
  }
  function pushState(key) {
    const ws = conns.get(key); if (!ws) return;
    send(ws, Object.assign({ t: 'social', you: key, account: !!ws.user, me: profileOf(key), party: partyView(key) }, ws.user ? friendsOf(ws.user) : { friends: [], inReq: [], outReq: [] }));
  }
  function pushFriendsOf(u) { for (const id of soc(u).friends) if (online(id)) pushState('u' + id); }
  function pushParty(p) { for (const k of p.members) pushState(k); }

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
    p.queued = null;
    if (!p.members.length) { parties.delete(p.id); return; }
    if (p.leader === key) p.leader = p.members[0];
    pushParty(p);
  }

  // ---- matchmaking
  function tick() {
    for (const p of parties.values()) if (p.queued != null) p.queued++;
    for (const [mode, n] of Object.entries(MODES)) {
      const queue = [...parties.values()].filter(p => p.queued != null && p.mode === mode && p.members.every(k => conns.has(k))).sort((a, b) => b.queued - a.queued);
      while (queue.length) {
        const head = queue[0];
        const avg = p => p.members.reduce((s, k) => s + eloOfKey(k), 0) / p.members.length;
        const win = p => Math.min(700, 120 + 30 * p.queued); // how far apart ratings may be; widens while waiting
        const pool = queue.filter(p => Math.abs(avg(p) - avg(head)) <= Math.max(win(head), win(p)));
        // fill two teams of n, keeping parties together, balancing ratings
        const teams = { red: [], blue: [] }, used = [];
        for (const p of pool) {
          const opts = ['red', 'blue'].filter(t => teams[t].length + p.members.length <= n);
          if (!opts.length) continue;
          const sum = t => teams[t].reduce((s, k) => s + eloOfKey(k), 0);
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
    const map = Sim.MAP_KEYS[Math.floor(Math.random() * Sim.MAP_KEYS.length)];
    const room = createRoom({ map, diff: 'normal' });
    room.pub = false; room.name = `Ranked ${mode}`; room.ranked = { mode, until: Date.now() + JOIN_WAIT * 1000, expect: new Set() };
    room.ai = new Map(); room.host = null; room.max = 2 * n + 4;
    // AI players for the empty places, as close as possible to the rating everyone else has
    for (const team of ['red', 'blue']) {
      while (teams[team].length < n) {
        const cand = aiUsers.filter(u => !aiBusy.has(u.id)).sort((a, b) => Math.abs(eloOfUser(a) - target) - Math.abs(eloOfUser(b) - target));
        const pickFrom = cand.slice(0, 4), u = pickFrom[Math.floor(Math.random() * pickFrom.length)];
        if (!u || !seatAI(room, team, u)) { const b = Sim.addBot(room.world, team); if (b) b.diff = 'hard'; }
        teams[team].push('ai');
      }
    }
    for (const p of used) {
      p.queued = null;
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
    Sim.startMatch(w);
    sysChat(room, `Ranked ${room.ranked.mode} on ${Sim.MAPS[w.cfg.map].name}. Good luck!`);
    sendRoom(room);
  }
  setInterval(() => {
    for (const room of rooms.values()) if (room.ranked && !room.ranked.started && Date.now() > room.ranked.until) begin(room);
    for (const [t, tk] of tickets) if (tk.until < Date.now()) tickets.delete(t);
  }, 1000).unref();

  // ---- messages
  async function handle(ws, m) {
    const key = ws.user || ws.social ? keyOf(ws) : null;
    switch (m.t) {
      case 'hello': {
        ws.social = true; ws.gname = String(m.name || '').slice(0, 16) || 'Guest';
        if (!ws.user && m.gt && ctx.loadGuest) ws.guest = await ctx.loadGuest(m.gt, ws.gname);
        if (Sim.ELEMENTS[m.el]) ws.mmEl = m.el; if (Sim.ROLES[m.ro]) ws.mmRo = m.ro;
        const k = keyOf(ws), old = conns.get(k);
        if (old && old !== ws) { old.social = false; send(old, { t: 'note', msg: 'Signed in somewhere else.' }); }
        conns.set(k, ws);
        if (ws.user) { const s = soc(ws.user); await loadUsers(s.friends.concat(s.inReq, s.outReq)); pushFriendsOf(ws.user); }
        pushState(k);
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
            if (online(other.id)) { pushState('u' + other.id); send(conns.get('u' + other.id), { t: 'note', msg: `${me.name} sent you a friend request.` }); }
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
        else if (m.op === 'remove') { drop(S.friends, id); drop(O.friends, me.id); }
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
        } else if (m.op === 'leave') { leaveParty(key); pushState(key); }
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
      case 'queue': {
        if (!key || !conns.has(key)) return true;
        const p = ensureParty(key);
        if (p.leader !== key) { send(ws, { t: 'note', msg: 'The party leader starts the search.' }); return true; }
        if (m.op === 'start') {
          if (MODES[m.mode] && p.members.length <= MODES[m.mode]) p.mode = m.mode;
          if (p.members.length > MODES[p.mode]) { send(ws, { t: 'note', msg: 'Too many in your party for that mode.' }); return true; }
          p.queued = 0;
        } else p.queued = null;
        pushParty(p);
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
  return { handle, gone, initAI, useTicket, arrived, freeAI, aiEvents, aiReply, isAI: u => !!(u && u.career && u.career.ai), MODES, FILL_AFTER, _tick: tick, _ai: () => aiUsers };
};
