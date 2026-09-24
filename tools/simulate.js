// Plays bot-only matches as fast as possible and appends them to the balance data file.
// Usage: node tools/simulate.js [matches=10] [team size=2]
// Rows are tagged src "sim", so the Balance data screen can show or hide them.
'use strict';
const fs = require('fs');
const path = require('path');
const Sim = require('../public/sim.js');

const MATCHES = Math.max(1, parseInt(process.argv[2], 10) || 10);
const SIZE = Math.min(Sim.MAX_TEAM, Math.max(1, parseInt(process.argv[3], 10) || 2));
const FILE = process.env.BOWFALL_DATA || path.join(__dirname, '..', 'data', 'games.jsonl');
fs.mkdirSync(path.dirname(FILE), { recursive: true });

let games = 0;
for (let m = 0; m < MATCHES; m++) {
  const map = Sim.MAP_KEYS[m % Sim.MAP_KEYS.length];
  const w = Sim.createWorld({ map, diff: 'hard' });
  for (let i = 0; i < SIZE; i++) { Sim.addBot(w, 'red'); Sim.addBot(w, 'blue'); }
  // bots take roles their team lacks; give them random elements so every element gets played
  for (const p of w.players) { const els = Object.keys(Sim.ELEMENTS); p.element = els[Math.floor(Math.random() * els.length)]; }
  Sim.startMatch(w);
  const out = [];
  for (let t = 0; t < 60 * 60 * 40 && w.match.ph !== 'over'; t++) {
    Sim.step(w, 1 / 60);
    w.events.length = 0;
    for (const r of w.records.splice(0)) { out.push(JSON.stringify(Object.assign({ src: 'sim', humans: 0 }, r))); if (r.type === 'game') games++; }
  }
  fs.appendFileSync(FILE, out.join('\n') + '\n');
  process.stdout.write(`match ${m + 1}/${MATCHES} on ${Sim.MAPS[map].name}: ${w.match.mw || 'unfinished'} wins\n`);
}
console.log(`Recorded ${games} games to ${FILE}`);
