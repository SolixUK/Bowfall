// Sizes the AI players' careers so they look like real accounts: the higher someone's rating, the more they have
// played (a top player has hundreds of games and a high level; a low-rated one is usually newer). Used by seed-ai.js
// after its simulation, and by rescale-ai.js to redo the sizing on the saved list. The one-off feats (clutches,
// streaks) survive in proportion, and achievements are recomputed from the sized stats.
'use strict';
const Sim = require('../public/sim.js');
const VOL = ['games', 'wins', 'kills', 'deaths', 'ring', 'shots', 'hits', 'matches', 'matchWins'];
const FLAGS = ['clutch', 'clutch3', 'streak5', 'streak10', 'emp'];
const SEED_V = 2; // bump when the sizing changes so the server re-sizes accounts it made from an older list

// The simulation only tracks a few feats, and some from an older achievement list. Fill in the rest from the career so
// each AI player has the achievements someone with their record and skill would: totals follow the career, and the
// one-game bests (accuracy, streaks, a long shot) follow skill.
function fillStats(ns, c, p, rnd) {
  const skill = (p.ai && p.ai.skill) || 0.5, games = c.games || 0, wins = c.wins || 0, wr = games ? wins / games : 0.5;
  const jit = (a, b) => a + rnd() * (b - a), set = (k, v) => { if (ns[k] == null || ns[k] === 0) ns[k] = v; };
  ns.ko = c.kills || 0;
  ns.mw = c.matchWins || 0; delete ns.match;
  if (ns.streak10 || ns.streak5) { set('kstreak', ns.streak10 ? 10 : 5); delete ns.streak10; delete ns.streak5; }
  if (ns.long) { set('longM', 20); delete ns.long; }
  if (ns.flawless != null) { set('perfect', Math.round(ns.flawless * 0.12)); delete ns.flawless; }
  set('kstreak', Math.max(1, Math.round(1 + skill * jit(3, 9))));
  set('mstreak', Math.max(1, Math.round(Math.min(ns.mw, 1 + wr * skill * jit(2, 10)))));
  set('dstreak', Math.max(1, Math.round(1 + skill * jit(2, 12))));
  set('perfect', Math.round(ns.mw * jit(0.05, 0.2) * skill));
  const acc = games ? (c.hits || 0) / Math.max(1, c.shots || 1) : 0.3;
  set('acc', Math.round(Math.min(100, Math.max(20, acc * 100 * jit(1.4, 2.1) + skill * 15))));
  set('bullG', Math.round(Math.min(10, 1 + skill * jit(1, 6))));
  set('topdmg', Math.round(games * 0.55 * jit(0.15, 0.45) * (0.5 + skill)));
  set('ringM', Math.round(Math.min(12, 1 + skill * jit(1, 6))));
  set('longM', Math.round(10 + skill * jit(4, 22)));
  set('pin', Math.round(ns.ko * jit(0.08, 0.3)));
  set('giant', Math.round(ns.mw * jit(0.02, 0.1)));
  set('revive', Math.round(games * jit(0.02, 0.15) * (Object.keys(c.roles || {}).some(r => r === 'medic' || r === 'warden') ? 2.5 : 0.6)));
  set('capture', Math.round(games * jit(0.05, 0.25)));
  set('emp', Math.round(games * jit(0, 0.12)));
  set('clutch', Math.round(ns.mw * jit(0, 0.15) * skill));
  ns.perfect = Math.min(ns.perfect, ns.mw); ns.kstreak = Math.min(ns.kstreak, Math.round(2 + skill * 12)); ns.clutch = Math.max(ns.clutch || 0, ns.clutch3 || 0);
  for (const k of ['long', 'streak5', 'streak10', 'flawless', 'match']) delete ns[k];
}
// list: players with career (elo, games...) and ach.stats; rnd: a seeded random in [0,1)
function scaleCareers(list, rnd) {
  const ranked = list.slice().sort((a, b) => b.career.elo - a.career.elo), n = ranked.length;
  ranked.forEach((p, rank) => {
    const c = p.career, cur = Math.max(1, c.games || 1);
    // games by rank: about 40 at the bottom up to 800-odd at the top, with some spread
    const pos = (n - 1 - rank) / Math.max(1, n - 1);
    const target = Math.round((45 + 780 * Math.pow(pos, 1.5)) * (0.7 + rnd() * 0.6));
    const f = target / cur, sc = v => Math.max(0, Math.round(v * f));
    for (const k of VOL) if (c[k] != null) c[k] = sc(c[k]);
    if (c.dmg != null) c.dmg = Math.round(c.dmg * f);
    for (const o of [c.roles, c.roleW, c.els]) if (o) for (const k in o) o[k] = sc(o[k]);
    c.games = Math.max(c.games || 0, 1); c.wins = Math.min(c.wins || 0, c.games);
    c.matches = Math.max(c.matches || 0, 1); c.matchWins = Math.min(c.matchWins || 0, c.matches);
    // someone with hundreds of games has been around a while
    const oldest = Date.now() - Math.round(10 + c.games * 0.12 + rnd() * 30) * 86400000;
    if (!p.created || p.created > oldest) p.created = oldest;
    const st = (p.ach && p.ach.stats) || {}, keepFlag = Math.min(1, 0.3 + f * 0.7), ns = {};
    for (const [k, v] of Object.entries(st)) ns[k] = FLAGS.includes(k) ? (v && (f >= 1 || rnd() < keepFlag) ? Math.max(1, sc(v)) : 0) : sc(v);
    fillStats(ns, c, p, rnd);
    c.bull = ns.bull || 0;
    const old = p.ach || {};
    p.ach = { stats: ns, got: {}, tier: {}, v: 2 };
    for (const [k, a] of Object.entries(Sim.ACHIEVEMENTS)) {
      const t = Sim.achTierOf(k, ns[a.stat] || 0);
      if (t) { p.ach.tier[k] = t; p.ach.got[k] = (old.got && old.got[k]) || p.created + Math.floor(rnd() * Math.max(1, Date.now() - p.created)); }
    }
    const got = Sim.achBest(p.ach, 20);
    if (!p.title || !p.ach.got[p.title]) p.title = got.length && rnd() < 0.6 ? got[Math.floor(rnd() * Math.min(2, got.length))] : null;
    if (!old.border || !p.ach.got[old.border]) { if (got.length && rnd() < 0.7) p.ach.border = got[Math.floor(rnd() * Math.min(3, got.length))]; } else p.ach.border = old.border;
    c.seedV = SEED_V;
  });
}
module.exports = { scaleCareers, SEED_V, VOL };
