#!/usr/bin/env node
// Builds lib/ai-meta.json, the arena knowledge matchmaking's AI players pick and play by, from simulated matches between
// Master-level bots:
//   roles    every archetype against every other, on every arena in the rotation: how each does on each arena, and each
//            matchup on each arena (vsMap), with the bots drafting as they usually do
//   plays    each archetype trying each play that fits it (close the gap, keep them off, hold the spring, hunt the drops)
//            against each other archetype on each arena: which plays win which matchups where
//   cards    the same matchups with upgrades picked at random, so each card's worth can be read off the results: which
//            cards work on which arena, and against which archetype
//   effects  every archetype against every other under each map effect; els/effels: every element against every other
//            (on a ranger) on the ranked arenas and under each effect
// A fit is a game win rate against the field, less a half: +0.10 means that archetype won 60% of its games there.
//
//   node tools/arena-fit.js run [matches]    simulate (a few hours: thousands of matchups, two at a time) into tools/fit-out/
//   node tools/arena-fit.js run roles,plays  just those parts (roles, plays, cards, effects, els, effels)
//   node tools/arena-fit.js build            read tools/fit-out/*.jsonl and write lib/ai-meta.json
'use strict';
const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const S = require('../public/sim.js');
const OUT = path.join(__dirname, 'fit-out'), META = path.join(__dirname, '..', 'lib', 'ai-meta.json');
const ROLES = ['frost,sniper', 'stone,juggernaut', 'frost,ranger', 'storm,trickster', 'flame,warden', 'poison,trapper', 'shadow,assassin', 'shadow,ninja', 'void,crossbow'];
const ELS = ['frost', 'flame', 'storm', 'poison', 'stone', 'void', 'shadow', 'blood'];
const maps = () => S.rankedPool();
const parse = s => { const [el, ro, play] = s.split(','); return { el, ro, play: play || null }; };

// one matchup: two Master bots, sides alternating, N matches → game and match wins (and, with random picks, each side's cards per game won or lost)
function duel(map, effect, A, B, N, rand) {
  const a = parse(A), b = parse(B);
  const mw = [0, 0], gw = [0, 0], cards = {};
  const noteCards = (p, side, won) => { for (const id of p.up) { if (id === p.element) continue; const c = cards[side] || (cards[side] = {}), r = c[id] || (c[id] = [0, 0]); r[won ? 0 : 1]++; } };
  for (let m = 0; m < N; m++) {
    const w = S.createWorld({ map, opt: { effect: effect || 'none' } }), swap = m % 2 === 1;
    const pa = S.addBot(w, swap ? 'blue' : 'red'), pb = S.addBot(w, swap ? 'red' : 'blue');
    for (const [p, c] of [[pa, a], [pb, b]]) { p.dparams = S.skillParams(0.9); S.setLoadout(w, p.id, c.el, c.ro); S.setBotMind(w, p.id, { aggr: 0.6, tr: { cover: 0.5, edge: 0.4, dash: 0.6, charge: 0.3 }, gene: rand ? { randPick: true } : null, plays: c.play ? [c.play] : null }); }
    S.startMatch(w);
    for (let i = 0; i < 60 * 60 * 25 && w.match.ph !== 'over'; i++) {
      S.step(w, 1 / 60);
      for (const e of w.events) if (e.e === 'gameEnd' && e.rw && e.rw !== 'draw') { gw[e.rw === pa.team ? 0 : 1]++; if (rand) { noteCards(pa, 'A', e.rw === pa.team); noteCards(pb, 'B', e.rw === pb.team); } }
      w.events.length = 0;
    }
    if (w.match.mw) mw[w.match.mw === pa.team ? 0 : 1]++;
  }
  return Object.assign({ map, effect, A, B, mw, gw }, rand ? { cards } : {});
}
function pairs(list) { const out = []; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) out.push([list[i], list[j]]); return out; }
// the plays worth trying for an archetype against another on an arena (the ones that fit, by the plays' own rules)
function playsFor(map, A, B) {
  const w = S.createWorld({ map, opt: { effect: 'none' } }), a = parse(A), b = parse(B);
  const pa = S.addBot(w, 'red'), pb = S.addBot(w, 'blue'); S.setLoadout(w, pa.id, a.el, a.ro); S.setLoadout(w, pb.id, b.el, b.ro);
  const sense = S.arenaSense(map);
  return Object.keys(S.PLAYS).filter(k => S.PLAYS[k].fits(sense, pa, [pb]));
}
function jobs(parts) {
  const J = [], want = k => !parts || parts.includes(k);
  if (want('roles')) for (const m of maps()) for (const [a, b] of pairs(ROLES)) J.push(['roles', m, 'none', a, b]);
  if (want('plays')) for (const m of maps()) for (const a of ROLES) for (const b of ROLES) if (a !== b) for (const k of playsFor(m, a, b)) J.push(['plays', m, 'none', a + ',' + k, b]);
  if (want('cards')) for (const m of maps()) for (const [a, b] of pairs(ROLES)) J.push(['cards', m, 'none', a, b]);
  if (want('effects')) for (const f of Object.keys(S.MUTATORS)) for (const [a, b] of pairs(ROLES)) J.push(['effects', 'meadow', f, a, b]);
  if (want('els')) for (const m of maps().slice(0, 5)) for (const [a, b] of pairs(ELS)) J.push(['els', m, 'none', a + ',ranger', b + ',ranger']);
  if (want('effels')) for (const f of Object.keys(S.MUTATORS)) for (const [a, b] of pairs(ELS)) J.push(['effels', 'meadow', f, a + ',ranger', b + ',ranger']);
  return J;
}
async function run(N, parts) {
  fs.mkdirSync(OUT, { recursive: true });
  const J = jobs(parts); let i = 0; const t0 = Date.now();
  for (const k of new Set(J.map(j => j[0]))) fs.writeFileSync(path.join(OUT, k + '.jsonl'), '');
  console.log(`${J.length} matchups`);
  const worker = () => new Promise(res => { const next = () => { if (i >= J.length) return res(); const [kind, ...args] = J[i++];
    const n = kind === 'roles' || kind === 'cards' ? N : Math.max(2, Math.round(N * 2 / 3));
    const ch = spawn(process.execPath, [__filename, 'one', kind, ...args, String(n)], { stdio: ['ignore', 'pipe', 'inherit'] });
    let out = ''; ch.stdout.on('data', d => out += d); ch.on('close', () => { if (out.trim()) fs.appendFileSync(path.join(OUT, kind + '.jsonl'), out.trim() + '\n'); if (i % 50 === 0) console.log(`${i}/${J.length}, ${Math.round((Date.now() - t0) / 60000)} min`); next(); }); }; next(); });
  await Promise.all([worker(), worker()]);
  fs.writeFileSync(path.join(OUT, 'DONE'), new Date().toISOString());
  console.log('done');
}
function build() {
  const read = k => { try { return fs.readFileSync(path.join(OUT, k + '.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch (e) { return []; } };
  const role = s => s.split(',')[1], el = s => s.split(',')[0], play = s => s.split(',')[2] || null, r3 = x => Math.round(x * 1000) / 1000;
  const rate = ([w, l]) => (w + l ? w / (w + l) : 0.5);
  // fit: each side's games for and against, per key
  const tally = (rows, keyOf, nameOf) => { const T = {}; for (const r of rows) { const k = keyOf(r), t = T[k] || (T[k] = {}), [a, b] = [nameOf(r.A), nameOf(r.B)]; (t[a] = t[a] || [0, 0]); (t[b] = t[b] || [0, 0]); t[a][0] += r.gw[0]; t[a][1] += r.gw[1]; t[b][0] += r.gw[1]; t[b][1] += r.gw[0]; }
    const F = {}; for (const k in T) { F[k] = {}; for (const n in T[k]) F[k][n] = r3(rate(T[k][n]) - 0.5); } return F; };
  const roles = read('roles'), plays = read('plays'), cards = read('cards'), effects = read('effects'), els = read('els'), effels = read('effels');
  const meta = { v: 2, built: new Date().toISOString().slice(0, 10), games: [roles, plays, cards, effects, els, effels].flat().reduce((t, r) => t + r.gw[0] + r.gw[1], 0),
    roles: tally(roles, r => r.map, role), effects: tally(effects, r => r.effect, role), els: tally(els, r => r.map, el), effels: tally(effels, r => r.effect, el), vs: {}, vsMap: {}, plays: {}, cardMap: {}, cardVs: {} };
  const rawMeadow = Object.assign({}, meta.roles.meadow || {}), rawMeadowE = Object.assign({}, meta.els.meadow || {});
  // role against role: over every arena (vs), and on each arena (vsMap), as a win rate
  const V = {}, VM = {}, add = (o, a, b, w, l) => { const r = ((o[a] = o[a] || {})[b] = o[a][b] || [0, 0]); r[0] += w; r[1] += l; };
  for (const r of roles) { const a = role(r.A), b = role(r.B); add(V, a, b, r.gw[0], r.gw[1]); add(V, b, a, r.gw[1], r.gw[0]); VM[r.map] = VM[r.map] || {}; add(VM[r.map], a, b, r.gw[0], r.gw[1]); add(VM[r.map], b, a, r.gw[1], r.gw[0]); }
  for (const a in V) { meta.vs[a] = {}; for (const b in V[a]) meta.vs[a][b] = r3(rate(V[a][b]) - 0.5); }
  for (const m in VM) { meta.vsMap[m] = {}; for (const a in VM[m]) { meta.vsMap[m][a] = {}; for (const b in VM[m][a]) meta.vsMap[m][a][b] = r3(rate(VM[m][a][b])); } }
  // plays: A with a play against B on an arena, as a win rate (to set against vsMap, A plain against B)
  const PA = {};
  for (const r of plays) { const m = r.map, a = role(r.A), b = role(r.B), k = play(r.A); if (!k) continue; const P = ((meta.plays[m] = meta.plays[m] || {})[a] = meta.plays[m][a] || {}); (P[b] = P[b] || {})[k] = r3(rate(r.gw)); const Q = ((PA[a] = PA[a] || {})[b] = PA[a][b] || {}); const rec = Q[k] || (Q[k] = [0, 0]); rec[0] += r.gw[0]; rec[1] += r.gw[1]; }
  // and over every arena (a steadier number: each arena's own figure is from few games), as a win rate
  meta.playsAll = {}; for (const a in PA) { meta.playsAll[a] = {}; for (const b in PA[a]) { meta.playsAll[a][b] = {}; for (const k in PA[a][b]) meta.playsAll[a][b][k] = r3(rate(PA[a][b][k])); } }
  // cards: a card's worth on an arena, and against an archetype: the win rate of games where it was held, less the holder's
  // archetype's win rate in the same games overall (so a sniper's card isn't blamed for the sniper)
  const CM = {}, CV = {}, RB = {}, RVB = {};
  for (const r of cards) {
    for (const [side, other] of [['A', 'B'], ['B', 'A']]) {
      const me = role(r[side]), foe = role(r[other]), won = side === 'A' ? r.gw[0] : r.gw[1], lost = side === 'A' ? r.gw[1] : r.gw[0];
      add(RB, r.map, me, won, lost); add(RVB, foe, me, won, lost);
      for (const id in (r.cards && r.cards[side]) || {}) { const [w, l] = r.cards[side][id]; add(CM, r.map, id, w, l); add(CV, foe, id, w, l); (CM[r.map]['_' + id + '@' + me] = CM[r.map]['_' + id + '@' + me] || [0, 0]); CM[r.map]['_' + id + '@' + me][0] += w; CM[r.map]['_' + id + '@' + me][1] += l; (CV[foe]['_' + id + '@' + me] = CV[foe]['_' + id + '@' + me] || [0, 0]); CV[foe]['_' + id + '@' + me][0] += w; CV[foe]['_' + id + '@' + me][1] += l; }
    }
  }
  // (the correction: for each card, the holders' roles' baseline, weighted by how often each role held it)
  const corrected = (C, B) => { const out = {}; for (const k in C) { out[k] = {}; for (const id in C[k]) { if (id[0] === '_') continue; const rec = C[k][id], n = rec[0] + rec[1]; if (n < 60) continue;
    let base = 0, bn = 0; for (const kk in C[k]) if (kk.startsWith('_' + id + '@')) { const ro = kk.split('@')[1], nn = C[k][kk][0] + C[k][kk][1]; base += rate(B[k][ro] || [0, 0]) * nn; bn += nn; }
    out[k][id] = r3(rate(rec) - (bn ? base / bn : 0.5)); } } return out; };
  meta.cardMap = corrected(CM, RB); meta.cardVs = corrected(CV, RVB);
  // what matters for picking an arena is how an archetype does *there* against how it does everywhere: an archetype that bots find
  // strong on every arena (or weak on every one) would otherwise swamp the arena's own say. A third of the overall strength stays in.
  const mean = {}; for (const k in meta.roles) for (const ro in meta.roles[k]) (mean[ro] = mean[ro] || []).push(meta.roles[k][ro]);
  meta.base = {}; for (const ro in mean) meta.base[ro] = r3(mean[ro].reduce((t, x) => t + x, 0) / mean[ro].length);
  for (const k in meta.roles) for (const ro in meta.roles[k]) meta.roles[k][ro] = r3(meta.roles[k][ro] - meta.base[ro] * 0.65);
  const meanE = {}; for (const k in meta.els) for (const e in meta.els[k]) (meanE[e] = meanE[e] || []).push(meta.els[k][e]);
  meta.baseEl = {}; for (const e in meanE) meta.baseEl[e] = r3(meanE[e].reduce((t, x) => t + x, 0) / meanE[e].length);
  for (const k in meta.els) for (const e in meta.els[k]) meta.els[k][e] = r3(meta.els[k][e] - meta.baseEl[e] * 0.65);
  // the effects' fits are measured against the plain arena, so what the arena itself favours comes off
  for (const f in meta.effects) for (const ro in meta.effects[f]) meta.effects[f][ro] = r3(meta.effects[f][ro] - (rawMeadow[ro] || 0));
  for (const f in meta.effels) for (const e in meta.effels[f]) meta.effels[f][e] = r3(meta.effels[f][e] - (rawMeadowE[e] || 0));
  // and each arena's own profile, so an arena that wasn't simulated (a player-made one in the rotation) can borrow the nearest one's table
  meta.sense = {}; for (const k of Object.keys(meta.roles)) { const a = S.arenaSense(k); if (a) meta.sense[k] = { open: r3(a.open), holes: r3(a.holes), big: r3(a.big), hold: a.hold ? 1 : 0, island: a.island ? 1 : 0 }; }
  fs.writeFileSync(META, JSON.stringify(meta));
  console.log(`wrote ${META}: ${Object.keys(meta.roles).length} arenas, ${Object.keys(meta.effects).length} effects, ${Object.keys(meta.plays).length} arenas of plays, ${Object.keys(meta.cardMap).length} arenas of cards, ${meta.games} games`);
}
const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'one') { const [kind, map, effect, A, B, N] = rest; console.log(JSON.stringify(duel(map, effect, A, B, +N || 6, kind === 'cards'))); }
else if (cmd === 'run') { const parts = (rest.find(x => /^[a-z,]+$/.test(x)) || '').split(',').filter(Boolean); run(+rest.find(x => /^\d+$/.test(x)) || 6, parts.length ? parts : null); }
else if (cmd === 'build') build();
else console.log('node tools/arena-fit.js run [matches] [roles,plays,cards,effects,els,effels] | build');
