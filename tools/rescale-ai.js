// Re-sizes the saved AI players' careers (lib/ai-players.json) so games and level follow rating, and adds any players
// in EXTRA that aren't there yet: a newcomer's career is modelled on the saved player closest in skill, so it fits
// without re-running the whole simulation. Run: node tools/rescale-ai.js
'use strict';
const path = require('path'), fs = require('fs');
const Sim = require('../public/sim.js');
const { scaleCareers } = require('../lib/ai-scale');
const { TONES } = require('../lib/ai-chat');
let seed = 20260927;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const pick = a => a[Math.floor(rnd() * a.length)];
const ELS = Object.keys(Sim.ELEMENTS), ROS = Object.keys(Sim.ROLES), STY = Object.keys(Sim.STYLES);
// players to add: name, country, skill (0..1), and optional tone
const EXTRA = [
  { name: 'Strelok_', country: 'ru', skill: 0.88, tone: 'cocky' },
  { name: 'Vanya_Volkov', country: 'ru', skill: 0.66 },
  { name: 'medved88', country: 'ru', skill: 0.47 },
  { name: 'Katyusha_', country: 'ru', skill: 0.74 },
  { name: 'Zhenya_K', country: 'ru', skill: 0.36 },
  { name: 'kotik_uwu', country: 'ru', skill: 0.29 },
  { name: 'Ded_Moroz', country: 'ru', skill: 0.58, tone: 'quiet' },
  { name: 'Anya_Sokol', country: 'ua', skill: 0.7 },
  { name: 'Oleg_TT', country: 'ru', skill: 0.53 },
];
const file = path.join(__dirname, '..', 'lib', 'ai-players.json');
const list = JSON.parse(fs.readFileSync(file));
const have = new Set(list.map(p => p.name.toLowerCase()));
for (const x of EXTRA) {
  if (have.has(x.name.toLowerCase())) continue;
  const near = list.slice().sort((a, b) => Math.abs(a.ai.skill - x.skill) - Math.abs(b.ai.skill - x.skill)).slice(0, 4);
  const model = pick(near), mc = model.career;
  const main = [pick(ELS), pick(ROS)], loadouts = [[...main, Math.round((0.55 + rnd() * 0.3) * 100) / 100]];
  for (let k = 0, n = 1 + Math.floor(rnd() * 3), tries = 0; k < n && tries < 30; tries++) {
    const l = [rnd() < 0.5 ? main[0] : pick(ELS), rnd() < 0.4 ? main[1] : pick(ROS), Math.round((0.1 + rnd() * 0.25) * 100) / 100];
    if (!loadouts.some(o => o[0] === l[0] && o[1] === l[1])) { loadouts.push(l); k++; }
  }
  const tone = x.tone || (rnd() < 0.15 ? 'quiet' : pick(TONES.filter(t => t !== 'quiet')));
  const chat = tone === 'quiet' ? 0.08 : Math.round(Math.min(1, 0.15 + rnd() * rnd() * 1.2) * 100) / 100;
  const jit = () => 0.85 + rnd() * 0.3;
  const games = Math.max(20, Math.round(mc.games * jit()));
  const wr = (mc.wins / Math.max(1, mc.games)) * (0.9 + rnd() * 0.2);
  const per = k => (mc[k] || 0) / Math.max(1, mc.games);
  const career = {
    elo: Math.round(mc.elo + (rnd() - 0.5) * 120), games, wins: Math.min(games, Math.round(games * wr)),
    kills: Math.round(games * per('kills') * jit()), deaths: Math.round(games * per('deaths') * jit()), dmg: Math.round(games * per('dmg') * jit()),
    ring: Math.round(games * per('ring') * jit()), shots: Math.round(games * per('shots') * jit()), hits: Math.round(games * per('hits') * jit()),
    matches: Math.max(1, Math.round(games / 14)), best: { k: Math.max(1, Math.round((mc.best || {}).k || 1)), dmg: Math.round(((mc.best || {}).dmg || 200) * jit()), ring: Math.round((mc.best || {}).ring || 0) },
    roles: {}, roleW: {}, els: {}, relo: {},
  };
  career.matchWins = Math.min(career.matches, Math.round(career.matches * wr));
  career.eloPeak = career.elo + Math.round(rnd() * 60);
  const tot = loadouts.reduce((s, l) => s + l[2], 0);
  for (const l of loadouts) {
    const g = Math.round(games * l[2] / tot), w = Math.round(g * wr);
    career.roles[l[1]] = (career.roles[l[1]] || 0) + g; career.roleW[l[1]] = (career.roleW[l[1]] || 0) + w; career.els[l[0]] = (career.els[l[0]] || 0) + g;
    career.relo[l[1]] = Math.round(career.elo + (rnd() - 0.5) * 80);
  }
  const ms = (model.ach && model.ach.stats) || {}, stats = {};
  for (const [k, v] of Object.entries(ms)) stats[k] = Math.round(v * games / Math.max(1, mc.games) * jit());
  const created = Date.now() - Math.floor(rnd() * 60) * 86400000;
  list.push({ name: x.name, country: x.country, ai: { skill: x.skill, loadouts, style: rnd() < 0.25 ? pick(STY) : null, aggr: Math.round((0.2 + rnd() * 0.8) * 100) / 100, tone, chat },
    career, ach: { stats, got: {}, tier: {}, v: 2 }, created, title: null });
  console.log(`added ${x.name} (${x.country}) skill ${x.skill}, modelled on ${model.name} (${mc.elo})`);
}
scaleCareers(list, rnd);
fs.writeFileSync(file, JSON.stringify(list));
const { levelOf } = require('../lib/level');
const s = list.slice().sort((a, b) => b.career.elo - a.career.elo);
console.log(s.map((p, i) => `${i + 1}. ${p.name} ${p.country} elo ${p.career.elo} games ${p.career.games} level ${levelOf(p.career).lv}`).join('\n'));
