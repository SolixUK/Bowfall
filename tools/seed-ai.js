// Builds lib/ai-players.json: matchmaking's AI players, with ratings, stats and achievements earned by
// playing thousands of simulated matches against each other (so their ratings settle where their skill puts them).
// Run: node tools/seed-ai.js [matches]   (about 20 minutes for 1400 matches on two cores)
'use strict';
const path = require('path'), fs = require('fs'), { fork } = require('child_process');
const Sim = require('../public/sim.js');

if (process.argv[2] === 'worker') {
  // play the matches we're sent, report what happened
  process.on('message', jobs => {
    const out = jobs.map(job => {
      const w = Sim.createWorld({ map: job.map, pointsToWin: 3 });
      const seat = {};
      for (const [team, list] of Object.entries(job.teams)) for (const s of list) {
        const b = Sim.addBot(w, team);
        b.name = s.name; b.dparams = Sim.skillParams(s.skill);
        Sim.setLoadout(w, b.id, s.el, s.ro);
        b.ai.aggr = s.aggr; if (s.style) b.ai.style = b.ai.baseStyle = s.style;
        seat[b.id] = s.i;
      }
      Sim.startMatch(w);
      const evs = [], recs = [];
      for (let t = 0; w.match.ph !== 'over' && t < 60 * 60 * 30; t++) {
        Sim.step(w, 1 / 60);
        if (w.events.length) { evs.push(...w.events); w.events.length = 0; }
        if (w.records.length) recs.push(...w.records.splice(0));
      }
      const ach = {}, teams = {};
      for (const [pid, i] of Object.entries(seat)) { const p = w.players.find(q => q.id === pid); teams[pid] = p && p.team; ach[i] = Sim.achFromEvents(evs, pid, p && p.team); }
      return { seat, teams, recs, ach };
    });
    process.send(out);
  });
  return;
}

const { rateGame } = require('../lib/rating');
const { TONES } = require('../lib/ai-chat');
let seed = 20260925;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const pick = a => a[Math.floor(rnd() * a.length)];
// names people actually pick
const NAMES = ['Fletchling', 'QuiverQueen', 'xNocturnex', 'tired_archer', 'BowDown99', 'sn1pez', 'mattyb_22', 'Kiwi_Kicks', 'GoblinMode', 'SirPokesALot',
  'ArrowDynamic', 'lilbrambles', 'Vexx', 'soupy_', 'ThatOneSniper', 'hazel_nut', 'R3dFeather', 'DashDashBoom', 'moonpie77', 'Quillion',
  'PitStop', 'knockbackkid', 'Beansprout', 'Wraith_07', 'sadbowboy', 'TheRealFrost', 'Cptn_Crossbow', 'EmberLynx', 'nofunallowed', 'PebbleDasher',
  'zenith', 'fox_in_socks', 'Grumblebow', 'Stormy_Jo', 'lagspike', 'PixelArrow', 'ohnoitsjake', 'Marigold_', 'Ricochet_Rae', 'SaltyDog44',
  'Honeybadger', 'kappa_kev', 'LowKeyLethal', 'WaffleIron', 'bowtie', 'Nyx_', 'CrispyNoodle', 'archie', 'VoidWalker13', 'slippers',
  'tootsie', 'BigYew', 'Yew_Know_It', 'dizzy_d', 'TeaAndArrows', 'Shazam_7', 'ellie_bellie', 'Grimsby', 'tryhard_tim', 'Mochi'];
const ELS = Object.keys(Sim.ELEMENTS), ROS = Object.keys(Sim.ROLES), STY = Object.keys(Sim.STYLES);
const CC = ['gb', 'us', 'us', 'de', 'fr', 'se', 'pl', 'br', 'ca', 'au', 'nl', 'es', 'it', 'jp', 'kr', 'no', 'ie', 'fi', 'dk', 'nz', 'mx', 'pt', 'be', 'at'];
// personalities: most chat now and then, a few never shut up, a few barely speak
const players = NAMES.map((name, i) => {
  const skill = Math.min(1, Math.max(0.03, 0.52 + (rnd() + rnd() + rnd() + rnd() - 2) * 0.45));
  const main = [pick(ELS), pick(ROS)], n = 1 + Math.floor(rnd() * 3); // a main archetype and up to three others they like
  const loadouts = [[...main, 0.55 + rnd() * 0.3]];
  for (let k = 0, tries = 0; k < n && tries < 30; tries++) {
    const l = [rnd() < 0.5 ? main[0] : pick(ELS), rnd() < 0.4 ? main[1] : pick(ROS), Math.round((0.1 + rnd() * 0.25) * 100) / 100];
    if (!loadouts.some(o => o[0] === l[0] && o[1] === l[1])) { loadouts.push(l); k++; }
  }
  loadouts[0][2] = Math.round(loadouts[0][2] * 100) / 100;
  const tone = rnd() < 0.15 ? 'quiet' : pick(TONES.filter(t => t !== 'quiet'));
  const chat = tone === 'quiet' ? 0.08 : Math.round(Math.min(1, 0.15 + rnd() * rnd() * 1.2) * 100) / 100;
  return { i, name, country: pick(CC), ai: { skill: Math.round(skill * 100) / 100, loadouts, style: rnd() < 0.25 ? pick(STY) : null, aggr: Math.round((0.2 + rnd() * 0.8) * 100) / 100, tone, chat },
    career: { elo: 1000 }, ach: {}, created: Date.now() - Math.floor(rnd() * 60) * 86400000 };
});
const loadoutOf = p => { const L = p.ai.loadouts, tot = L.reduce((s, l) => s + l[2], 0); let r = rnd() * tot; for (const l of L) { if ((r -= l[2]) <= 0) return l; } return L[0]; };
// the same career bookkeeping the server does
function careerAdd(u, rec, team) {
  const c = u.career, add = (k, n) => { c[k] = Math.round(((c[k] || 0) + (n || 0)) * 10) / 10; };
  if (rec.type === 'game') {
    const p = rec.pl;
    add('games', 1); if (p.w === 1) add('wins', 1); add('kills', p.k); if (!p.s) add('deaths', 1);
    add('dmg', p.dmg); add('ring', p.ring); add('shots', p.sh); add('hits', p.hi);
    c.roles = c.roles || {}; c.roles[p.ro] = (c.roles[p.ro] || 0) + 1;
    c.roleW = c.roleW || {}; if (p.w === 1) c.roleW[p.ro] = (c.roleW[p.ro] || 0) + 1;
    c.best = c.best || {};
    for (const [k, v] of [['k', p.k], ['dmg', Math.round(p.dmg || 0)], ['ring', p.ring]]) if ((v || 0) > (c.best[k] || 0)) c.best[k] = v;
    c.els = c.els || {}; c.els[p.el] = (c.els[p.el] || 0) + 1;
  } else { add('matches', 1); if (rec.win === team) add('matchWins', 1); }
  c.bull = (u.ach.stats && u.ach.stats.bull) || 0;
}
function makeJob() {
  const n = rnd() < 0.5 ? 1 : rnd() < 0.7 ? 2 : 3;
  const head = pick(players), near = players.filter(p => p !== head).sort((a, b) => Math.abs(a.career.elo - head.career.elo) - Math.abs(b.career.elo - head.career.elo)).slice(0, 10);
  const chosen = [head]; while (chosen.length < 2 * n) { const c = pick(near); if (!chosen.includes(c)) chosen.push(c); }
  chosen.sort(() => rnd() - 0.5);
  const spec = p => { const l = loadoutOf(p); return { i: p.i, name: p.name, skill: p.ai.skill, el: l[0], ro: l[1], aggr: p.ai.aggr, style: p.ai.style }; };
  return { map: pick(Sim.MAP_KEYS), teams: { red: chosen.slice(0, n).map(spec), blue: chosen.slice(n).map(spec) } };
}
function runBatch(jobs) {
  const half = Math.ceil(jobs.length / 2);
  return Promise.all([jobs.slice(0, half), jobs.slice(half)].map(part => new Promise(res => {
    const c = fork(__filename, ['worker']); c.on('message', m => { res(m); c.kill(); }); c.send(part);
  }))).then(a => a.flat());
}
// The simulation gives everyone a thousand-odd games, far more than real players have. Keep the ratings it settled on,
// but scale each career down to a believable size (40 to ~800 games), and redo the achievements from the scaled stats:
// the one-off feats (clutches, streaks) survive in proportion. Then most wear their best achievement as title and border.
function finish(list) {
  for (const p of list) {
    const f = 0.04 + rnd() * rnd() * 0.6, c = p.career, sc = v => Math.max(0, Math.round(v * f));
    for (const k of ['games', 'wins', 'kills', 'deaths', 'ring', 'shots', 'hits', 'matches', 'matchWins']) if (c[k] != null) c[k] = sc(c[k]);
    if (c.dmg != null) c.dmg = Math.round(c.dmg * f);
    for (const o of [c.roles, c.roleW, c.els]) if (o) for (const k in o) o[k] = sc(o[k]);
    c.wins = Math.min(c.wins, c.games); c.matchWins = Math.min(c.matchWins || 0, c.matches || 0);
    const st = p.ach.stats || {}, keepFlag = Math.min(1, f * 3), ns = {};
    for (const [k, v] of Object.entries(st)) ns[k] = ['clutch', 'clutch3', 'streak5', 'streak10', 'emp'].includes(k) ? (rnd() < keepFlag ? v : 0) : sc(v);
    p.ach = { stats: ns, got: {} };
    for (const [k, a] of Object.entries(Sim.ACHIEVEMENTS)) if ((ns[a.stat] || 0) >= a.goal) p.ach.got[k] = p.created + Math.floor(rnd() * (Date.now() - p.created));
    c.bull = ns.bull || 0;
    const got = Sim.ACH_ORDER.filter(k => p.ach.got[k]);
    p.title = got.length && rnd() < 0.6 ? got[Math.floor(rnd() * Math.min(2, got.length))] : null;
    if (got.length && rnd() < 0.7) p.ach.border = got[Math.floor(rnd() * Math.min(3, got.length))];
  }
}
if (process.argv[2] === '--finish') { // redo just the last step on the saved list
  const file = path.join(__dirname, '..', 'lib', 'ai-players.json'), list = JSON.parse(fs.readFileSync(file));
  finish(list); fs.writeFileSync(file, JSON.stringify(list)); console.log('done'); return;
}
(async () => {
  const total = +process.argv[2] || 1400, t0 = Date.now();
  for (let done = 0; done < total; done += 16) {
    const results = await runBatch(Array.from({ length: 16 }, makeJob));
    for (const r of results) {
      const byPid = pid => players[r.seat[pid]];
      for (const rec of r.recs) {
        if (rec.type === 'game') {
          const users = new Map(rec.p.map(p => [p.id, byPid(p.id)]).filter(x => x[1]).map(([pid, u]) => [pid, Object.assign(u, { id: u.i })]));
          const rated = rateGame(rec, users);
          for (const p of rec.p) { const u = byPid(p.id); if (u) careerAdd(u, { type: 'game', pl: p }); }
          for (const u of users.values()) { const x = rated.get(u.id); if (!x) continue; u.career.elo = x.elo; u.career.eloPeak = Math.max(u.career.eloPeak || 1000, x.elo); u.career.relo = u.career.relo || {}; u.career.relo[x.role] = x.roleElo; }
        } else if (rec.type === 'match') {
          for (const [pid, i] of Object.entries(r.seat)) careerAdd(players[i], rec, r.teams[pid]);
        }
      }
      for (const [i, adds] of Object.entries(r.ach)) Sim.achApply(players[i].ach, adds);
    }
    if (done % 160 === 0) console.log(`${done + 16}/${total} matches, ${Math.round((Date.now() - t0) / 1000)}s`);
  }
  finish(players);
  const out = players.map(({ i, ...p }) => { delete p.id; p.career.elo = Math.round(p.career.elo); return p; });
  fs.writeFileSync(path.join(__dirname, '..', 'lib', 'ai-players.json'), JSON.stringify(out));
  const s = out.slice().sort((a, b) => b.career.elo - a.career.elo);
  console.log('top', s.slice(0, 6).map(p => `${p.name} ${p.career.elo} (skill ${p.ai.skill}, ${p.career.games} games)`).join(', '));
  console.log('bottom', s.slice(-4).map(p => `${p.name} ${p.career.elo} (skill ${p.ai.skill})`).join(', '));
})();
