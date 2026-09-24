// Bowfall PvP server: serves the game and runs each room's match authoritatively.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const Sim = require('./public/sim.js');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const TICK = 1 / 60;          // simulation step
const SNAP_EVERY = 2;         // send a snapshot every 2 ticks (30 per second)
const MAX_ROOMS = 50;
// every finished game is appended here (one JSON object per line) for balance stats
const DATA_FILE = process.env.BOWFALL_DATA || path.join(__dirname, 'data', 'games.jsonl');
fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
function saveRecords(room) {
  const recs = room.world.records.splice(0);
  if (!recs.length) return;
  const humans = room.world.players.filter(p => !p.bot).length;
  const lines = recs.map(r => JSON.stringify(Object.assign({ src: 'online', room: room.code, humans }, r))).join('\n') + '\n';
  fs.appendFile(DATA_FILE, lines, err => { if (err) console.error('Could not save game stats:', err.message); });
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/health') { res.writeHead(200); return res.end('ok'); }
  if (url.pathname === '/api/balance') {
    // the recorded games, for the in-game Balance data screen
    return fs.readFile(DATA_FILE, 'utf8', (err, text) => {
      const recs = [];
      if (!err) for (const line of text.split('\n')) { if (!line.trim()) continue; try { recs.push(JSON.parse(line)); } catch (e) { /* skip a half-written line */ } }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ records: recs }));
    });
  }
  let file = path.normalize(path.join(PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

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

function createRoom(opts = {}) {
  const code = makeCode();
  const diff = Sim.DIFF[opts.diff] ? opts.diff : 'normal';
  const map = Sim.MAPS[opts.map] ? opts.map : 'meadow';
  const room = { code, clients: new Set(), host: null, tick: 0, world: Sim.createWorld({ diff, map }) };
  rooms.set(code, room);
  return room;
}

function roomInfo(room) {
  return { t: 'room', code: room.code, host: room.host };
}
function broadcast(room, obj) { const s = JSON.stringify(obj); for (const c of room.clients) if (c.readyState === 1) c.send(s); }

function leave(ws) {
  const room = ws.room;
  if (!room) return;
  room.clients.delete(ws);
  Sim.leave(room.world, ws.pid);
  if (room.host === ws.pid) room.host = [...room.clients][0]?.pid || null;
  ws.room = null;
  if (!room.clients.size) rooms.delete(room.code);
  else broadcast(room, roomInfo(room));
}

wss.on('connection', ws => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;

    if (m.t === 'join') {
      if (ws.room) leave(ws);
      let room;
      if (m.create) {
        if (rooms.size >= MAX_ROOMS) return send(ws, { t: 'err', msg: 'The server is full. Try again later.' });
        room = createRoom({ diff: m.diff, map: m.map });
      } else {
        room = rooms.get(String(m.code || '').toUpperCase().trim());
        if (!room) return send(ws, { t: 'err', msg: 'No room with that code. Check it and try again.' });
      }
      const p = Sim.join(room.world, { name: cleanName(m.name), element: String(m.el || ''), role: String(m.ro || '') });
      if (!p) {
        if (!room.clients.size) rooms.delete(room.code);
        return send(ws, { t: 'err', msg: 'That room is full (8 people).' });
      }
      ws.room = room; ws.pid = p.id;
      room.clients.add(ws);
      if (!room.host) room.host = p.id;
      send(ws, { t: 'welcome', id: p.id, code: room.code });
      broadcast(room, roomInfo(room));
      return;
    }

    const room = ws.room;
    if (!room) return;
    const w = room.world, isHost = room.host === ws.pid;
    switch (m.t) {
      case 'in': Sim.setInput(w, ws.pid, m); break;
      case 'ping': send(ws, { t: 'pong', c: m.c }); break;
      case 'loadout': Sim.setLoadout(w, ws.pid, String(m.el), String(m.ro)); break;
      case 'title': Sim.setTitle(w, ws.pid, m.v ? String(m.v) : null); break;
      case 'choose': Sim.choose(w, ws.pid, m.i | 0); break;
      case 'team': Sim.setTeam(w, ws.pid, String(m.team)); break;
      // host-only controls
      case 'bot':
        if (!isHost) break;
        if (m.op === 'add') Sim.addBot(w, String(m.team));
        if (m.op === 'remove') Sim.removeBot(w, String(m.id));
        break;
      case 'cfg':
        if (!isHost) break;
        if (m.diff) Sim.setBotDifficulty(w, String(m.diff));
        if (m.map) Sim.setMap(w, String(m.map));
        if (m.ptw) Sim.setPointsToWin(w, m.ptw | 0);
        if (m.opt && typeof m.opt === 'object') for (const [k, v] of Object.entries(m.opt)) Sim.setOption(w, String(k), String(v));
        break;
      case 'hcap': if (isHost) Sim.setHandicap(w, String(m.id), m.v | 0); break;
      case 'start': if (isHost) Sim.startMatch(w); break;
      case 'lobby': if (isHost) Sim.toLobby(w); break;
      case 'restart': if (isHost && w.match.ph === 'over') Sim.resetMatch(w); break;
    }
  });
  ws.on('close', () => leave(ws));
  ws.on('error', () => leave(ws));
});

// drop dead connections
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false; ws.ping();
  }
}, 10000);

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
      if (room.world.records.length) saveRecords(room);
      room.tick++;
      if (room.tick % SNAP_EVERY === 0) {
        const msg = JSON.stringify({ t: 'snap', s: Sim.snapshot(room.world), ev: room.world.events.splice(0) });
        for (const c of room.clients) if (c.readyState === 1) c.send(msg);
      }
    }
  }
}, 5);

server.listen(PORT, () => console.log(`Bowfall server running on http://localhost:${PORT}`));
