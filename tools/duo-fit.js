#!/usr/bin/env node
// duo-fit: trains the co-op arcade's duos against a sparring pair.
//   node tools/duo-fit.js run [duo|all] [N] [skill] [sparSkill]   play N matches per duo, tactic on and off, and print the table
//   node tools/duo-fit.js train [duo|all] [rounds] [N]           tune each duo's tactic parameters (hill climbing), keep the best,
//                                                                  write lib/duo-fit.json (the ladder merges it over lib/duos.json)
// The sparring pair: two plain archers (no archetype, no element) with a little more skill than the duo, told to engage.
// A duo that wins too easily gets a sharper pair (the file records the sparring skill it was trained against).
const fs = require('fs'), path = require('path');
const S = require('../public/sim.js');
const ROSTER = JSON.parse(fs.readFileSync(path.join(__dirname, '../lib/duos.json'), 'utf8'));
const FIT_PATH = path.join(__dirname, '../lib/duo-fit.json');
const FIT = fs.existsSync(FIT_PATH) ? JSON.parse(fs.readFileSync(FIT_PATH, 'utf8')) : { v: 1, duos: {} };
// which parameters each tactic mode tunes, and the range to try
const TUNE = {
  guard: { guardD: [70, 200], tacK: [0.6, 2.0], wallK: [0.6, 2.0] },
  behind: { behindD: [60, 220], side: [20, 90], tacK: [0.4, 1.8], wallK: [0.6, 2.0] },
  bully: { bullyD: [120, 260], bashEager: [1, 5] },
  unload: { unloadD: [120, 300] },
  crossfire: { cross: [0.6, 1.6], farD: [480, 760], tacK: [0.3, 1.5] },
  flank: { flankAng: [0.8, 1.6], tacK: [0.4, 1.8] },
  hunt: { pickK: [1.2, 3.5], pickRange: [300, 700] },
  syncstealth: { stealthGap: [0.5, 2.0], ambushAng: [0.8, 1.6] },
  trapper: { trapGap: [120, 320], waterK: [0.3, 1.8] },
  finisher: { finishD: [220, 420] },
  rift: { finishD: [220, 420] },
  focus: {},
};
const SPAR_HAZ = ['pit', 'lava', 'water', 'spikes', 'saw'];
function play(duo, N, sk, sparSk, tacOn, tacs) {
  let gw = [0, 0], mw = [0, 0], haz = 0, kills = 0, picks = 0, t = 0;
  for (let m = 0; m < N; m++) {
    const w = S.createWorld({ map: duo.map, opt: { effect: duo.effects.join('+') || 'none' } }), swap = m % 2 === 1, ta = swap ? 'blue' : 'red', tb = swap ? 'red' : 'blue';
    w.cfg.pointsToWin = 1; w.cfg.gamesToWin = 2;
    const ids = [];
    duo.members.forEach((c, i) => {
      const b = S.addBot(w, ta); S.setLoadout(w, b.id, c.el, c.ro || c.role); b.forceUp = c.ups.slice();
      b.dparams = S.facetParams({ aim: sk, pos: sk, dodge: sk, mind: 1 });
      S.setBotMind(w, b.id, { aggr: 0.7, tr: { cover: 0.4, edge: 0.5, dash: 0.7, charge: 0.2 }, tactic: tacOn ? Object.assign({}, c.tac, tacs ? tacs[i] : null) : null });
      ids.push(b.id);
    });
    for (let i = 0; i < 2; i++) { const b = S.addBot(w, tb); S.setLoadout(w, b.id, 'frost', 'ranger'); b.sparring = true; b.dparams = S.facetParams({ aim: sparSk, pos: sparSk, dodge: sparSk, mind: 0.3 }); S.setBotMind(w, b.id, { aggr: 0.9, tr: { cover: 0.3, edge: 0.4, dash: 0.6, charge: 0.2 }, gene: { pref: 0.6, noLearn: true } }); }
    S.startMatch(w);
    for (let i = 0; i < 60 * 60 * 15 && w.match.ph !== 'over'; i++) {
      S.step(w, 1 / 60); t += 1 / 60;
      for (const e of w.events) {
        if (e.e === 'gameEnd' && e.rw && e.rw !== 'draw') gw[e.rw === ta ? 0 : 1]++;
        if (e.e === 'kill' && ids.includes(e.k)) { kills++; if (SPAR_HAZ.includes(e.c)) haz++; }
        if (e.e === 'pick' && ids.includes(e.id) && e.ty !== 'amber') picks++;
      }
      w.events.length = 0;
    }
    if (w.match.mw) mw[w.match.mw === ta ? 0 : 1]++;
  }
  return { mw, gw, pct: Math.round(gw[0] / Math.max(1, gw[0] + gw[1]) * 100), kills, haz, picks, secs: Math.round(t / N) };
}
const fmt = (r, tag) => `${tag.padEnd(4)} ${String(r.pct + '%').padStart(4)}  matches ${r.mw[0]}-${r.mw[1]}  games ${r.gw[0]}-${r.gw[1]}  kills ${r.kills} (hazard ${r.haz})  power-ups ${r.picks}  ~${r.secs}s a match`;
const pickDuos = a => (!a || a === 'all' ? ROSTER.duos : ROSTER.duos.filter(d => d.id === a));
const [cmd, which, ...rest] = process.argv.slice(2);
if (cmd === 'run') {
  const N = +rest[0] || 30, sk = +rest[1] || 0.85, sparSk = +rest[2] || sk + 0.05;
  for (const d of pickDuos(which)) {
    const fit = FIT.duos[d.id], tacs = fit ? fit.tacs : null;
    const on = play(d, N, sk, sparSk, true, tacs), off = play(d, N, sk, sparSk, false);
    console.log(`\n${d.name} (${d.id}) on ${d.map} [${d.effects.join('+') || 'none'}]  duo ${sk} vs sparring ${sparSk}${tacs ? ' (tuned)' : ''}`);
    console.log('  ' + fmt(on, 'ON')); console.log('  ' + fmt(off, 'OFF'));
  }
} else if (cmd === 'train') {
  const rounds = +rest[0] || 8, N = +rest[1] || 40, sk = 0.85;
  for (const d of pickDuos(which)) {
    let sparSk = (FIT.duos[d.id] && FIT.duos[d.id].sparSk) || 0.9;
    let best = { tacs: d.members.map(() => ({})), pct: -1 };
    if (FIT.duos[d.id] && FIT.duos[d.id].tacs) best.tacs = FIT.duos[d.id].tacs;
    const evalIt = tacs => play(d, N, sk, sparSk, true, tacs);
    let r = evalIt(best.tacs); best.pct = r.pct; best.r = r;
    console.log(`\n${d.name}: start ${best.pct}% vs sparring ${sparSk}`);
    // too easy: a sharper pair, and start again from there
    while (best.pct > 68 && sparSk < 0.99) { sparSk = Math.min(0.99, +(sparSk + 0.03).toFixed(2)); r = evalIt(best.tacs); best.pct = r.pct; best.r = r; console.log(`  too easy: sparring up to ${sparSk} → ${best.pct}%`); }
    for (let k = 0; k < rounds; k++) {
      // nudge one or two parameters of one member (or the shared ones of both when they share a mode)
      const tacs = best.tacs.map(t => Object.assign({}, t));
      const i = Math.floor(Math.random() * d.members.length), mode = d.members[i].tac.mode, keys = Object.keys(TUNE[mode] || {});
      if (!keys.length) break;
      for (let n = 0; n < 1 + (Math.random() < 0.4 ? 1 : 0); n++) {
        const key = keys[Math.floor(Math.random() * keys.length)], [lo, hi] = TUNE[mode][key], cur = tacs[i][key] != null ? tacs[i][key] : (d.members[i].tac[key] != null ? d.members[i].tac[key] : (lo + hi) / 2);
        let v = cur + (Math.random() - 0.5) * (hi - lo) * 0.5; v = Math.max(lo, Math.min(hi, v)); tacs[i][key] = +v.toFixed(key === 'tacK' || key === 'cross' || key === 'flankAng' || key === 'stealthGap' || key === 'ambushAng' || key === 'pickK' ? 2 : 0);
        for (let j = 0; j < d.members.length; j++) if (j !== i && d.members[j].tac.mode === mode) tacs[j][key] = tacs[i][key]; // (a shared mode shares its numbers)
      }
      r = evalIt(tacs);
      const keep = r.pct > best.pct + 2 || (r.pct >= best.pct && r.haz + r.picks > best.r.haz + best.r.picks); // (better, or as good with the gimmick showing more)
      console.log(`  round ${k + 1}: ${JSON.stringify(tacs)} → ${r.pct}% (hazard ${r.haz}, power-ups ${r.picks})${keep ? '  ✓ kept' : ''}`);
      if (keep) { best = { tacs, pct: r.pct, r }; }
    }
    // (re-read before writing: several duos may be training at once in separate processes)
    let cur = FIT; try { cur = JSON.parse(fs.readFileSync(FIT_PATH, 'utf8')); } catch (e) { /* first write */ }
    cur.duos[d.id] = { tacs: best.tacs, pct: best.pct, sparSk, sk, n: N, at: new Date().toISOString().slice(0, 10) };
    fs.writeFileSync(FIT_PATH, JSON.stringify(cur, null, 1));
    console.log(`  ${d.name}: ${best.pct}% vs sparring ${sparSk} → ${JSON.stringify(best.tacs)}`);
  }
} else {
  console.log('usage: duo-fit.js run [duo|all] [N] [skill] [sparSkill] | train [duo|all] [rounds] [N]');
}
