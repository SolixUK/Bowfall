#!/usr/bin/env node
// root-fit: how often bots land their roots. A Frost Trapper (Bramble Trap and Bramble Toss) against a moving, dodging Frost
// Ranger, 1v1 on an open arena; counts traps laid and toss throws, and how many of each rooted someone.
//   node tools/root-fit.js [skill] [matches] [key=value ...]   e.g. trapLead=0.6 trapVmax=200 briarMax=500
const S = require('../public/sim.js');
const args = process.argv.slice(2), sk = +args[0] || 0.95, N = +args[1] || 12;
for (const kv of args.slice(2)) { const [k, v] = kv.split('='); if (k in S.ROOTK) S.ROOTK[k] = +v; }
const map = process.env.MAP || 'meadow';
let traps = 0, trapRoots = 0, tosses = 0, tossRoots = 0, secs = 0;
for (let m = 0; m < N; m++) {
  const w = S.createWorld({ map, opt: { effect: 'none' } }); w.cfg.pointsToWin = 1; w.cfg.gamesToWin = 3;
  const A = S.addBot(w, 'red'), B = S.addBot(w, 'blue');
  S.setLoadout(w, A.id, 'frost', 'trapper'); A.forceUp = ['trap', 'briar', 'deeproots']; A.dparams = S.facetParams({ aim: sk, pos: sk, dodge: sk, mind: 1 });
  S.setLoadout(w, B.id, 'frost', 'ranger'); B.forceUp = ['fleet', 'dash', 'momentum']; B.dparams = S.facetParams({ aim: 0.85, pos: 0.85, dodge: 0.85, mind: 0.5 });
  S.setBotMind(w, A.id, { aggr: 0.7 }); S.setBotMind(w, B.id, { aggr: 0.8 });
  S.startMatch(w);
  const seenZ = new Set(), seenA = new Set();
  for (let i = 0; i < 60 * 60 * 8 && w.match.ph !== 'over'; i++) {
    S.step(w, 1 / 60); if (w.match.ph === 'play') secs += 1 / 60;
    for (const z of w.zones) if (z.ty === 'trap' && z.owner === A.id && !seenZ.has(z.id)) { seenZ.add(z.id); traps++; }
    for (const a of w.arrows) if (a.bri && a.owner === A.id && !seenA.has(a.id)) { seenA.add(a.id); tosses++; }
    for (const e of w.events) if (e.e === 'trapHit') { if (e.aid) tossRoots++; else trapRoots++; }
    w.events.length = 0;
  }
}
const pct = (a, b) => (b ? Math.round(a / b * 100) : 0) + '%';
console.log(JSON.stringify({ sk, knobs: S.ROOTK, traps, trapRoots, trapRate: pct(trapRoots, traps), tosses, tossRoots, tossRate: pct(tossRoots, tosses), rootsPerMin: +((trapRoots + tossRoots) / (secs / 60)).toFixed(2) }));
