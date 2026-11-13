#!/usr/bin/env node
// upgrade-fit: how strong is each upgrade, on its own? Two archers (or, for team-only cards, two pairs) with the same element,
// role, skill and two other upgrades meet on a random ranked arena; the only difference is the third card: one side takes the
// card being tested, the other another card from the same tree (a different one each match, so it's "against the tree's
// average"). Sides swap every other match. Over many matches the gap is the card's worth: 50% is an average card.
//   node tools/upgrade-fit.js cards [N] [id,id]    every card (or the ones named), N matches each → tools/fit-out/upgrades.json
//   node tools/upgrade-fit.js combos [N]           random builds, mirrored: which pairs of cards win together → tools/fit-out/combos.json
//   node tools/upgrade-fit.js report               print both, sorted, with their margins
'use strict';
const fs = require('fs'), path = require('path'), { fork } = require('child_process');
const S = require('../public/sim.js');
const OUT = path.join(__dirname, 'fit-out');
const TEAM_ONLY = ['oath', 'revive', 'transfusion', 'contagion', 'aftershock', 'forked', 'pierce'];
const ELS = Object.keys(S.ELEMENTS), ROS = Object.keys(S.ROLES);
const CARDS = Object.keys(S.TREE).filter(k => !S.TREE[k].base && !S.TREE[k].retired && !S.HONES[k]);
const SK = 0.8;
let seed = 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
const trees = id => S.treesOf(id);
// an archer who could take this card: its element (an element's card) or one of its roles (a role's card)
function host(id) {
  const t = trees(id), els = t.filter(x => ELS.includes(x)), ros = t.filter(x => ROS.includes(x));
  return { el: els.length ? pick(els) : pick(ELS), ro: ros.length ? pick(ros) : pick(ROS) };
}
const choices = (h, have, solo) => S.forcedChoices(h.el, h.ro, have, solo);
// the card's prerequisites first (Deadeye needs Longbow), then other cards up to two, then the card; null if it can't be built
function builds(id, solo) {
  for (let tries = 0; tries < 30; tries++) {
    const h = host(id), base = [];
    for (const r of S.TREE[id].req || []) base.push(r);
    if (S.TREE[id].reqAny) base.push(pick(S.TREE[id].reqAny));
    if (base.some(r => !choices(h, base.filter(x => x !== r), solo).includes(r) && !(S.TREE[r] && S.TREE[r].base))) continue;
    let ok = true;
    while (base.length < 2) { const c = choices(h, base, solo).filter(x => x !== id && !TEAM_ONLY.includes(x)); if (!c.length) { ok = false; break; } base.push(pick(c)); }
    if (!ok || !choices(h, base, solo).includes(id)) continue;
    const alt = choices(h, base, solo).filter(x => x !== id && trees(x).some(t => trees(id).includes(t)));
    const alts = alt.length ? alt : choices(h, base, solo).filter(x => x !== id);
    if (!alts.length) continue;
    return { h, a: base.concat(id), b: base.concat(pick(alts)) };
  }
  return null;
}
function seat(w, team, h, ups) { const b = S.addBot(w, team); S.setLoadout(w, b.id, h.el, h.ro); b.forceUp = ups.slice(); b.dparams = S.facetParams({ aim: SK, pos: SK, dodge: SK, mind: SK }); S.setBotMind(w, b.id, { aggr: 0.6, tr: { cover: 0.4, edge: 0.5, dash: 0.6, charge: 0.3 }, gene: { noLearn: true } }); return b; }
function playOne(map, team, sides) {
  const w = S.createWorld({ map, opt: { effect: 'none' } }); w.cfg.pointsToWin = 1; w.cfg.gamesToWin = 2;
  const ids = { red: [], blue: [] };
  for (const s of sides) for (let i = 0; i < team; i++) ids[s.side].push(seat(w, s.side, s.h, s.ups).id);
  S.startMatch(w);
  const out = { red: { g: 0, k: 0, hz: 0, dmg: 0 }, blue: { g: 0, k: 0, hz: 0, dmg: 0 } };
  for (let i = 0; i < 60 * 60 * 12 && w.match.ph !== 'over'; i++) {
    S.step(w, 1 / 60);
    for (const e of w.events) {
      if (e.e === 'gameEnd' && e.rw && e.rw !== 'draw') out[e.rw].g++;
      if (e.e === 'kill' && e.k) { const s = ids.red.includes(e.k) ? 'red' : ids.blue.includes(e.k) ? 'blue' : null; if (s) { out[s].k++; if (['pit', 'lava', 'water', 'spikes', 'saw', 'burn'].includes(e.c)) out[s].hz++; } }
    }
    w.events.length = 0;
  }
  for (const s of ['red', 'blue']) out[s].dmg = Math.round(w.players.filter(p => ids[s].includes(p.id)).reduce((t, p) => t + p.stats.dmg, 0));
  return out;
}
function cardJob(id, N, s0) {
  seed = s0; const team = TEAM_ONLY.includes(id) ? 2 : 1, T = { g: [0, 0], k: [0, 0], hz: [0, 0], dmg: [0, 0], n: 0, skipped: 0 };
  const pool = S.rankedPool();
  for (let m = 0; m < N; m++) {
    const B = builds(id, team === 1); if (!B) { T.skipped++; continue; }
    const flip = m % 2 === 1, o = playOne(pick(pool), team, [{ side: flip ? 'blue' : 'red', h: B.h, ups: B.a }, { side: flip ? 'red' : 'blue', h: B.h, ups: B.b }]);
    const A = flip ? o.blue : o.red, Bo = flip ? o.red : o.blue;
    T.g[0] += A.g; T.g[1] += Bo.g; T.k[0] += A.k; T.k[1] += Bo.k; T.hz[0] += A.hz; T.hz[1] += Bo.hz; T.dmg[0] += A.dmg; T.dmg[1] += Bo.dmg; T.n++;
  }
  return { id, team, ...T };
}
// combos: both sides the same element and role, each with three cards at random; every pair a side held is credited its games
function comboJob(N, s0) {
  seed = s0; const P = {}, C = {}, pool = S.rankedPool();
  const add = (o, k, w, l) => { const r = o[k] || (o[k] = [0, 0]); r[0] += w; r[1] += l; };
  for (let m = 0; m < N; m++) {
    const h = { el: pick(ELS), ro: pick(ROS) }, mk = () => { const u = []; for (let i = 0; i < 3; i++) { const c = choices(h, u, true).filter(x => !TEAM_ONLY.includes(x)); if (!c.length) break; u.push(pick(c)); } return u; };
    const ua = mk(), ub = mk(), o = playOne(pick(pool), 1, [{ side: 'red', h, ups: ua }, { side: 'blue', h, ups: ub }]);
    for (const [u, me, them] of [[ua, o.red, o.blue], [ub, o.blue, o.red]]) {
      for (const c of u) add(C, h.ro + ':' + c, me.g, them.g);
      for (let i = 0; i < u.length; i++) for (let j = i + 1; j < u.length; j++) add(P, h.ro + ':' + [u[i], u[j]].sort().join('+'), me.g, them.g);
    }
  }
  return { P, C };
}
if (process.argv[2] === 'worker') {
  process.on('message', j => { try { process.send(j.kind === 'card' ? cardJob(j.id, j.n, j.seed) : comboJob(j.n, j.seed)); } catch (e) { process.send({ id: j.id, err: String(e && e.stack || e) }); } });
  return;
}
function pool(jobs, onDone, nw = 2) {
  return new Promise(res => { let i = 0, live = 0; const start = () => { const w = fork(__filename, ['worker']); live++; const next = () => { if (i >= jobs.length) { w.kill(); if (--live === 0) res(); return; } w.send(jobs[i++]); }; w.on('message', r => { onDone(r); next(); }); next(); }; for (let k = 0; k < Math.min(nw, jobs.length); k++) start(); });
}
const rate = (a, b) => (a + b ? a / (a + b) : 0.5), margin = (a, b) => (a + b ? 1.96 * Math.sqrt(rate(a, b) * (1 - rate(a, b)) / (a + b)) : 1);
(async () => {
  const [cmd, a1, a2] = process.argv.slice(2);
  fs.mkdirSync(OUT, { recursive: true });
  if (cmd === 'cards') {
    const N = +a1 || 100, list = a2 ? a2.split(',') : CARDS, file = path.join(OUT, 'upgrades.json');
    const res = fs.existsSync(file) && a2 ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}; let done = 0; const t0 = Date.now();
    await pool(list.map((id, i) => ({ kind: 'card', id, n: N, seed: 1 + i * 7919 })), r => { res[r.id] = r; done++; if (r.err) console.log(r.id, r.err.split('\n')[0]); else console.log(`${done}/${list.length} ${r.id}: ${Math.round(rate(r.g[0], r.g[1]) * 100)}% of ${r.g[0] + r.g[1]} games (±${Math.round(margin(r.g[0], r.g[1]) * 100)}) · ${Math.round((Date.now() - t0) / 1000)}s`); fs.writeFileSync(file, JSON.stringify(res)); });
  } else if (cmd === 'combos') {
    const N = +a1 || 6000, chunks = 40, P = {}, C = {}; let done = 0;
    const merge = (o, src) => { for (const k in src) { const r = o[k] || (o[k] = [0, 0]); r[0] += src[k][0]; r[1] += src[k][1]; } };
    await pool(Array.from({ length: chunks }, (_, i) => ({ kind: 'combo', n: Math.ceil(N / chunks), seed: 101 + i * 104729 })), r => { merge(P, r.P); merge(C, r.C); done++; console.log(`combos ${done}/${chunks}`); fs.writeFileSync(path.join(OUT, 'combos.json'), JSON.stringify({ P, C })); });
  } else if (cmd === 'report') {
    const U = JSON.parse(fs.readFileSync(path.join(OUT, 'upgrades.json'), 'utf8'));
    const rows = Object.values(U).filter(r => !r.err && r.g).map(r => ({ id: r.id, tree: S.TREE[r.id].tree, p: rate(r.g[0], r.g[1]), m: margin(r.g[0], r.g[1]), n: r.g[0] + r.g[1], k: r.k, hz: r.hz, dmg: r.dmg, team: r.team })).sort((x, y) => y.p - x.p);
    for (const r of rows) console.log(`${(r.id + ' (' + r.tree + ')').padEnd(26)} ${String(Math.round(r.p * 100)).padStart(3)}% ±${Math.round(r.m * 100)}  ${r.n} games  kills ${r.k[0]}-${r.k[1]}  hazard ${r.hz[0]}-${r.hz[1]}  dmg ${r.dmg[0]}-${r.dmg[1]}${r.team > 1 ? '  (2v2)' : ''}${Math.abs(r.p - 0.5) > r.m ? '  *' : ''}`);
    if (fs.existsSync(path.join(OUT, 'combos.json'))) {
      const { P, C } = JSON.parse(fs.readFileSync(path.join(OUT, 'combos.json'), 'utf8'));
      const syn = Object.entries(P).filter(([, r]) => r[0] + r[1] >= 60).map(([k, r]) => { const [ro, pair] = k.split(':'), [x, y] = pair.split('+'), cx = C[ro + ':' + x], cy = C[ro + ':' + y]; const px = rate(cx[0], cx[1]), py = rate(cy[0], cy[1]), pp = rate(r[0], r[1]); return { k, pp, syn: pp - (px + py) / 2, n: r[0] + r[1], m: margin(r[0], r[1]) }; }).sort((a, b) => b.syn - a.syn);
      console.log('\nbest pairs (win rate together, and above the two cards\' own average)');
      for (const s of syn.slice(0, 20)) console.log(`${s.k.padEnd(40)} ${Math.round(s.pp * 100)}% (+${Math.round(s.syn * 100)}) ±${Math.round(s.m * 100)} of ${s.n}`);
      console.log('\nworst pairs'); for (const s of syn.slice(-10).reverse()) console.log(`${s.k.padEnd(40)} ${Math.round(s.pp * 100)}% (${Math.round(s.syn * 100)}) ±${Math.round(s.m * 100)} of ${s.n}`);
    }
  } else console.log('usage: upgrade-fit.js cards [N] [ids] | combos [N] | report');
})();
