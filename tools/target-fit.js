#!/usr/bin/env node
// target-fit: which enemy should a bot shoot first? Two teams with the same line-up (one tank, one damage dealer; the
// archetypes, elements, skill and arena drawn at random, the sides swapped every other match) differ only in how they
// pick targets. Whatever wins more is the better rule. Focus calls are off, so the targeting is all that differs.
//   node tools/target-fit.js vs <A> <B> [N]      e.g. vs threat base 200
//   node tools/target-fit.js grid [N]            every named rule against the current one
'use strict';
const path = require('path'), { fork } = require('child_process');
const S = require('../public/sim.js');
const BASE = Object.assign({}, S.TARGET_W);
const RULES = {
  current: BASE,
  base: { hp: 1.5, threat: 0, finish: 0, lowHp: 24 },               // distance and health only (before 0.99.9)
  threat: { hp: 1.5, threat: 320, finish: 300, lowHp: 24 },
  tank: { hp: 1.5, threat: -320, finish: 300, lowHp: 24 },          // the tank first
  low: { hp: 4, threat: 0, finish: 300, lowHp: 24 },                // whoever's lowest, hard
  dps2: { hp: 1.5, threat: 640, finish: 300, lowHp: 24 },           // damage dealers first, harder
  dpsLow: { hp: 3, threat: 320, finish: 300, lowHp: 30 },           // damage dealers first, but health counts double
  nofin: { hp: 1.5, threat: 320, finish: 0, lowHp: 24 },
  dpsOnly: { hp: 1.5, threat: 3000, finish: 300, lowHp: 24 },      // extremes, to see how much the choice matters at all
  tankOnly: { hp: 1.5, threat: -3000, finish: 300, lowHp: 24 },
  lowOnly: { hp: 10, threat: 0, finish: 300, lowHp: 24 },
  nearest: { hp: 0, threat: 0, finish: 0, lowHp: 24 },
  nearThreat: { hp: 0.5, threat: 160, finish: 300, lowHp: 24 },     // mostly whoever's nearest, a lean toward damage dealers, finish the near-dead
  nearFin: { hp: 0, threat: 0, finish: 300, lowHp: 24 },
};
const TANKS = ['juggernaut', 'warden'], DPS = ['sniper', 'crossbow', 'ranger', 'assassin', 'ninja', 'trickster', 'trapper'];
const EL = ['flame', 'frost', 'stone', 'storm', 'poison', 'blood', 'void'], MAPS = S.MAP_KEYS.filter(k => !S.MAPS[k].big && !S.MAPS[k].coop && !S.MAPS[k].mode);
function play(A, B, N, seed) {
  let s = seed; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
  let ga = 0, gb = 0;
  for (let m = 0; m < N; m++) {
    const comp = [[pick(TANKS), pick(EL)], [pick(DPS), pick(EL)]], sk = 0.55 + rnd() * 0.4, map = pick(MAPS);
    const w = S.createWorld({ map, opt: { effect: 'none' } }); w.cfg.pointsToWin = 1; w.cfg.gamesToWin = 2;
    const sideA = m % 2 ? 'red' : 'blue', sideB = m % 2 ? 'blue' : 'red';
    for (const [side, W] of [[sideA, A], [sideB, B]]) for (const [ro, el] of comp) {
      const b = S.addBot(w, side); S.setLoadout(w, b.id, el, ro); b.dparams = S.facetParams({ aim: sk, pos: sk, dodge: sk, mind: 0.85 });
      S.setBotMind(w, b.id, { aggr: 0.7, tr: { cover: 0.4, edge: 0.5, dash: 0.7, charge: 0.3 }, gene: { noLearn: true } }); b.ai.tw = W; b.ai.noCall = true;
    }
    S.startMatch(w);
    for (let i = 0; i < 60 * 60 * 10 && w.match.ph !== 'over'; i++) { S.step(w, 1 / 60); for (const e of w.events) if (e.e === 'gameEnd' && e.rw && e.rw !== 'draw') { if (e.rw === sideA) ga++; else gb++; } w.events.length = 0; }
  }
  return [ga, gb];
}
if (process.argv[2] === 'worker') { process.on('message', j => process.send(play(RULES[j.a] || j.a, RULES[j.b] || j.b, j.n, j.seed))); return; }
function vs(a, b, N) {
  return new Promise(res => { let ga = 0, gb = 0, left = 2; for (let k = 0; k < 2; k++) { const w = fork(__filename, ['worker']); w.on('message', ([x, y]) => { ga += x; gb += y; w.kill(); if (--left === 0) res([ga, gb]); }); w.send({ a, b, n: Math.ceil(N / 2), seed: 1 + k * 104729 }); } });
}
(async () => {
  const [cmd, x, y, n] = process.argv.slice(2);
  const show = (a, b, [ga, gb]) => { const p = ga / (ga + gb), se = Math.sqrt(p * (1 - p) / (ga + gb)); console.log(`${a} vs ${b}: ${Math.round(p * 100)}% of ${ga + gb} games (±${Math.round(se * 196)})`); };
  if (cmd === 'vs') show(x, y, await vs(x, y, +n || 200));
  else if (cmd === 'grid') for (const r of (y ? y.split(',') : Object.keys(RULES).filter(k => k !== 'current'))) show(r, 'base', await vs(r, 'base', +x || 200));
  else console.log('usage: target-fit.js vs <A> <B> [N] | grid [N]');
})();
