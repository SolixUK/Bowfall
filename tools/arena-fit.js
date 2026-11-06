#!/usr/bin/env node
// Builds lib/ai-meta.json, the arena knowledge matchmaking's AI players pick their archetypes by, from simulated matches
// between Master-level bots: every role against every other on every arena, every element against every other (on a
// ranger) on the ranked arenas, and every role against every other under each map effect. A fit is a game win rate
// against the field, less a half: +0.10 means that archetype won 60% of its games there.
//
//   node tools/arena-fit.js run [matches]    simulate (hours: 1,500 matchups, two at a time) into tools/fit-out/
//   node tools/arena-fit.js build            read tools/fit-out/*.jsonl and write lib/ai-meta.json
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync, spawn } = require('child_process');
const S = require('../public/sim.js');
const OUT = path.join(__dirname, 'fit-out'), META = path.join(__dirname, '..', 'lib', 'ai-meta.json');
const ROLES = ['frost,sniper', 'stone,juggernaut', 'frost,ranger', 'storm,trickster', 'flame,warden', 'poison,trapper', 'shadow,assassin', 'shadow,ninja', 'void,crossbow'];
const ELS = ['frost', 'flame', 'storm', 'poison', 'stone', 'void', 'shadow', 'blood'];
const maps = () => S.rankedPool().concat(S.LAB_KEYS().filter(k => !S.rankedPool().includes(k)));

// one matchup: two Master bots, sides alternating, N matches → game and match wins
function duel(map, effect, A, B, N) {
  const parse = s => { const [el, ro] = s.split(','); return { el, ro }; }, a = parse(A), b = parse(B);
  const mw = [0, 0], gw = [0, 0];
  for (let m = 0; m < N; m++) {
    const w = S.createWorld({ map, opt: { effect: effect || 'none' } }), swap = m % 2 === 1;
    const pa = S.addBot(w, swap ? 'blue' : 'red'), pb = S.addBot(w, swap ? 'red' : 'blue');
    for (const [p, c] of [[pa, a], [pb, b]]) { p.dparams = S.skillParams(0.9); S.setLoadout(w, p.id, c.el, c.ro); S.setBotMind(w, p.id, { aggr: 0.6, tr: { cover: 0.5, edge: 0.4, dash: 0.6, charge: 0.3 } }); }
    S.startMatch(w);
    for (let i = 0; i < 60 * 60 * 25 && w.match.ph !== 'over'; i++) {
      S.step(w, 1 / 60);
      for (const e of w.events) if (e.e === 'gameEnd' && e.rw && e.rw !== 'draw') gw[e.rw === pa.team ? 0 : 1]++;
      w.events.length = 0;
    }
    if (w.match.mw) mw[w.match.mw === pa.team ? 0 : 1]++;
  }
  return { map, effect, A, B, mw, gw };
}
function pairs(list) { const out = []; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) out.push([list[i], list[j]]); return out; }
function jobs() {
  const J = [];
  for (const m of maps()) for (const [a, b] of pairs(ROLES)) J.push(['roles', m, 'none', a, b]);
  for (const f of Object.keys(S.MUTATORS)) for (const [a, b] of pairs(ROLES)) J.push(['effects', 'meadow', f, a, b]);
  for (const m of maps().slice(0, 10)) for (const [a, b] of pairs(ELS)) J.push(['els', m, 'none', a + ',ranger', b + ',ranger']);
  for (const f of Object.keys(S.MUTATORS)) for (const [a, b] of pairs(ELS)) J.push(['effels', 'meadow', f, a + ',ranger', b + ',ranger']);
  return J;
}
async function run(N) {
  fs.mkdirSync(OUT, { recursive: true });
  const J = jobs(); let i = 0, t0 = Date.now();
  const worker = () => new Promise(res => { const next = () => { if (i >= J.length) return res(); const [kind, ...args] = J[i++];
    const ch = spawn(process.execPath, [__filename, 'one', kind, ...args, String(N)], { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = ''; ch.stdout.on('data', d => out += d); ch.on('close', () => { if (out.trim()) fs.appendFileSync(path.join(OUT, kind + '.jsonl'), out.trim() + '\n'); if (i % 50 === 0) console.log(`${i}/${J.length}, ${Math.round((Date.now() - t0) / 60000)} min`); next(); }); }; next(); });
  await Promise.all([worker(), worker()]);
  console.log('done');
}
function build() {
  const read = k => { try { return fs.readFileSync(path.join(OUT, k + '.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch (e) { return []; } };
  const role = s => s.split(',')[1], el = s => s.split(',')[0], r3 = x => Math.round(x * 1000) / 1000;
  // fit: each side's games for and against, per key
  const tally = (rows, keyOf, nameOf) => { const T = {}; for (const r of rows) { const k = keyOf(r), t = T[k] || (T[k] = {}), [a, b] = [nameOf(r.A), nameOf(r.B)]; (t[a] = t[a] || [0, 0]); (t[b] = t[b] || [0, 0]); t[a][0] += r.gw[0]; t[a][1] += r.gw[1]; t[b][0] += r.gw[1]; t[b][1] += r.gw[0]; } 
    const F = {}; for (const k in T) { F[k] = {}; for (const n in T[k]) { const [w, l] = T[k][n]; F[k][n] = w + l ? r3(w / (w + l) - 0.5) : 0; } } return F; };
  const roles = read('roles'), effects = read('effects'), els = read('els'), effels = read('effels');
  const meta = { v: 1, built: new Date().toISOString().slice(0, 10), games: [roles, effects, els, effels].flat().reduce((t, r) => t + r.gw[0] + r.gw[1], 0),
    roles: tally(roles, r => r.map, role), effects: tally(effects, r => r.effect, role), els: tally(els, r => r.map, el), effels: tally(effels, r => r.effect, el), vs: {} };
  // role against role, over every arena (for counter-picks once the other side has shown its hand)
  const V = {}; for (const r of roles) { const a = role(r.A), b = role(r.B); (V[a] = V[a] || {})[b] = (V[a][b] || [0, 0]); V[a][b][0] += r.gw[0]; V[a][b][1] += r.gw[1]; (V[b] = V[b] || {})[a] = (V[b][a] || [0, 0]); V[b][a][0] += r.gw[1]; V[b][a][1] += r.gw[0]; }
  for (const a in V) { meta.vs[a] = {}; for (const b in V[a]) { const [w, l] = V[a][b]; meta.vs[a][b] = w + l ? r3(w / (w + l) - 0.5) : 0; } }
  const rawMeadow = Object.assign({}, meta.roles.meadow || {}), rawMeadowE = Object.assign({}, meta.els.meadow || {});
  // what matters for picking an arena is how an archetype does *there* against how it does everywhere: an archetype that bots find
  // strong on every arena (or weak on every one) would otherwise swamp the arena's own say. A third of the overall strength stays in.
  const mean = {}; for (const k in meta.roles) for (const ro in meta.roles[k]) (mean[ro] = mean[ro] || []).push(meta.roles[k][ro]);
  meta.base = {}; for (const ro in mean) meta.base[ro] = r3(mean[ro].reduce((t, x) => t + x, 0) / mean[ro].length);
  for (const k in meta.roles) for (const ro in meta.roles[k]) meta.roles[k][ro] = r3(meta.roles[k][ro] - meta.base[ro] * 0.65);
  const meanE = {}; for (const k in meta.els) for (const e in meta.els[k]) (meanE[e] = meanE[e] || []).push(meta.els[k][e]);
  meta.baseEl = {}; for (const e in meanE) meta.baseEl[e] = r3(meanE[e].reduce((t, x) => t + x, 0) / meanE[e].length);
  for (const k in meta.els) for (const e in meta.els[k]) meta.els[k][e] = r3(meta.els[k][e] - meta.baseEl[e] * 0.65);
  // the effects' fits are measured against the plain arena, so what the arena itself favours comes off
  const plain = rawMeadow; for (const f in meta.effects) for (const ro in meta.effects[f]) meta.effects[f][ro] = r3(meta.effects[f][ro] - (plain[ro] || 0));
  const plainE = rawMeadowE; for (const f in meta.effels) for (const e in meta.effels[f]) meta.effels[f][e] = r3(meta.effels[f][e] - (plainE[e] || 0));
  // and each arena's own profile, so an arena that wasn't simulated (a player-made one in the rotation) can borrow the nearest one's table
  meta.sense = {}; for (const k of Object.keys(meta.roles)) { const a = S.arenaSense(k); if (a) meta.sense[k] = { open: r3(a.open), holes: r3(a.holes), big: r3(a.big), hold: a.hold ? 1 : 0, island: a.island ? 1 : 0 }; }
  fs.writeFileSync(META, JSON.stringify(meta));
  console.log(`wrote ${META}: ${Object.keys(meta.roles).length} arenas, ${Object.keys(meta.effects).length} effects, ${meta.games} games`);
}
const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'one') { const [kind, map, effect, A, B, N] = rest; console.log(JSON.stringify(duel(map, effect, A, B, +N || 6))); }
else if (cmd === 'run') run(+rest[0] || 6);
else if (cmd === 'build') build();
else console.log('node tools/arena-fit.js run [matches] | build');
