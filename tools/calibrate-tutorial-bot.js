// Measures the tutorial's adaptive bot (a Flame Ranger) at a range of skills against matchmaking's AI players, one game
// at a time, and prints the rating that best explains each skill's results. Those numbers are SKILL_ELO in
// public/index.html. Run: node tools/calibrate-tutorial-bot.js 240   (games per skill; about 5 minutes)
// the tutorial's bot (Flame Ranger at skill s) against matchmaking's AI players, one game at a time
const Sim = require('../public/sim.js'), AI = require('../lib/ai-players.json');
const { fork } = require('child_process');
const fit = s => { const K = [[0, 501], [0.3, 660], [0.55, 1028], [0.78, 1459], [1, 1726]]; let i = 0; while (i < K.length - 2 && s > K[i + 1][0]) i++; const [a, ea] = K[i], [b, eb] = K[i + 1]; return ea + (eb - ea) * (s - a) / (b - a); };
function game(s, opp) {
  const w = Sim.createWorld({ map: Sim.MAP_KEYS.filter(k => k !== 'reach' && !k.startsWith('cq'))[Math.floor(Math.random() * 6)], diff: 'normal', opt: { effect: 'none' } });
  const me = Sim.addBot(w, 'red'); me.dparams = Sim.skillParams(s); Sim.setLoadout(w, me.id, 'flame', 'ranger');
  const o = Sim.addBot(w, 'blue'); o.dparams = Sim.skillParams(opp.ai.skill); const L = opp.ai.loadouts[0]; Sim.setLoadout(w, o.id, L[0], L[1]); o.ai.aggr = opp.ai.aggr; if (opp.ai.style) o.ai.style = o.ai.baseStyle = opp.ai.style;
  Sim.startMatch(w);
  for (let i = 0; i < 60 * 200; i++) {
    for (const q of w.players) if (q.offer && !q.picked) Sim.choose(w, q.id, Math.floor(Math.random() * 3));
    Sim.step(w, 1 / 60);
    for (const e of w.events) if (e.e === 'gameEnd' && e.rw !== 'draw') return e.rw === 'red' ? 1 : 0;
    w.events.length = 0; w.records.length = 0;
  }
  return null;
}
if (process.argv[2] === 'w') {
  process.on('message', ({ s, n }) => { const out = []; const pred = fit(s);
    const pool = AI.filter(a => Math.abs(a.career.elo - pred) < 220); const P = pool.length ? pool : AI;
    for (let i = 0; i < n; i++) { const opp = P[Math.floor(Math.random() * P.length)]; const r = game(s, opp); if (r != null) out.push([opp.career.elo, r]); }
    process.send(out); });
} else {
  const S = [0, 0.1, 0.2, 0.3, 0.42, 0.55, 0.66, 0.78, 0.9, 1], N = +process.argv[2] || 60, per = 4;
  (async () => {
    for (const s of S) {
      const parts = await Promise.all(Array.from({ length: per }, () => new Promise(res => { const c = fork(__filename, ['w']); c.on('message', m => { res(m); c.kill(); }); c.send({ s, n: Math.ceil(N / per) }); })));
      const g = parts.flat(), W = g.reduce((t, x) => t + x[1], 0);
      // the rating that best explains these results (Elo, solved by bisection)
      let lo = 0, hi = 2500; for (let k = 0; k < 40; k++) { const R = (lo + hi) / 2, exp = g.reduce((t, [e]) => t + 1 / (1 + Math.pow(10, (e - R) / 400)), 0); if (exp < W) lo = R; else hi = R; }
      console.log(`skill ${s}: ${W}/${g.length} won vs avg ${Math.round(g.reduce((t, x) => t + x[0], 0) / g.length)}  -> rating ${Math.round(lo)}  (fit from AI pool ${Math.round(fit(s))})`);
    }
  })();
}
