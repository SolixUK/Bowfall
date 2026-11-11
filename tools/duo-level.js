#!/usr/bin/env node
// duo-level: keeps the arcade's duos (and the Terminator) level with each other at every difficulty.
// Each duo, seated as a run would seat it at a level (the middle of the ladder, two people's version), plays a pair of
// ordinary bots of its own skill, random archetypes. A duo that wins far more than the rest (its tactic or kit punching
// above its skill) gets less skill at that level; one that wins far less gets more. The result is `lv` in lib/duos.json:
// skill added at levels 2, 5 and 8 (public/coop.js draws straight lines between them).
//   node tools/duo-level.js run [duo|all] [N]           the table, as things stand
//   node tools/duo-level.js fit [duo|all] [rounds] [N]  adjust lv toward TARGET and write it
'use strict';
const fs = require('fs'), path = require('path'), { fork } = require('child_process');
const S = require('../public/sim.js');
const ROSTER_PATH = path.join(__dirname, '../lib/duos.json');
const FIT = (() => { try { return JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/duo-fit.json'), 'utf8')); } catch (e) { return { duos: {} }; } })();
const LEVELS = [2, 5, 8], TARGET = 60, K = 160; // aim: each duo wins about 60% of games against its own skill; K: % per unit of skill (a first guess, refined by the secant)
const EL = ['flame', 'frost', 'stone', 'storm', 'poison', 'blood', 'void'], RO = ['ranger', 'sniper', 'juggernaut', 'warden', 'trapper', 'crossbow', 'ninja', 'assassin', 'trickster'];
const band = L => { const k = (L - 1) / 9; return [0.35 + 0.5 * k, 0.55 + 0.43 * k]; };

function play(d, L, off, N, seed0) {
  const [f0, f1] = band(L);
  let gw = [0, 0], seed = seed0 || 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let m = 0; m < N; m++) {
    const w = S.createWorld({ map: d.map, opt: { effect: d.effects.join('+') || 'none' } }); w.cfg.pointsToWin = 1; w.cfg.gamesToWin = 2;
    const ta = m % 2 ? 'red' : 'blue', tb = m % 2 ? 'blue' : 'red'; let base = 0;
    if (d.boss) {
      const top = Math.max(0.05, Math.min(1, f1 + 0.03 + off)), mm = d.members[0]; base = Math.min(1, f1 + 0.03);
      const b = S.addBot(w, ta); S.setLoadout(w, b.id, null, 'ranger'); b.element = null; b.dparams = S.facetParams({ aim: top, pos: top, dodge: Math.min(1, top + 0.1), mind: 1 });
      b.boss = { hp: mm.boss.hp[1], sense: Math.min(1, 0.15 + 0.6 * top * top), el: [], mode: null, at: 0 }; b.forceUp = [];
      S.setBotMind(w, b.id, { aggr: 0.7, tr: { cover: 0.3, edge: 0.8, dash: 1, charge: 0.3 }, tactic: mm.tac });
    } else d.members.forEach((c, i) => {
      const b = S.addBot(w, ta); S.setLoadout(w, b.id, c.el, c.role); b.forceUp = c.ups.slice();
      const f = Math.min(1, f0 + (f1 - f0) * 0.5 + 0.02 * i + (d.boost || 0) + (c.boost || 0) + off); base += (f - off) / 2; // (the pair it meets has the duo's skill before the adjustment)
      b.dparams = S.facetParams({ aim: f, pos: f, dodge: f, mind: 1 });
      S.setBotMind(w, b.id, { aggr: 0.7, tr: { cover: 0.4, edge: 0.5, dash: 0.7, charge: 0.2 }, tactic: Object.assign({}, c.tac, FIT.duos[d.id] && FIT.duos[d.id].tacs ? FIT.duos[d.id].tacs[i] : null) });
    });
    for (let i = 0; i < 2; i++) { const b = S.addBot(w, tb); S.setLoadout(w, b.id, EL[Math.floor(rnd() * EL.length)], RO[Math.floor(rnd() * RO.length)]); b.dparams = S.facetParams({ aim: base, pos: base, dodge: base, mind: base }); }
    S.startMatch(w);
    const B = w.players.find(q => q.boss); if (B) { S.applyStats(B); B.hp = B.maxHp; }
    for (let i = 0; i < 60 * 60 * 12 && w.match.ph !== 'over'; i++) { S.step(w, 1 / 60); for (const e of w.events) if (e.e === 'gameEnd' && e.rw && e.rw !== 'draw') gw[e.rw === ta ? 0 : 1]++; w.events.length = 0; }
  }
  return Math.round(gw[0] / Math.max(1, gw[0] + gw[1]) * 100);
}

if (process.argv[2] === 'worker') {
  process.on('message', j => { const R = JSON.parse(fs.readFileSync(ROSTER_PATH, 'utf8')), d = R.duos.find(x => x.id === j.id); process.send({ id: j.id, L: j.L, off: j.off, pct: play(d, j.L, j.off, j.N, j.seed) }); });
  return;
}
const lvAt = (d, L) => (Array.isArray(d.lv) ? d.lv[LEVELS.indexOf(L)] || 0 : 0);
function runJobs(jobs, nw = 2) {
  return new Promise(res => {
    const out = [], ws = [], q = jobs.slice(); let busy = 0;
    const next = w => { const j = q.shift(); if (!j) { w.kill(); if (--busy === 0) res(out); return; } w.send(j); };
    for (let i = 0; i < Math.min(nw, jobs.length); i++) { const w = fork(__filename, ['worker']); busy++; w.on('message', r => { out.push(r); console.log(`  ${r.id} L${r.L} skill ${r.off >= 0 ? '+' : ''}${r.off.toFixed(2)} → ${r.pct}%`); next(w); }); ws.push(w); next(w); }
  });
}
(async () => {
  const [cmd, which, a1, a2] = process.argv.slice(2);
  const R = JSON.parse(fs.readFileSync(ROSTER_PATH, 'utf8')), duos = R.duos.filter(d => !which || which === 'all' || d.id === which);
  if (cmd === 'run') { await runJobs(duos.flatMap(d => LEVELS.map(L => ({ id: d.id, L, off: lvAt(d, L), N: +a1 || 16 })))); return; }
  if (cmd !== 'fit') { console.log('usage: duo-level.js run [duo|all] [N] | fit [duo|all] [rounds] [N]'); return; }
  const rounds = +a1 || 3, N = +a2 || 16, hist = {};
  for (let r = 0; r < rounds; r++) {
    console.log(`round ${r + 1}`);
    const res = await runJobs(duos.flatMap(d => LEVELS.map(L => ({ id: d.id, L, off: lvAt(d, L), N, seed: 1 + r * 7919 }))));
    for (const x of res) {
      const d = duos.find(q => q.id === x.id), i = LEVELS.indexOf(x.L), h = hist[x.id + x.L] || (hist[x.id + x.L] = []); h.push([x.off, x.pct]);
      let k = K; if (h.length >= 2) { const [o1, p1] = h[h.length - 2], [o2, p2] = h[h.length - 1]; if (Math.abs(o2 - o1) > 0.01 && (p1 - p2) * (o1 - o2) < 0) k = Math.max(60, Math.min(400, Math.abs((p2 - p1) / (o2 - o1)))); } // (the secant, when it makes sense)
      const step = Math.abs(x.pct - TARGET) <= 6 ? 0 : (TARGET - x.pct) / k; // (within noise: leave it)
      if (!Array.isArray(d.lv)) d.lv = [0, 0, 0];
      d.lv[i] = +Math.max(-0.3, Math.min(0.08, d.lv[i] + Math.max(-0.15, Math.min(0.15, step)))).toFixed(3);
    }
    const cur = JSON.parse(fs.readFileSync(ROSTER_PATH, 'utf8'));
    for (const d of duos) { const c = cur.duos.find(q => q.id === d.id); if (c) c.lv = d.lv; }
    fs.writeFileSync(ROSTER_PATH, JSON.stringify(cur, null, 1));
    console.log('lv now: ' + duos.map(d => `${d.id} [${d.lv.join(', ')}]`).join(' · '));
  }
})();
