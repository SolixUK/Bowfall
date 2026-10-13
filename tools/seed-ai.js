// Builds lib/ai-players.json: matchmaking's AI players, with ratings, stats and achievements earned by playing thousands
// of simulated matches against each other (so their ratings settle where their skill puts them).
//
// Each player starts from a way they like to play (long shots from a distance, brawling up close, sneaking, holding the
// line) and picks roles that suit it, with traits of their own: cover ducking, hunting the edge, how freely they dash,
// quick shots or full draws. Then they learn: while the matches run, each tries a small change to how they play half the
// time (a trait, their aggression, a different second archetype, a planning weight) and keeps it if it wins more. So
// what you meet in ranked is what worked for *them*, not one brain with the sliders moved.
//
// Run: node tools/seed-ai.js [matches] [--region eu|na] [--report]
//   about 25 minutes for 2400 matches on two cores. --report also writes tools/balance-report.md (role, element and
//   upgrade win rates over the run), which is the cheapest balance check we have.
//   node tools/seed-ai.js --finish   redoes just the sizing step on the saved list
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
        Sim.setBotMind(w, b.id, { style: s.style, aggr: s.aggr, tr: s.tr, gene: s.gene });
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
      return { seat, teams, recs, ach, variant: job.variant };
    });
    process.send(out);
  });
  return;
}

const { rateGame } = require('../lib/rating');
const chat = require('../lib/ai-chat');
const args = process.argv.slice(2);
const REGION = args.includes('--region') ? args[args.indexOf('--region') + 1] : 'eu'; const WANT_REPORT = args.includes('--report');
let seed = REGION === 'eu' ? 20260925 : 20261013;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const pick = a => a[Math.floor(rnd() * a.length)];
const R2 = x => Math.round(x * 100) / 100;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---- who they are: names people actually pick, and where they're from
const REGIONS = {
  eu: {
    file: 'ai-players.json',
    names: ['Fletchling', 'QuiverQueen', 'xNocturnex', 'tired_archer', 'BowDown99', 'sn1pez', 'mattyb_22', 'Kiwi_Kicks', 'GoblinMode', 'SirPokesALot',
      'ArrowDynamic', 'lilbrambles', 'Vexx', 'soupy_', 'ThatOneSniper', 'hazel_nut', 'R3dFeather', 'DashDashBoom', 'moonpie77', 'Quillion',
      'PitStop', 'knockbackkid', 'Beansprout', 'Wraith_07', 'sadbowboy', 'TheRealFrost', 'Cptn_Crossbow', 'EmberLynx', 'nofunallowed', 'PebbleDasher',
      'zenith', 'fox_in_socks', 'Grumblebow', 'Stormy_Jo', 'lagspike', 'PixelArrow', 'ohnoitsjake', 'Marigold_', 'Ricochet_Rae', 'SaltyDog44',
      'Honeybadger', 'kappa_kev', 'LowKeyLethal', 'WaffleIron', 'bowtie', 'Nyx_', 'CrispyNoodle', 'archie', 'VoidWalker13', 'slippers',
      'tootsie', 'BigYew', 'Yew_Know_It', 'dizzy_d', 'TeaAndArrows', 'Shazam_7', 'ellie_bellie', 'Grimsby', 'tryhard_tim', 'Mochi',
      'Strelok_', 'Vanya_Volkov', 'medved88', 'Katyusha_', 'Zhenya_K', 'kotik_uwu', 'Ded_Moroz', 'Anya_Sokol', 'Oleg_TT',
      // more, so a regular doesn't keep meeting the same twenty people
      'Noodle_Arms', 'benji', 'Thistle', 'xX_Reaper_Xx', 'cosmo_k', 'ToastMalone', 'AimAssistOff', 'Frosty_Pants', 'luna.exe', 'DadBod_Dan',
      'Pickle_Rick42', 'Skadi', 'Wyvern', 'potato_aim', 'Bramblewick', 'JustTom', 'hollowpoint', 'Marzipan', 'Sorrel', 'Barnaby_B',
      'ElkeTheElk', 'tinyviolin', 'StoneColdSteve', 'MeadowLark', 'Fenwick', 'gh0st', 'Pumpernickel', 'Lotte_', 'rainyday', 'Bartek_PL',
      'Kasia_', 'Mateusz99', 'Jonas_dk', 'Freja', 'Sven_Svensson', 'Ollie_', 'Lars_', 'Anouk', 'Thijs_', 'Pieter_V',
      'Giulia_', 'Matteo.', 'Luca_C', 'Hugo_', 'Camille_', 'Th3o', 'Mathis', 'Leonie', 'Finn_', 'Jannik',
      'Diogo_', 'Ines_', 'Tiago_PT', 'Pablo_', 'Sofia_', 'Nikos_', 'Eleni', 'Adrian_RO', 'Bence', 'Zoe_',
      'Aoife', 'Cian_', 'Padraig', 'Eilidh', 'Rhys_W', 'Gethin', 'Siobhan', 'Callum_', 'Isla', 'Fraser_',
      'Dmitry_K', 'Sasha_', 'Nastya', 'Kirill', 'Lena_', 'Artem_', 'Pasha', 'Vlad_', 'Masha', 'Oksana_UA'],
    // the Russian-speaking players: their country goes with the name
    byName: { Strelok_: 'ru', Vanya_Volkov: 'ru', medved88: 'ru', Katyusha_: 'ru', Zhenya_K: 'ru', Ded_Moroz: 'ru', Anya_Sokol: 'ua', Oleg_TT: 'ru', kotik_uwu: 'ru',
      Dmitry_K: 'ru', Sasha_: 'ru', Nastya: 'ru', Kirill: 'ru', Lena_: 'ru', Artem_: 'ru', Pasha: 'ru', Vlad_: 'ua', Masha: 'ru', Oksana_UA: 'ua',
      Bartek_PL: 'pl', Kasia_: 'pl', Mateusz99: 'pl', Jonas_dk: 'dk', Freja: 'dk', Sven_Svensson: 'se', Ollie_: 'se', Lars_: 'no', Anouk: 'nl', Thijs_: 'nl', Pieter_V: 'be',
      Giulia_: 'it', 'Matteo.': 'it', Luca_C: 'ch', Hugo_: 'fr', Camille_: 'fr', Th3o: 'fr', Mathis: 'fr', Leonie: 'de', Finn_: 'de', Jannik: 'de', ElkeTheElk: 'de', Lotte_: 'nl',
      Diogo_: 'pt', Ines_: 'pt', Tiago_PT: 'pt', Pablo_: 'es', Sofia_: 'es', Nikos_: 'gr', Eleni: 'gr', Adrian_RO: 'ro', Bence: 'hu', Zoe_: 'at',
      Aoife: 'ie', Cian_: 'ie', Padraig: 'ie', Eilidh: 'gb', Rhys_W: 'gb', Gethin: 'gb', Siobhan: 'ie', Callum_: 'gb', Isla: 'gb', Fraser_: 'gb', Skadi: 'is', Freja_: 'dk' },
    cc: ['gb', 'gb', 'gb', 'de', 'de', 'fr', 'fr', 'se', 'pl', 'nl', 'es', 'it', 'no', 'ie', 'fi', 'dk', 'pt', 'be', 'at', 'cz', 'ch', 'gr', 'ro', 'hu', 'hr', 'rs', 'sk', 'bg', 'ee', 'lt', 'lv'],
  },
  na: {
    file: 'ai-players-na.json',
    names: ['BigTexArcher', 'Jaxon_', 'kayla.b', 'YeetArrow', 'Dakota_', 'MapleMoose', 'Cody_W', 'brooklyn_', 'Tyler1Fan', 'Savannah_',
      'Hunter_K', 'MadisonAve', 'Chad_', 'ChrisP_Bacon', 'Jorge_MX', 'Valentina_', 'Diego_', 'Mateo_', 'Camila_R', 'Santiago_',
      'Aiden_', 'Logan_', 'Ryder', 'Zoey_', 'Liam_O', 'Olivia_', 'noah.', 'ava_', 'Ethan_', 'Mia_',
      'Lucas_', 'Charlotte_', 'Mason_', 'Amelia_', 'Elijah_', 'Harper_', 'James_', 'Evelyn_', 'Ben_', 'Abigail_',
      'tacobell_tim', 'DunkinDave', 'HockeyHal', 'Poutine_', 'Timbit', 'Yukon_', 'Saskatoon', 'Bayou_Bob', 'CornDog', 'FreedomFries',
      'xXSniperXx', 'Ghost_', 'Reaper_', 'Nova_', 'Blaze_', 'Shadow_', 'Phoenix_', 'Titan_', 'Viper_', 'Storm_',
      'Alejandro_', 'Isabella_', 'Daniel_', 'Sofia_MX', 'Gabriel_', 'Valeria_', 'Emiliano', 'Regina_', 'Nicolas_', 'Ximena_',
      'TheRealDeal', 'NotABot_', 'ClutchKing', 'Cracked_', 'Washed', 'Bronze4Life', 'SilverSurfer', 'DiamondHands', 'Lefty_', 'Grandma_Gunz',
      'oldschool', 'chill_bill', 'Cheeto_', 'Waffle_House', 'Sasquatch', 'Bigfoot_', 'Moosejaw', 'Cactus_Jack', 'Tumbleweed', 'Coyote_',
      'Ash_', 'Rowan_', 'Sage_', 'River_', 'Sky_', 'Quinn_', 'Avery_', 'Jordan_', 'Taylor_', 'Casey_',
      'Felipe_BR', 'Larissa_', 'Thiago_BR', 'Bruna_', 'Rafael_', 'Juliana_', 'Gustavo_', 'Beatriz_', 'Pedro_H', 'Mariana_',
      'Sam_', 'Alex_', 'Jamie_', 'Drew_', 'Reese_', 'Shane_', 'Blake_', 'Dylan_', 'Kai_', 'Jesse_',
      'Connor_', 'Hailey_', 'Brayden', 'Kaylee', 'Landon_', 'Peyton_', 'Carter_', 'Addison_', 'Wyatt_', 'Brooke_',
      'Austin_TX', 'Phoenix_AZ', 'Denver_', 'Portland_', 'Memphis_', 'Dallas_', 'Boston_', 'Vegas_', 'Orlando_', 'Seattle_',
      'Trevor_', 'Mackenzie', 'Hudson_', 'Paisley', 'Grayson', 'Nora_', 'Lincoln_', 'Aubrey_', 'Jaxson', 'Scarlett_'],
    byName: { Jorge_MX: 'mx', Valentina_: 'mx', Diego_: 'mx', Mateo_: 'mx', Camila_R: 'mx', Santiago_: 'mx', Alejandro_: 'mx', Isabella_: 'mx', Daniel_: 'mx', Sofia_MX: 'mx', Gabriel_: 'mx', Valeria_: 'mx', Emiliano: 'mx', Regina_: 'mx', Nicolas_: 'mx', Ximena_: 'mx',
      Felipe_BR: 'br', Larissa_: 'br', Thiago_BR: 'br', Bruna_: 'br', Rafael_: 'br', Juliana_: 'br', Gustavo_: 'br', Beatriz_: 'br', Pedro_H: 'br', Mariana_: 'br',
      MapleMoose: 'ca', Poutine_: 'ca', Timbit: 'ca', Yukon_: 'ca', Saskatoon: 'ca', HockeyHal: 'ca', Moosejaw: 'ca', DunkinDave: 'us' },
    cc: ['us', 'us', 'us', 'us', 'us', 'us', 'ca', 'ca', 'mx'],
  },
};
const RG = REGIONS[REGION]; if (!RG) { console.log('unknown region'); process.exit(1); }
const LANG_EXTRA = { mx: 'es', br: 'pt', us: null, ca: null };

// ---- how they play: a playstyle first, then roles that suit it; the premium archetypes mostly at the top of the ladder
const STYLE_ROLES = { marksman: ['sniper', 'sniper', 'ranger', 'warden'], brawler: ['juggernaut', 'juggernaut', 'ranger', 'crossbow'], skirmisher: ['ranger', 'ranger', 'trickster', 'crossbow', 'warden'], guardian: ['warden', 'trapper', 'trapper'], stalker: ['assassin', 'ninja'] };
const TIER_RO = { ranger: 0, sniper: 1, juggernaut: 1, warden: 2, trickster: 2, trapper: 2, assassin: 3, ninja: 3, crossbow: 3 };
const TIER_EL = { frost: 0, flame: 0, storm: 0, poison: 2, stone: 2, void: 3, shadow: 3, blood: 3 };
// the most they'd plausibly have unlocked, by how good they are (a top player has everything; a new one the starters)
const maxTier = skill => skill < 0.18 ? 1 : skill < 0.42 ? 2 : 3;
// a chance per tier, so lower tiers stay the common sight even among those who have more
const tierOk = (tier, mt) => tier <= mt && (tier === 0 || rnd() < (tier === 1 ? 0.8 : tier === 2 ? 0.6 : 0.45));
function rolesFor(style, skill) {
  const mt = maxTier(skill), list = STYLE_ROLES[style].filter(r => tierOk(TIER_RO[r], mt));
  return list.length ? list : ['ranger'];
}
function elFor(skill) { const mt = maxTier(skill), els = Object.keys(TIER_EL).filter(e => tierOk(TIER_EL[e], mt)); return pick(els.length ? els : ['frost', 'flame', 'storm']); }
// traits that go with a style, then each person's own slant on them
const STYLE_TR = { marksman: { cover: 0.45, edge: 0.3, dash: 0.3, charge: 0.4 }, brawler: { cover: 0.05, edge: 0.45, dash: 0.8, charge: -0.3 }, skirmisher: { cover: 0.25, edge: 0.3, dash: 0.55, charge: 0 }, guardian: { cover: 0.2, edge: 0.5, dash: 0.35, charge: 0.1 }, stalker: { cover: 0.15, edge: 0.4, dash: 0.75, charge: 0.1 } };
const jit = (v, a, lo, hi) => R2(clamp(v + (rnd() + rnd() - 1) * a, lo, hi));

const STYLES = ['skirmisher', 'skirmisher', 'skirmisher', 'marksman', 'marksman', 'brawler', 'brawler', 'guardian', 'stalker', 'stalker'];
const players = RG.names.map((name, i) => {
  // skill: most in the range new players meet, a long tail of good ones, a few who can't aim at all
  const u = rnd();
  const skill = R2(clamp(u < 0.1 ? 0.03 + rnd() * 0.14 : u < 0.55 ? 0.15 + rnd() * 0.3 : u < 0.8 ? 0.45 + rnd() * 0.2 : u < 0.95 ? 0.65 + rnd() * 0.25 : 0.9 + rnd() * 0.1, 0.03, 1));
  const style = pick(STYLES);
  const roles = rolesFor(style, skill);
  const main = [elFor(skill), pick(roles)], n = rnd() < 0.3 ? 0 : 1 + Math.floor(rnd() * 2); // a main archetype and up to two others they like
  const loadouts = [[...main, R2(0.6 + rnd() * 0.3)]];
  for (let k = 0, tries = 0; k < n && tries < 30; tries++) {
    const l = [rnd() < 0.5 ? main[0] : elFor(skill), rnd() < 0.35 ? main[1] : pick(roles), R2(0.1 + rnd() * 0.25)];
    if (!loadouts.some(o => o[0] === l[0] && o[1] === l[1])) { loadouts.push(l); k++; }
  }
  const T = STYLE_TR[style], tr = { cover: jit(T.cover, 0.5, 0, 1), edge: jit(T.edge, 0.5, 0, 1), dash: jit(T.dash, 0.5, 0, 1), charge: jit(T.charge, 0.6, -1, 1) };
  const aggr = R2(clamp((style === 'brawler' ? 0.75 : style === 'marksman' ? 0.35 : style === 'stalker' ? 0.65 : 0.5) + (rnd() + rnd() - 1) * 0.4, 0.15, 1));
  // personality: most chat now and then, a few never shut up, a few barely speak
  const tone = rnd() < 0.18 ? 'quiet' : pick(chat.TONES.filter(t => t !== 'quiet'));
  const chatty = tone === 'quiet' ? R2(0.03 + rnd() * 0.07) : R2(Math.min(1, 0.1 + rnd() * rnd() * 1.1));
  const country = RG.byName[name] || pick(RG.cc);
  const lang = LANG_EXTRA[country] !== undefined ? LANG_EXTRA[country] : chat.LANG[country] || null;
  const quirk = { caps: rnd() < 0.25 ? 1 : 0, punct: rnd() < 0.3 ? 1 : 0, typo: R2(rnd() < 0.5 ? 0.03 : 0.04 + rnd() * 0.12), excl: R2(0.05 + rnd() * 0.3), native: lang ? R2(0.15 + rnd() * 0.35) : 0, mash: R2(tone === 'salty' ? 0.25 + rnd() * 0.2 : tone === 'cocky' ? 0.1 + rnd() * 0.15 : rnd() * 0.08), lang };
  const calm = R2(clamp((tone === 'salty' ? 0.15 : tone === 'cocky' ? 0.35 : tone === 'wholesome' || tone === 'chill' ? 0.85 : 0.6) + (rnd() - 0.5) * 0.3, 0.05, 1));
  // the smart brain's weights, for those sharp enough to use it: their own balance of safety, pushing and movement
  const gene = skill >= 0.6 ? { push: R2(0.7 + rnd() * 0.8), safety: R2(0.7 + rnd() * 0.8), jink: R2(0.3 + rnd() * 0.5) } : null;
  return { i, name, country, ai: { skill, loadouts, style, aggr, tr, gene, tone, chat: chatty, quirk, calm },
    career: { elo: 1000 }, ach: {}, created: Date.now() - Math.floor(rnd() * 60) * 86400000,
    // learning: the change they're trying out, and how each version has been doing
    trial: null, trialW: 0, trialN: 0, baseW: 0, baseN: 0, learned: [] };
});
const loadoutOf = (p, ai) => { const L = ai.loadouts, tot = L.reduce((s, l) => s + l[2], 0); let r = rnd() * tot; for (const l of L) { if ((r -= l[2]) <= 0) return l; } return L[0]; };

// ---- learning: one small change at a time, tried in half their games, kept when it wins more
function mutate(p) {
  const a = JSON.parse(JSON.stringify(p.ai)), what = pick(['aggr', 'cover', 'edge', 'dash', 'charge', 'weights', 'second', 'second', a.gene ? 'gene' : 'aggr']);
  let note = what;
  if (what === 'aggr') { a.aggr = jit(a.aggr, 0.3, 0.15, 1); note = `aggression ${p.ai.aggr} → ${a.aggr}`; }
  else if (what === 'cover' || what === 'edge' || what === 'dash') { a.tr[what] = jit(a.tr[what], 0.5, 0, 1); note = `${what} ${p.ai.tr[what]} → ${a.tr[what]}`; }
  else if (what === 'charge') { a.tr.charge = jit(a.tr.charge, 0.6, -1, 1); note = `charge ${p.ai.tr.charge} → ${a.tr.charge}`; }
  else if (what === 'weights' && a.loadouts.length > 1) { const k = 1 + Math.floor(rnd() * (a.loadouts.length - 1)), d = R2((rnd() - 0.5) * 0.3); a.loadouts[0][2] = R2(clamp(a.loadouts[0][2] - d, 0.3, 0.95)); a.loadouts[k][2] = R2(clamp(a.loadouts[k][2] + d, 0.05, 0.6)); note = `plays ${a.loadouts[k][0]} ${a.loadouts[k][1]} ${d > 0 ? 'more' : 'less'}`; }
  else if (what === 'second') { // another archetype to try alongside the main: same style, within what they'd have unlocked
    const roles = rolesFor(a.style, a.skill), l = [elFor(a.skill), pick(roles), R2(0.15 + rnd() * 0.2)];
    if (a.loadouts.some(o => o[0] === l[0] && o[1] === l[1])) return mutate(p);
    if (a.loadouts.length >= 3) a.loadouts[a.loadouts.length - 1] = l; else a.loadouts.push(l);
    note = `tries ${l[0]} ${l[1]}`;
  } else if (what === 'gene') { const k = pick(['push', 'safety', 'jink', 'quick', 'mid']), v = a.gene[k] != null ? a.gene[k] : { push: 1, safety: 1, jink: 0.5, quick: 0.45, mid: 0.8 }[k]; a.gene[k] = jit(v, k === 'jink' ? 0.3 : 0.4, 0.2, 2); note = `${k} ${v} → ${a.gene[k]}`; }
  else return mutate(p);
  return { ai: a, note };
}
function learnStep(p, log) {
  if (!p.trial) { p.trial = mutate(p); p.trialW = p.trialN = p.baseW = p.baseN = 0; return; }
  if (p.trialN < 12 || p.baseN < 12) return;
  const tw = p.trialW / p.trialN, bw = p.baseW / p.baseN;
  if (tw > bw + 0.05) { log.push(`${p.name} (skill ${p.ai.skill}) kept: ${p.trial.note} (${Math.round(tw * 100)}% vs ${Math.round(bw * 100)}% over ${p.trialN}+${p.baseN} games)`); p.learned.push(p.trial.note); p.ai = p.trial.ai; p.trial = null; }
  else if (p.trialN >= 28) p.trial = null; // no better: drop it and try something else next time
}

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
  const head = pick(players), near = players.filter(p => p !== head).sort((a, b) => Math.abs(a.career.elo - head.career.elo) - Math.abs(b.career.elo - head.career.elo)).slice(0, 12);
  const chosen = [head]; while (chosen.length < 2 * n) { const c = pick(near); if (!chosen.includes(c)) chosen.push(c); }
  chosen.sort(() => rnd() - 0.5);
  const variant = {};
  const spec = p => { const trial = p.trial && rnd() < 0.5, ai = trial ? p.trial.ai : p.ai, l = loadoutOf(p, ai); variant[p.i] = trial ? 1 : 0; return { i: p.i, name: p.name, skill: ai.skill, el: l[0], ro: l[1], aggr: ai.aggr, style: ai.style, tr: ai.tr, gene: ai.gene }; };
  return { map: pick(Sim.MAP_KEYS), teams: { red: chosen.slice(0, n).map(spec), blue: chosen.slice(n).map(spec) }, variant };
}
function runBatch(jobs) {
  const half = Math.ceil(jobs.length / 2);
  return Promise.all([jobs.slice(0, half), jobs.slice(half)].map(part => new Promise(res => {
    const c = fork(__filename, ['worker']); c.on('message', m => { res(m); c.kill(); }); c.send(part);
  }))).then(a => a.flat());
}
// ---- the balance tally: who wins with what
const TALLY = { role: {}, el: {}, combo: {}, card: {}, games: 0 };
const bump = (o, k, w) => { const t = o[k] || (o[k] = { n: 0, w: 0 }); t.n++; t.w += w; };
function tally(rec) {
  TALLY.games++;
  for (const p of rec.p) { const w = p.w === 1 ? 1 : 0; bump(TALLY.role, p.ro, w); bump(TALLY.el, p.el, w); bump(TALLY.combo, p.el + ' ' + p.ro, w); for (const c of p.up || []) bump(TALLY.card, c, w); }
}
function report(log) {
  const rows = (o, min) => Object.entries(o).filter(([, t]) => t.n >= min).map(([k, t]) => ({ k, n: t.n, wr: t.w / t.n })).sort((a, b) => b.wr - a.wr);
  const fmt = (list, head) => `| ${head} | Games | Win rate |\n| --- | --- | --- |\n` + list.map(r => `| ${r.k} | ${r.n} | ${Math.round(r.wr * 100)}% |`).join('\n');
  const cards = rows(TALLY.card, 60);
  let md = `# Balance report\n\nFrom ${TALLY.games} simulated games between the AI players (Bowfall ${Sim.VERSION}, ${new Date().toISOString().slice(0, 10)}). A win rate is the share of games won by everyone who played that role, element or upgrade; 50% is even. Matches are made between players of similar rating, so a role's number says how it does in the hands of the people who pick it, and an upgrade's how games went when it was taken.\n\n## Roles\n\n${fmt(rows(TALLY.role, 1), 'Role')}\n\n## Elements\n\n${fmt(rows(TALLY.el, 1), 'Element')}\n\n## Combinations (40+ games)\n\n${fmt(rows(TALLY.combo, 40), 'Element and role')}\n\n## Upgrades: strongest (60+ games)\n\n${fmt(cards.slice(0, 15), 'Upgrade')}\n\n## Upgrades: weakest\n\n${fmt(cards.slice(-15).reverse(), 'Upgrade')}\n\n## What the AI players learned\n\n${log.length ? log.map(l => '- ' + l).join('\n') : '- nothing kept this run'}\n`;
  fs.writeFileSync(path.join(__dirname, 'balance-report.md'), md);
}
// The simulation gives everyone a thousand-odd games, far more than real players have. Keep the ratings it settled on,
// but size each career to match its rating (lib/ai-scale.js: the better the rating, the more games and the higher the level),
// filling in the achievements someone with that record would have. Then most wear their best achievement as title and border.
const { scaleCareers } = require('../lib/ai-scale');
// The simulation's ratings are zero-sum around 1000 and, with a few dozen matches each, bunch up (700 to 1300 for skills
// from 0.03 to 1). Real players are seeded from the tutorial's scale (SKILL_ELO in public/index.html: what a bot of each
// skill is worth in rating, measured against the AI players), so the list is anchored to it: half that scale's figure for
// their skill, half their simulated rating stretched onto it (a least-squares fit), so what they showed still counts.
// Keep the table the same as the page's.
const SKILL_ELO = [[0, 470], [0.1, 555], [0.2, 630], [0.3, 675], [0.42, 865], [0.55, 1140], [0.66, 1360], [0.78, 1545], [0.9, 1800], [1, 1850]];
function skillElo(s) { let i = 0; while (i < SKILL_ELO.length - 2 && s > SKILL_ELO[i + 1][0]) i++; const [a, ea] = SKILL_ELO[i], [b, eb] = SKILL_ELO[i + 1]; return ea + (eb - ea) * (s - a) / (b - a); }
function anchor(list) {
  const xs = list.map(p => p.career.elo), ys = list.map(p => skillElo(p.ai.skill));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0, sxx = 0; for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const f = sxx ? sxy / sxx : 1, c = my - f * mx;
  for (const p of list) { const e = Math.max(400, Math.round(0.5 * skillElo(p.ai.skill) + 0.5 * (f * p.career.elo + c))); p.career.elo = e; p.career.eloPeak = Math.max(e, Math.round(e + rnd() * 60)); if (p.career.relo) for (const k in p.career.relo) p.career.relo[k] = Math.round(e + (p.career.relo[k] - mx) * 0.3); }
}
function finish(list) { anchor(list); for (const p of list) { p.title = null; if (p.ach) p.ach.border = null; } scaleCareers(list, rnd); }
const FILE = path.join(__dirname, '..', 'lib', RG.file);
if (args[0] === '--finish') { // redo just the last step on the saved list
  const list = JSON.parse(fs.readFileSync(FILE));
  finish(list); fs.writeFileSync(FILE, JSON.stringify(list)); console.log('done'); return;
}
(async () => {
  const total = +args[0] || 2400, t0 = Date.now(), log = [];
  for (let done = 0; done < total; done += 16) {
    const results = await runBatch(Array.from({ length: 16 }, makeJob));
    for (const r of results) {
      const byPid = pid => players[r.seat[pid]];
      for (const rec of r.recs) {
        if (rec.type === 'game') {
          tally(rec);
          for (const p of rec.p) { const u = byPid(p.id); if (!u) continue; careerAdd(u, { type: 'game', pl: p }); const w = p.w === 1 ? 1 : 0; if (r.variant[u.i]) { u.trialN++; u.trialW += w; } else { u.baseN++; u.baseW += w; } }
          r.roster = rec; // rated once the match is decided, like the server does
        } else if (rec.type === 'match') {
          if (r.roster && rec.win) {
            const ros = r.roster, users = new Map(ros.p.map(p => [p.id, byPid(p.id)]).filter(x => x[1]).map(([pid, u]) => [pid, Object.assign(u, { id: u.i })]));
            const rated = rateGame({ win: rec.win, df: ros.df, p: ros.p.map(p => Object.assign({}, p, { w: p.tm === rec.win ? 1 : 0 })) }, users);
            for (const u of users.values()) { const x = rated.get(u.id); if (!x) continue; u.career.elo = x.elo; u.career.eloPeak = Math.max(u.career.eloPeak || 1000, x.elo); u.career.relo = u.career.relo || {}; u.career.relo[x.role] = x.roleElo; }
          }
          for (const [pid, i] of Object.entries(r.seat)) careerAdd(players[i], rec, r.teams[pid]);
        }
      }
      for (const [i, adds] of Object.entries(r.ach)) Sim.achApply(players[i].ach, adds);
    }
    for (const p of players) learnStep(p, log);
    if (done % 160 === 0) console.log(`${done + 16}/${total} matches, ${Math.round((Date.now() - t0) / 1000)}s, ${log.length} things learned`);
  }
  finish(players);
  const out = players.map(({ i, trial, trialW, trialN, baseW, baseN, ...p }) => { delete p.id; p.career.elo = Math.round(p.career.elo); if (!p.learned.length) delete p.learned; return p; });
  fs.writeFileSync(FILE, JSON.stringify(out));
  if (WANT_REPORT) report(log);
  const s = out.slice().sort((a, b) => b.career.elo - a.career.elo);
  console.log('top', s.slice(0, 6).map(p => `${p.name} ${p.career.elo} (skill ${p.ai.skill}, ${p.career.games} games)`).join(', '));
  console.log('bottom', s.slice(-4).map(p => `${p.name} ${p.career.elo} (skill ${p.ai.skill})`).join(', '));
  const bands = [0, 600, 800, 1000, 1200, 1400, 9999]; console.log('by rating:', bands.slice(1).map((b, i) => `${bands[i]}-${b}: ${out.filter(p => p.career.elo >= bands[i] && p.career.elo < b).length}`).join(', '));
  console.log(`learned ${log.length} things; ${Math.round((Date.now() - t0) / 1000)}s`);
})();
