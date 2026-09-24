// Bowfall shared simulation. Runs on the server (authoritative) and in the browser (offline practice).
// Team rounds: Red vs Blue, last team standing wins the round, first to 5 rounds wins the match.
// Amber collected on the centre line buys upgrades in the shop that opens every 3 rounds.
(function (root, factory) {
  const Sim = factory();
  if (typeof module === 'object' && module.exports) module.exports = Sim;
  else root.BowSim = Sim;
})(typeof self !== 'undefined' ? self : this, function () {
'use strict';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;
const r3 = v => Math.round(v * 1000) / 1000;

// ---------------- arenas ----------------
// Each arena lists one half; mirror() adds the point-reflected copy, so Red (left) and Blue (right)
// always get identical halves. Items marked `centre` sit on the middle and aren't copied.
const AW = 1200, AH = 800, WALL = 26;
function mirrorItem(o) {
  if (o.w !== undefined) return Object.assign({}, o, { x: AW - o.x - o.w, y: AH - o.y - o.h });
  return Object.assign({}, o, { x: AW - o.x, y: AH - o.y });
}
const FLIP_SIDE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
function mirrorSpike(s) {
  const span = s.side === 'top' || s.side === 'bottom' ? AW : AH;
  return { side: FLIP_SIDE[s.side], a: span - s.b, b: span - s.a };
}
function buildMap(def) {
  const both = (list, fn) => list.flatMap(o => (o.centre ? [o] : [o, fn(o)]));
  return Object.assign({}, def, {
    haz: both(def.haz, mirrorItem),
    pillars: both(def.pillars, mirrorItem),
    spikes: def.spikes.flatMap(s => [s, mirrorSpike(s)]),
    cracks: (def.cracks || []).flatMap(c => [c, mirrorItem(c)]),
  });
}
const RED_SPAWNS = [{ x: 100, y: 345 }, { x: 100, y: 455 }, { x: 180, y: 400 }, { x: 95, y: 240 }];
const MAPS = {
  meadow: buildMap({
    name: 'Meadow', theme: 'meadow',
    desc: 'The original. Sinkholes, lava basins and bogs around two boulders.',
    haz: [
      { type: 'pit',  shape: 'rect',   x: 205, y: 125, w: 135, h: 150 },
      { type: 'lava', shape: 'circle', x: 275, y: 590, r: 80 },
      { type: 'tar',  shape: 'rect',   x: 520, y: 610, w: 160, h: 110 },
    ],
    pillars: [{ x: 440, y: 400, r: 30 }],
    spikes: [{ side: 'top', a: 420, b: 780 }, { side: 'left', a: 300, b: 500 }],
    power: [{ x: 600, y: 400 }], amberY: [WALL + 44, 330],
  }),
  spring: buildMap({
    name: 'Spring Hollow', theme: 'spring',
    desc: 'A healing spring in the middle, ringed by boulders. Hold it to recover, if you can.',
    heal: { x: 600, y: 400, r: 62, rate: 12 },
    haz: [
      { type: 'pit', shape: 'rect',   x: 410, y: 26,  w: 70,  h: 150 },
      { type: 'pit', shape: 'rect',   x: 250, y: 565, w: 110, h: 115 },
      { type: 'tar', shape: 'circle', x: 300, y: 175, r: 55 },
    ],
    pillars: [{ x: 600, y: 248, r: 24 }, { x: 455, y: 400, r: 26 }],
    spikes: [{ side: 'top', a: 520, b: 760 }, { side: 'left', a: 300, b: 500 }],
    power: [{ x: 600, y: 400 }], amberY: [WALL + 44, 330],
  }),
  rift: buildMap({
    name: 'Ember Rift', theme: 'rift',
    desc: 'A lava river splits the arena. Two bridges, no railings. Dash to jump the flow.',
    haz: [
      { type: 'lava', shape: 'rect', x: 570, y: WALL, w: 60, h: 190 - WALL },
      { type: 'lava', shape: 'rect', x: 570, y: 300, w: 60, h: 200, centre: true },
      { type: 'pit',  shape: 'rect', x: 200, y: 620, w: 120, h: 100 },
      { type: 'tar',  shape: 'circle', x: 260, y: 150, r: 50 },
    ],
    pillars: [{ x: 400, y: 210, r: 28 }, { x: 380, y: 560, r: 26 }],
    spikes: [{ side: 'top', a: 300, b: 500 }, { side: 'left', a: 300, b: 500 }],
    power: [{ x: 600, y: 245 }, { x: 600, y: 555 }], amberY: [205, 285],
  }),
  lake: buildMap({
    name: 'Frozen Lake', theme: 'ice',
    desc: 'Slick ice: you glide further and knockback sends archers sliding. The ice cracks from the edges inward as the game goes on.',
    // on ice you coast much further, turn wider and fly further when hit
    ice: { glide: 0.45, knock: 0.7, brake: 2.2, over: 3 },
    haz: [
      { type: 'pit', water: true, shape: 'circle', x: 310, y: 190, r: 58 },
      { type: 'pit', water: true, shape: 'rect', x: 545, y: WALL, w: 110, h: 64 },
      { type: 'tar', shape: 'rect', x: 225, y: 560, w: 150, h: 95 },
    ],
    pillars: [{ x: 470, y: 410, r: 26 }],
    spikes: [{ side: 'top', a: 260, b: 470 }],
    // thin ice: gives way this many seconds into a game (4 seconds of warning first)
    cracks: [
      { type: 'pit', water: true, shape: 'rect', x: WALL, y: WALL, w: 170, h: 130, at: 40 },
      { type: 'pit', water: true, shape: 'rect', x: WALL, y: AH - WALL - 130, w: 170, h: 130, at: 40 },
      { type: 'pit', water: true, shape: 'rect', x: 330, y: WALL, w: 200, h: 88, at: 70 },
      { type: 'pit', water: true, shape: 'rect', x: 330, y: AH - WALL - 88, w: 200, h: 88, at: 70 },
      { type: 'pit', water: true, shape: 'rect', x: WALL, y: 215, w: 92, h: 370, at: 95 },
    ],
    power: [{ x: 600, y: 400 }], amberY: [130, 330],
  }),
};
const CRACK_WARN = 4;
// custom game options; the first value of each is the default
const OPTIONS = {
  size:   { label: 'Archer size',  values: { small: 1, medium: 1.25, large: 1.5 } },
  aspeed: { label: 'Arrow speed',  values: { normal: 1, fast: 1.25, vfast: 1.5, blazing: 1.8 } },
  mspeed: { label: 'Move speed',   values: { normal: 1, slow: 0.85, fast: 1.2, vfast: 1.4, blazing: 1.7 } },
  kb:     { label: 'Knockback',    values: { normal: 1, low: 0.75, high: 1.3, chaos: 1.8 } },
  hp:     { label: 'Health',       values: { normal: 1, low: 0.7, high: 1.5 } },
};
const optDefaults = () => Object.fromEntries(Object.entries(OPTIONS).map(([k, o]) => [k, Object.keys(o.values)[0]]));
let CFG = { opt: optDefaults() };
const OPT = k => OPTIONS[k].values[(CFG.opt || {})[k]] || 1;
// Handicap: the host can give any archer a percentage, e.g. +50% for a lone player in a 1v2.
// It scales their health and arrow damage by that much, and their knockback resistance by half as much.
const HANDICAPS = [0, 25, 50, 75, 100, -25, -50];
function setHandicap(w, id, pct) {
  const p = w.players.find(q => q.id === id);
  if (!p || !HANDICAPS.includes(+pct)) return false;
  const frac = p.maxHp ? p.hp / p.maxHp : 1;
  p.hcap = +pct; applyStats(p);
  if (!p.dead) p.hp = Math.max(1, Math.round(p.maxHp * frac));
  ev(w, { e: 'hcap', id: p.id, n: p.name, v: p.hcap });
  return true;
}
const MAP_KEYS = Object.keys(MAPS);

// The simulation reads the current arena from these; useMap() points them at a world's arena.
// Every public entry point calls useMap first, so rooms on different arenas can share one server.
let MAP = MAPS.meadow, HAZ = MAP.haz, PILLARS = MAP.pillars, SPIKES = MAP.spikes, HEAL = null, ICE = null, WARN = [];
let SPAWNS = { red: RED_SPAWNS, blue: RED_SPAWNS.map(mirrorItem) };
const GATES = [{ x: 70, y: 70 }, { x: AW - 70, y: 70 }, { x: 70, y: AH - 70 }, { x: AW - 70, y: AH - 70 }];
const CENTER_X = AW / 2;
function useMap(w) {
  CFG = w.cfg; if (!CFG.opt) CFG.opt = optDefaults();
  MAP = MAPS[w.cfg.map] || MAPS.meadow;
  PILLARS = MAP.pillars; SPIKES = MAP.spikes; HEAL = MAP.heal || null; ICE = MAP.ice || null;
  // thin ice that has given way joins the arena's hazards; ice about to go is something bots steer clear of
  const cr = w.cracks || [];
  HAZ = cr.some(c => c === 2) ? MAP.haz.concat(MAP.cracks.filter((c, i) => cr[i] === 2)) : MAP.haz;
  WARN = cr.some(c => c === 1) ? MAP.cracks.filter((c, i) => cr[i] === 1) : [];
}
function updateCracks(w) {
  if (!MAP.cracks.length) return;
  const el = TIMES.game - w.match.T;
  MAP.cracks.forEach((c, i) => {
    const st = w.cracks[i] || 0;
    if (st === 0 && el >= c.at - CRACK_WARN) { w.cracks[i] = 1; ev(w, { e: 'crackWarn', i }); }
    else if (st === 1 && el >= c.at) { w.cracks[i] = 2; ev(w, { e: 'crackOpen', i }); }
  });
  useMap(w);
}

const TEAMS = ['red', 'blue'];
const TEAM_INFO = {
  red:  { name: 'Red',  color: '#ff5a45', shades: ['#ff6b5a', '#ff9f43', '#ff7ac8', '#ffcf5a'] },
  blue: { name: 'Blue', color: '#3d8bff', shades: ['#4fa8ff', '#3fd0c9', '#b38cff', '#a8e6ff'] },
};

const PU = {
  multi:     { name: 'Triple Shot',  glyph: '3', color: '#5ad1ff', dur: 12 },
  heavy:     { name: 'Heavy Arrows', glyph: 'H', color: '#ff8a3d', dur: 12 },
  quick:     { name: 'Quickdraw',    glyph: 'Q', color: '#ffe066', dur: 12 },
  ricochet:  { name: 'Ricochet',     glyph: 'R', color: '#8affc1', dur: 12 },
  explosive: { name: 'Blast Tips',   glyph: 'B', color: '#ff5a7a', dur: 10 },
  aegis:     { name: 'Aegis',        glyph: 'A', color: '#c7b3ff', dur: 5 },
  heal:      { name: 'Medkit',       glyph: '+', color: '#7dff8a', dur: 0 },
};
const PU_TIMED = Object.keys(PU).filter(k => PU[k].dur > 0);
// Big powerups you capture by standing in them: CHANNEL_TIME seconds with no enemy inside.
const CHANNEL = {
  winter:    { name: 'Deep Winter', color: '#bfe8ff', desc: 'Freezes every enemy in place for 4 seconds (bows too for the first 2).' },
  thunder:   { name: 'Thunderhead', color: '#fff27a', desc: 'Lightning strikes every enemy for 15 damage.' },
  sanctuary: { name: 'Sanctuary',   color: '#7dff8a', desc: 'Heals your whole team by 40.' },
};
const CHANNEL_TIME = 3, CHANNEL_R = 46;

// ---------------- archetypes ----------------
// Every archer is one Element plus one Role ("Frost Sniper", "Poison Juggernaut").
// Choosing an element grants its base arrow effect. After every round you pick 1 of 3 cards drawn from
// your two trees; what you pick unlocks what can appear next. Picks are free; amber pays for rerolls.
const ELEMENTS = {
  frost:  { name: 'Frost',  color: '#9fdcff', blurb: 'Slow targets down, then freeze them solid.' },
  flame:  { name: 'Flame',  color: '#ff8a3d', blurb: 'Set targets burning and scorch the ground.' },
  storm:  { name: 'Storm',  color: '#fff27a', blurb: 'Lightning arcs between nearby enemies.' },
  poison: { name: 'Poison', color: '#9be564', blurb: 'Stacking poison that wears enemies down and cuts their healing.' },
  stone:  { name: 'Stone',  color: '#c9a878', blurb: 'Crushing hits that break a draw and leave targets easier to knock around.', premium: true },
  void:   { name: 'Void',   color: '#b48cff', blurb: 'Rifts that drag other enemies in: into hazards, or into each other.', premium: true },
  shadow: { name: 'Shadow', color: '#8e95c9', blurb: 'Shroud targets in darkness so they can only see what is right next to them.', premium: true },
};
// New elements and roles are tagged premium. Set LOCK_PREMIUM to true to lock them in the lobby
// (e.g. later, behind an unlock); for now everything is free to play.
const LOCK_PREMIUM = false;
// Achievements unlock titles. Progress is kept by each player's own browser; the server only checks the title exists.
const ACHIEVEMENTS = {
  blooded:     { title: 'Blooded',        desc: 'Get your first knockout.',                         stat: 'ko', goal: 1 },
  veteran:     { title: 'Veteran',        desc: 'Get 50 knockouts.',                                stat: 'ko', goal: 50 },
  warlord:     { title: 'Warlord',        desc: 'Get 250 knockouts.',                               stat: 'ko', goal: 250 },
  sharpshooter:{ title: 'Sharpshooter',   desc: 'Land 25 bullseyes.',                               stat: 'bull', goal: 25 },
  eagleeye:    { title: 'Eagle Eye',      desc: 'Land 200 bullseyes.',                              stat: 'bull', goal: 200 },
  ringmaster:  { title: 'Ringmaster',     desc: 'Knock 20 archers into hazards.',                   stat: 'ring', goal: 20 },
  longshot:    { title: 'Longshot',       desc: 'Knock someone out from 20 metres or more.',        stat: 'long', goal: 1 },
  pinmaster:   { title: 'Pinmaster',      desc: 'Pin 10 archers to a wall.',                        stat: 'pin', goal: 10 },
  clutch:      { title: 'Clutch',         desc: 'Win a game as the last archer standing against 2 or more.', stat: 'clutch', goal: 1 },
  lonewolf:    { title: 'Lone Wolf',      desc: 'Win a 1v3 or bigger clutch.',                      stat: 'clutch3', goal: 1 },
  unstoppable: { title: 'Unstoppable',    desc: 'Knock out 5 in a row without going down.',         stat: 'streak5', goal: 1 },
  legend:      { title: 'Legend',         desc: 'Knock out 10 in a row without going down.',        stat: 'streak10', goal: 1 },
  empowered:   { title: 'Empowered',      desc: 'Become empowered.',                                stat: 'emp', goal: 1 },
  untouchable: { title: 'Untouchable',    desc: 'Win 5 flawless games (your team loses nobody).',   stat: 'flawless', goal: 5 },
  stormkeeper: { title: 'Keeper',         desc: 'Capture 5 capture powerups.',                      stat: 'capture', goal: 5 },
  lifeline:    { title: 'Lifeline',       desc: 'Revive 5 teammates.',                              stat: 'revive', goal: 5 },
  champion:    { title: 'Champion',       desc: 'Win 10 matches.',                                  stat: 'match', goal: 10 },
};
function setTitle(w, id, key) {
  const p = w.players.find(q => q.id === id);
  if (!p || (key && !ACHIEVEMENTS[key])) return false;
  p.title = key || null;
  return true;
}
const isLocked = key => LOCK_PREMIUM && !!((ELEMENTS[key] || ROLES[key] || {}).premium);
const ROLES = {
  sniper:     { name: 'Sniper',     cat: 'Power',   blurb: 'Harder, faster, longer shots.',
    trait: { name: 'Marksman', desc: 'Arrows fly 10% faster and hit up to 20% harder at long range. 10 less health.' } },
  juggernaut: { name: 'Juggernaut', cat: 'Power',   blurb: 'Tough to move, dangerous up close.',
    trait: { name: 'Heavyweight', desc: '15 more health, a bigger body, 7% less knockback taken, and heals 2 health a second after 4 seconds without being hit. Arrows deal 20% less damage but knock back 20% harder. 7% slower.' } },
  ranger:     { name: 'Ranger',     cat: 'Agility', blurb: 'Speed, extra dashes and a grapple.',
    trait: { name: 'Light-footed', desc: '8% faster, and your dash recharges 20% quicker. 10 less health.' } },
  trickster:  { name: 'Trickster',  cat: 'Agility', blurb: 'Bouncing, splitting and bending arrows.',
    trait: { name: 'Nimble Fingers', desc: 'Draw your bow 12% faster, but your arrows knock back 10% less.' } },
  warden:     { name: 'Warden',     cat: 'Utility', blurb: 'Protect and revive your team.',
    trait: { name: 'Mender', desc: 'You and teammates near you heal 2 health a second after 4 seconds without being hit. 5% slower.' } },
  trapper:    { name: 'Trapper',    cat: 'Utility', blurb: 'Roots, traps and punishing the stuck.',
    trait: { name: 'Hunter', desc: 'Abilities recharge 30% faster, and hits on rooted, stuck or frozen enemies deal 15% more damage.' } },
};
ROLES.assassin = { name: 'Assassin', cat: 'Agility', blurb: 'Vanish, get close, and strike first.', premium: true,
  trait: { name: 'Backstab', desc: 'Arrows that hit an enemy from behind deal 40% more damage and knock back 30% harder.' } };
ROLES.ninja = { name: 'Ninja', cat: 'Agility', blurb: 'Blink in, strike fast, blink out.', premium: true,
  trait: { name: 'Shadowstep', desc: "No bow: click to throw a shuriken instantly (hold to keep throwing, nearly 3 a second). Each hits softer than an arrow and flies about 500px; bullseye shuriken count as fully drawn shots for your upgrades. Your dash is a near-instant blink toward your cursor instead: about 150px, 2 charges usable back to back, straight over pits and lava. 10 less health, and you take 10% more knockback." } };
const TREE_KEYS = Object.keys(ELEMENTS).concat(Object.keys(ROLES));
const MAX_SLOTS = 2, CAP_PICKS = 2, OFFER_SIZE = 3;
// tree: which element/role it belongs to ('element' = any element). base: granted free with the element.
// cap: capstone, needs CAP_PICKS other picks from the same tree first. active: a Q/E ability.
const TREE = {
  frost:     { tree: 'frost', base: true, name: 'Frost Arrows', desc: 'Hits slow the target by 50% for 3 seconds and slow their dashes, and your arrows deal 30% more damage to slowed or frozen targets.' },
  frostbite: { tree: 'frost', name: 'Frostbite', desc: 'A third frost hit within 6 seconds freezes the target solid for 2 seconds.' },
  deepfreeze:{ tree: 'frost', name: 'Deep Freeze', desc: "Enemies you freeze can't draw their bow for 3 seconds.", req: ['frostbite'] },
  shatter:   { tree: 'frost', name: 'Shatter', desc: 'Hits on slowed or frozen enemies knock back 35% harder.' },
  flame:     { tree: 'flame', base: true, name: 'Flame Arrows', desc: 'Hits set the target burning for 2 seconds.' },
  wildfire:  { tree: 'flame', name: 'Wildfire', desc: 'Fully drawn hits leave burning ground for 3 seconds.' },
  inferno:   { tree: 'flame', name: 'Inferno', desc: 'Burns last 5 seconds and hurt a fifth more.' },
  storm:     { tree: 'storm', base: true, name: 'Storm Arrows', desc: 'Hits arc to one more enemy nearby for a small jolt.' },
  static:    { tree: 'storm', name: 'Static', desc: "Storm hits lock the target's dash for 2 seconds." },
  echo:      { tree: 'storm', name: 'Echo Strike', desc: 'A bullseye storm hit crackles again half a second later: the lightning (and Static) triggers a second time from the target.' },
  forked:    { tree: 'storm', name: 'Forked Lightning', desc: 'Arcs jump to two more enemies instead of one.' },
  poison:    { tree: 'poison', base: true, name: 'Poison Arrows', desc: 'Hits add a poison stack (up to 3) that hurts over 4 seconds. Poisoned enemies heal half as fast.' },
  toxic:     { tree: 'poison', name: 'Toxic Cloud', desc: 'Fully drawn hits leave a poison cloud for 3 seconds.' },
  contagion: { tree: 'poison', name: 'Contagion', desc: 'Poisoned enemies pass a stack to any teammate standing near them every 1.5 seconds.' },
  virulent:  { tree: 'poison', name: 'Virulent', desc: 'Poison stacks up to 5 and hurts a third more.' },
  permafrost:{ tree: 'frost', trade: true, name: 'Permafrost', desc: 'Frost slows by 70% and lasts 4 seconds, but you draw your bow 5% slower.' },
  pyre:      { tree: 'flame', trade: true, name: 'Pyre', desc: 'Burns hurt 50% more, but your arrows knock back 20% less.' },
  overload:  { tree: 'storm', trade: true, name: 'Overload', desc: 'Lightning does double damage, but your dash takes 30% longer to recharge.' },
  potent:    { tree: 'poison', trade: true, name: 'Potent Toxin', desc: 'Poison hurts 50% more, but your arrows deal 15% less direct damage.' },
  stone:     { tree: 'stone', base: true, name: 'Stone Arrows', desc: 'Hits stagger the target for 2 seconds: they lose 40% of their current draw and take 15% more knockback.' },
  boulder:   { tree: 'stone', name: 'Boulder Arrows', desc: 'Fully drawn arrows knock back 30% harder.' },
  aftershock:{ tree: 'stone', name: 'Aftershock', desc: 'Fully drawn hits send a shockwave that shoves every other enemy nearby away.' },
  petrify:   { tree: 'stone', name: 'Petrify', desc: "Staggered enemies can't dash." },
  obsidian:  { tree: 'stone', trade: true, name: 'Obsidian', desc: 'Your arrows knock back 30% harder, but fly 8% slower.' },
  void:      { tree: 'void', base: true, name: 'Void Arrows', desc: 'A moment after a bullseye hit, a rift opens where the target lands. For 2 seconds it pulls them and every enemy nearby toward its centre and slows them by 30%.' },
  horizon:   { tree: 'void', name: 'Event Horizon', desc: 'Rifts are 30% bigger, pull harder and last 3 seconds.' },
  collapse:  { tree: 'void', name: 'Collapse', desc: 'When a rift ends it bursts, throwing enemies inside it outward.' },
  nullfield: { tree: 'void', name: 'Null Field', desc: "Enemies inside your rifts can't dash." },
  unstable:  { tree: 'void', trade: true, name: 'Unstable Rift', desc: 'Rifts are 50% bigger, but your arrows deal 8% less damage.' },
  blink:     { tree: 'assassin', active: { cd: 8 }, name: 'Blink', desc: "Vanish and reappear up to 220px toward your cursor, straight over pits and lava. Doesn't break stealth." },
  stealth:   { tree: 'assassin', active: { cd: 14 }, name: 'Stealth', desc: 'Vanish for 6 seconds and move 30% faster. Enemies only see a faint shimmer when close. Shooting, abilities, dashing or being hit by an arrow ends it (burns and poison don\'t).' },
  ambush:    { tree: 'assassin', name: 'Ambush', desc: 'For 2.5 seconds after stealth ends, your bow draws 60% faster.', req: ['stealth'] },
  shadowdash:{ tree: 'assassin', name: 'Shadow Dash', desc: "Dashing doesn't end stealth, and your dash recharges twice as fast while stealthed.", req: ['stealth'] },
  cloak:     { tree: 'assassin', trade: true, name: 'Cloak and Dagger', desc: 'Stealth lasts 9 seconds, but you have 10 less health.', req: ['stealth'] },
  quickfeet: { tree: 'assassin', name: 'Light Step', desc: '8% faster, and you take 15% less damage from behind.' },
  deathmark: { tree: 'assassin', cap: true, name: 'Death Mark', desc: 'Your first hit after stealth ends marks the target: they take 30% more damage from everyone for 5 seconds.' },
  shadow:    { tree: 'shadow', base: true, name: 'Shadow Arrows', desc: 'Bullseye hits shroud the target for 2.5 seconds: darkness closes in until they can only see 170px around themselves. Shrouded bots lose track of anyone further away and aim worse.' },
  blinding:  { tree: 'shadow', name: 'Blinding Dark', desc: 'Your shroud closes in to 100px, and shrouded bots aim far worse.' },
  creeping:  { tree: 'shadow', name: 'Creeping Dark', desc: 'Shrouded enemies move 15% slower.' },
  terror:    { tree: 'shadow', name: 'Night Terror', desc: 'Enemies you shroud take 25% more damage from your whole team.' },
  lingering: { tree: 'shadow', trade: true, name: 'Lingering Dark', desc: 'Your shrouds last 5 seconds, but your arrows knock back 15% less.' },

  sstrike:   { tree: 'ninja', active: { cd: 10 }, name: 'Shadow Strike', desc: 'Teleport behind the enemy nearest your cursor (up to 360px away). Your next 3 shuriken within 1.5 seconds deal 75% more damage.' },
  clone:     { tree: 'ninja', active: { cd: 14 }, name: 'Shadow Clone', desc: 'Vanish for 1.5 seconds and leave a clone behind that throws shuriken at the nearest enemy for 4 seconds.' },
  blossom:   { tree: 'ninja', active: { cd: 9 }, name: 'Death Blossom', desc: 'Throw a ring of 12 shuriken in every direction at once.' },
  recall:    { tree: 'ninja', active: { cd: 12 }, name: 'Shadow Mark', desc: 'Leave a mark where you stand. Use it again within 5 seconds to snap straight back to it (if you fall or are knocked away, this is your way home).' },
  sharpstar: { tree: 'ninja', name: 'Honed Stars', desc: 'Your shuriken deal 25% more damage.' },
  flurry:    { tree: 'ninja', name: 'Flurry', desc: 'You throw 30% faster.' },
  execution: { tree: 'ninja', name: 'Execution', desc: 'Any damage you deal to an enemy that leaves them below 15% health knocks them out on the spot.' },
  swiftstep: { tree: 'ninja', name: 'Swift Shadows', desc: 'Your blinks recharge 35% faster.' },
  thirdstep: { tree: 'ninja', name: 'Third Step', desc: 'Hold three blink charges.' },
  phase:     { tree: 'ninja', name: 'Phase Step', desc: 'Arrows pass straight through you for a quarter of a second after each blink.' },
  longstep:  { tree: 'ninja', trade: true, name: 'Long Step', desc: 'Your blinks go 40% further, but you take 15% more knockback.' },
  dance:     { tree: 'ninja', cap: true, name: 'Shadow Dance', desc: 'Every knockout you get refills your blinks and resets your ability cooldowns.' },

  recoil:    { tree: 'sniper', active: { cd: 9 }, name: 'Recoil Shot', desc: 'Your next shot knocks back 60% harder and throws you backward, away from where you shot.' },
  spot:      { tree: 'sniper', active: { cd: 12 }, name: "Spotter's Mark", desc: 'Mark the enemy nearest your cursor for 5 seconds: they take 30% more damage from everyone.' },
  rush:      { tree: 'juggernaut', active: { cd: 10 }, name: 'Bull Rush', desc: 'Charge along your aim for half a second, barely moved by hits, bulldozing every enemy in the way for 9 damage and a big shove.' },
  fortify:   { tree: 'juggernaut', active: { cd: 11 }, name: 'Fortify', desc: 'For 3 seconds take 70% less knockback and 30% less damage, but move 40% slower.' },
  wind:      { tree: 'ranger', active: { cd: 11 }, name: 'Second Wind', desc: 'Refill all your dashes and move 40% faster for 4 seconds.' },
  seeker:    { tree: 'ranger', active: { cd: 12 }, name: 'Seeker Arrow', desc: 'Your next shot curves toward the nearest enemy ahead of it.' },
  swap:      { tree: 'trickster', active: { cd: 9 }, name: 'Switcheroo', desc: 'If your next shot hits an enemy, you swap places with them, and they are stuck for a moment.' },
  boomerang: { tree: 'trickster', active: { cd: 6 }, name: 'Boomerang', desc: 'Your next shot flies out, passes through enemies and comes back to you, able to hit each of them again on the way. It deals 25% more damage.' },
  execute:   { tree: 'assassin', active: { cd: 10 }, name: 'Coup de Grâce', desc: 'Your next shot deals double damage to an enemy below 40% health.' },
  burst:     { tree: 'element', cap: true, name: 'Elemental Burst', desc: 'Fully drawn hits splash your element onto every enemy nearby.' },

  steady:    { tree: 'sniper', name: 'Steady Draw', desc: 'Draw your bow 25% faster.' },
  heavy:     { tree: 'sniper', name: 'Heavy Fletching', desc: 'Your arrows knock back 25% harder.', excl: ['longbow'] },
  longbow:   { tree: 'sniper', name: 'Longbow', desc: 'Arrows fly 20% faster and hold their speed for longer.', excl: ['heavy'] },
  deadeye:   { tree: 'sniper', name: 'Deadeye', desc: 'The further an arrow flies before it hits, the more it hurts: up to 60% more damage at long range.', req: ['longbow'] },
  pierce:    { tree: 'sniper', name: 'Piercing Shot', desc: 'Fully drawn arrows pass through the first enemy they hit.', reqAny: ['heavy', 'longbow'] },
  pin:       { tree: 'sniper', also: ['ranger', 'juggernaut'], name: 'Pin', desc: 'A fully drawn hit that slams an enemy hard into a wall or boulder straight away pins them there for 3 seconds.' },
  glass:     { tree: 'sniper', trade: true, name: 'Glass Cannon', desc: 'Your arrows deal 30% more damage, but you have 10 less health.' },
  ballista:  { tree: 'sniper', cap: true, name: 'Ballista', desc: 'Keep holding a full draw for 1 more second to load a bolt: double knockback and 50% more damage.' },

  stance:    { tree: 'juggernaut', name: 'Iron Stance', desc: 'Take 50% less knockback.' },
  vital:     { tree: 'juggernaut', name: 'Vitality', desc: '25 more health.' },
  ram:       { tree: 'juggernaut', name: 'Battering Ram', desc: 'Dashing into enemies shoves twice as hard and hurts more.' },
  riot:      { tree: 'juggernaut', name: 'Riot Shield', desc: 'Arrows that hit you head-on (from the direction you are aiming) deal 35% less damage and knock you back 30% less.' },
  railshot:  { tree: 'sniper', active: { cd: 14 }, name: 'Railshot', desc: 'Your next shot flies 80% faster, never slows down, and pierces every archer in its path.' },
  deflect:   { tree: 'juggernaut', active: { cd: 14 }, name: 'Deflect', desc: 'For 1 second, arrows that hit you head-on bounce straight back at whoever shot them, as your arrows, with 60% of their power.' },
  colossus:  { tree: 'juggernaut', trade: true, name: 'Colossus', desc: 'Grow a third larger: 30 more health, 35% less knockback taken, and your dashes slam enemies 40% harder for 6 more damage. Your arrows are bigger (easier to land) but fly 15% slower, you move 10% slower and you are much easier to hit.' },
  quake:     { tree: 'juggernaut', cap: true, active: { cd: 14 }, name: 'Earthshaker', desc: 'Slam the ground and throw every nearby enemy outward.' },

  fleet:     { tree: 'ranger', name: 'Fleet Foot', desc: '10% higher top speed and a quicker build-up.' },
  dash:      { tree: 'ranger', name: 'Quick Dash', desc: 'Dash recharges 40% faster.' },
  double:    { tree: 'ranger', name: 'Double Dash', desc: 'Hold two dash charges.' },
  volley:    { tree: 'ranger', active: { cd: 10 }, name: 'Volley', desc: 'Your next shot fires as a burst of three arrows, one after another along your aim. Each deals 65% of the damage and knockback.' },
  quickshot: { tree: 'ranger', name: 'Quickshot', desc: 'For a moment after dashing, your bow draws three times as fast.', reqAny: ['dash', 'double'] },
  surefoot:  { tree: 'ranger', name: 'Sure Footing', desc: 'Bogs, frost, snares and freezes barely hold you, and you can dash out of bogs.' },
  feather:   { tree: 'ranger', trade: true, name: 'Featherweight', desc: '15% faster with a quicker build-up, but you take 30% more knockback.' },
  grapple:   { tree: 'ranger', cap: true, active: { cd: 6 }, name: 'Grapple', desc: 'Fire a line at the wall or boulder you are aiming at and get pulled to it. Crosses pits and lava.' },

  ricochet:  { tree: 'trickster', name: 'Ricochet', desc: 'Arrows bounce once off walls and boulders.' },
  split:     { tree: 'trickster', name: 'Split Arrow', desc: 'Fully drawn arrows split into three after flying a short way. Each piece deals 40% of the damage and 45% of the knockback.' },
  curve:     { tree: 'trickster', name: 'Curve Shot', desc: 'After release, your arrows bend toward wherever you are aiming.' },
  scatter:   { tree: 'trickster', trade: true, name: 'Scattershot', desc: 'Fully drawn shots fire three arrows in a fan, but each arrow deals 40% of the damage and 45% of the knockback.' },
  smoke:     { tree: 'trickster', active: { cd: 14 }, name: 'Smoke Bomb', desc: 'Throw a smoke cloud to your cursor (up to 300px) for 5 seconds. Anyone inside is hidden from enemies outside it, bots included.' },
  rain:      { tree: 'trickster', cap: true, active: { cd: 12 }, name: 'Arrow Rain', desc: 'Mark the spot under your cursor. A volley lands there 1 second later.' },

  rally:     { tree: 'warden', name: 'Rally', desc: 'Teammates near you move 15% faster.' },
  bond:      { tree: 'warden', name: 'Bond', desc: 'Teammates near you take 25% less knockback.' },
  totem:     { tree: 'warden', active: { cd: 16 }, name: 'Mending Totem', desc: 'Plant a totem at your feet for 5 seconds. You and teammates within 120px heal 8 health a second.' },
  wall:      { tree: 'warden', active: { cd: 10 }, name: 'Shield Wall', desc: "Raise a short wall in front of you for 4 seconds. It blocks enemy arrows; your team's pass through." },
  gust:      { tree: 'warden', active: { cd: 9 }, name: 'Gust', desc: 'Blast a cone of wind in front of you that shoves enemies away.', excl: ['wall'] },
  oath:      { tree: 'warden', trade: true, name: "Guardian's Oath", desc: 'Teammates near you take 20% less damage, but you take 10% more.' },
  revive:    { tree: 'warden', cap: true, name: 'Revive', desc: 'Once per round, stand over a knocked-out teammate for 3 seconds to bring them back with half health.' },

  barbs:     { tree: 'trapper', name: 'Thorned Tips', desc: 'Hits on rooted, stuck or frozen enemies knock back 50% harder.' },
  harpoon:   { tree: 'trapper', active: { cd: 9 }, name: 'Harpoon', desc: 'Fire a barbed line along your aim (up to 420px). The first enemy it catches is yanked toward you and briefly stuck.' },
  snare:     { tree: 'trapper', active: { cd: 8 }, name: 'Snare Arrow', desc: 'Your next shot roots whoever it hits for 1.8 seconds.' },
  trap:      { tree: 'trapper', active: { cd: 10 }, name: 'Bramble Trap', desc: 'Weave a bramble trap at the spot under your cursor (up to 280px away); it takes half a second to set, and you move at half speed meanwhile. An enemy who steps on it is rooted for 2.2 seconds and hurt. Up to 2 at once.' },
  bramble:   { tree: 'trapper', trade: true, name: 'Bramble Coat', desc: 'Enemies who touch you are rooted for 1.4 seconds (once every 3 seconds each), but you move 5% slower.' },
  deeproots: { tree: 'trapper', cap: true, name: 'Deep Roots', desc: 'Your roots last twice as long, and rooted enemies take 25% more damage from you.' },
};
// Filler cards when a tree runs dry. These stack.
const HONES = {
  hone_hp:    { name: 'Toughen', desc: '+15 health.' },
  hone_kb:    { name: 'Sharpen', desc: 'Your arrows knock back 8% harder.' },
  hone_draw:  { name: 'Practice', desc: 'Draw your bow 8% faster.' },
  hone_speed: { name: 'Stride', desc: '5% higher top speed.' },
};
const cardInfo = id => TREE[id] || HONES[id];
const archetypeName = p => (ELEMENTS[p.element] ? ELEMENTS[p.element].name : '?') + ' ' + (ROLES[p.role] ? ROLES[p.role].name : '?');
const AMBER = { pickup: 2, kill: 2, hazardKill: 1, roundWin: 3, survive: 1 };
// what picking up one amber does straight away
const AMBER_BOOST = { hp: 8, dash: 0.5, ability: 1.5 };

const BOT_NAMES = ['Ada', 'Brin', 'Cato', 'Dax', 'Eli', 'Fenn', 'Gia', 'Hux', 'Ivo', 'Juno', 'Kit', 'Lark'];
const DIFF = {
  easy:   { aimErr: 0.17, react: 0.5,  dodge: 0.12, minCharge: 0.5,  lead: 0.4, speed: 0.85, turn: 3.5, see: 0.32 },
  normal: { aimErr: 0.08, react: 0.28, dodge: 0.4,  minCharge: 0.7,  lead: 0.8, speed: 1, turn: 5.5, see: 0.24 },
  hard:   { aimErr: 0.035, react: 0.12, dodge: 0.75, minCharge: 0.82, lead: 1, speed: 1, turn: 8, see: 0.17 },
};
const MAX_TEAM = 4;
const _unused_ = 0;
const LETHAL = { lava: 1, burn: 1, spikes: 1, wall: 1, crush: 1, pit: 1, water: 1 };
const has = (p, id) => p.up.includes(id);
const TIMES = { pre: 3, post: 10, roundPost: 11.5, pick: 15, game: 120 };

function inHaz(h, x, y, pad = 0) {
  if (h.shape === 'circle') return Math.hypot(x - h.x, y - h.y) < h.r + pad;
  return x > h.x - pad && x < h.x + h.w + pad && y > h.y - pad && y < h.y + h.h + pad;
}
function hazAway(h, x, y) {
  if (h.shape === 'circle') {
    const dx = x - h.x, dy = y - h.y, d = Math.hypot(dx, dy) || 1;
    return { nx: dx / d, ny: dy / d, dist: d - h.r };
  }
  const cx = clamp(x, h.x, h.x + h.w), cy = clamp(y, h.y, h.y + h.h);
  if (cx !== x || cy !== y) {
    const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1;
    return { nx: dx / d, ny: dy / d, dist: d };
  }
  const dx = x - (h.x + h.w / 2), dy = y - (h.y + h.h / 2), d = Math.hypot(dx, dy) || 1;
  return { nx: dx / d, ny: dy / d, dist: -Math.min(x - h.x, h.x + h.w - x, y - h.y, h.y + h.h - y) };
}

// ---------------- world & players ----------------
function createWorld(cfg = {}) {
  const w = {
    t: 0, nid: 1, players: [], arrows: [], pickups: [], zones: [], events: [], amberT: 2, puT: 8,
    cfg: {
      pointsToWin: cfg.pointsToWin === 5 ? 5 : 3, gamesToWin: 3,
      diff: DIFF[cfg.diff] ? cfg.diff : 'normal', map: MAPS[cfg.map] ? cfg.map : 'meadow',
      opt: Object.assign(optDefaults(), cfg.opt || {}),
    },
    // a match is won on points; each round (1 point) is won by the first team to win 3 games
    match: { ph: 'lobby', rd: 1, gm: 1, T: 0, wins: { red: 0, blue: 0 }, gw: { red: 0, blue: 0 }, picks: 0, opening: false, rw: null, mw: null },
    powerIdx: 0,
    // finished games and matches for balance stats; the server or the page drains this
    records: [], matchId: null, later: [],
  };
  return w;
}
function ev(w, o) { w.events.push(o); }
function emptyPowers() { const o = {}; for (const k of PU_TIMED) o[k] = 0; return o; }
const humans = (w, team) => w.players.filter(p => !p.bot && p.team === team);
const members = (w, team) => w.players.filter(p => p.team === team);
const enemyOf = t => (t === 'red' ? 'blue' : 'red');

function applyStats(p) {
  const h = id => (p.hones && p.hones[id]) || 0;
  const R = p.role, is = (cond, v) => (cond ? v : 1), hc = 1 + (p.hcap || 0) / 100;
  // role traits (always on) and trade-off cards
  p.maxHp = 100 + (has(p, 'vital') ? 25 : 0) + 15 * h('hone_hp')
    + (R === 'juggernaut' ? 15 : 0) - (R === 'sniper' || R === 'ranger' ? 10 : 0)
    - (has(p, 'glass') ? 10 : 0) + (has(p, 'colossus') ? 30 : 0) - (has(p, 'cloak') ? 10 : 0) - (R === 'ninja' ? 10 : 0);
  p.maxHp = Math.round(p.maxHp * OPT('hp') * hc);
  if (p.hp > p.maxHp) p.hp = p.maxHp;
  p.mass = (1 + (p.hcap || 0) / 200) * is(has(p, 'stance'), 1 / 0.5) * is(R === 'juggernaut', 1.08) * is(has(p, 'colossus'), 1 / 0.65) / is(has(p, 'feather'), 1.3) / is(R === 'ninja', 1.1) / is(has(p, 'longstep'), 1.15);
  p.r = 16 * is(R === 'juggernaut', 1.1) * is(has(p, 'colossus'), 1.35) * OPT('size');
  p.baseSpeed = 235 * (has(p, 'fleet') ? 1.1 : 1) * (1 + 0.05 * h('hone_speed')) * is(R === 'juggernaut', 0.93) * is(R === 'ranger', 1.08) * is(R === 'warden', 0.95)
    * is(has(p, 'colossus'), 0.9) * is(has(p, 'feather'), 1.15) * is(has(p, 'bramble'), 0.95) * is(has(p, 'quickfeet'), 1.08) * OPT('mspeed');
  p.rampMul = has(p, 'fleet') || has(p, 'feather') ? 0.8 : 1;
  p.dashCdMax = R === 'ninja' ? 1.5 * is(has(p, 'swiftstep'), 0.65) * is(has(p, 'overload'), 1.3)
    : (has(p, 'dash') ? 0.66 : 1.1) * is(R === 'ranger', 0.8) * is(has(p, 'overload'), 1.3);
  p.dashMaxN = R === 'ninja' ? (has(p, 'thirdstep') ? 3 : 2) : has(p, 'double') ? 2 : 1;
  p.dashN = Math.min(p.dashN == null ? p.dashMaxN : p.dashN, p.dashMaxN);
  p.drawMul = (has(p, 'steady') ? 1.25 : 1) * (1 + 0.08 * h('hone_draw')) * is(R === 'trickster', 1.12) * is(has(p, 'permafrost'), 0.95);
  p.kbMul = (1 + 0.08 * h('hone_kb')) * is(R === 'trickster', 0.9) * is(has(p, 'pyre'), 0.8) * is(R === 'juggernaut', 1.2) * is(has(p, 'obsidian'), 1.3) * is(has(p, 'lingering'), 0.85);
  p.dmgMul = hc * is(has(p, 'glass'), 1.3) * is(has(p, 'potent'), 0.85) * is(R === 'juggernaut', 0.8) * is(has(p, 'unstable'), 0.92);
  p.abCdMul = is(R === 'trapper', 0.7);
  p.sure = has(p, 'surefoot');
  // abilities fill Q then E in the order they were picked
  p.slots = p.up.filter(id => TREE[id].active).slice(0, MAX_SLOTS);
  while (p.slots.length < MAX_SLOTS) p.slots.push(null);
}

function pickColor(w, p) {
  const used = new Set(members(w, p.team).filter(q => q !== p).map(q => q.color));
  p.color = TEAM_INFO[p.team].shades.find(c => !used.has(c)) || TEAM_INFO[p.team].shades[0];
}

function makePlayer(w, opts) {
  const p = {
    id: opts.id || ('p' + (w.nid++)), name: String(opts.name || 'Archer').slice(0, 16),
    bot: !!opts.bot, diff: opts.diff || w.cfg.diff, team: opts.team, color: '#fff',
    x: 0, y: 0, vx: 0, vy: 0, r: 16, mass: 1, hp: 100, maxHp: 100, speed: 235, baseSpeed: 235,
    aim: 0, charge: 0, over: 0, drawing: false, knock: 0, falling: 0, stuck: 0, inTar: false, burn: 0, slow: 0,
    frozen: 0, frostN: 0, frostT: 0, dashLock: 0, snare: false, grap: null,
    thr: 0, tdx: 0, tdy: 0, inv: 0, dashT: 0, dashCd: 0, dashN: null, dashDir: [1, 0], shoved: [], flash: 0,
    dead: false, kills: 0, deaths: 0, amber: 0, earned: 0, up: [], hones: {}, ready: false, offer: null, picked: false,
    streak: 0, emp: false, empPts: 0, trailT: 0, auraT: 0, lastArrow: null, lastHow: '', lastHurtT: -99, slowK: 0.5, fallCause: 'pit', coat: {},
    element: ELEMENTS[opts.element] ? opts.element : pick(Object.keys(ELEMENTS)), role: ROLES[opts.role] ? opts.role : pick(Object.keys(ROLES)),
    poisonN: 0, poisonT: 0, poisonMax: 3, poisonMul: 1, burnDps: 5, quickT: 0,
    abCd: [0, 0], wantAb: [false, false], reviveUsed: false, revT: 0, revOf: null, revP: 0,
    lastHitBy: null, lastHitT: -99, lastCause: '', killedBy: null, stats: { shots: 0, hits: 0, dmg: 0, taken: 0, ring: 0, longest: 0 }, disarm: 0, poisonBy: null, contT: 0,
    pw: emptyPowers(), input: { mx: 0, my: 0, aim: 0, draw: false, tx: AW / 2, ty: AH / 2 }, wantDash: false,
    ai: { target: null, retarget: 0, strafe: 1, strafeT: 0, reload: 0.5, want: 0.8, err: 0, errT: 0, dodgeCd: 0 },
  };
  applyStats(p);
  return p;
}

// someone joining mid-round waits (knocked out) until the next round starts
function enterWorld(w, p) {
  pickColor(w, p);
  w.players.push(p);
  if (w.match.ph === 'play' || w.match.ph === 'post') { p.dead = true; p.hp = 0; p.lastCause = 'join'; }
  else placeForRound(w, p);
}

const teamCount = (w, t) => members(w, t).length;
function removeObj(w, p) {
  w.players.splice(w.players.indexOf(p), 1);
  w.arrows = w.arrows.filter(a => a.owner !== p.id || a.stuck > 0);
  if (w.match.ph === 'play') checkRoundEnd(w);
}

// a person joins the smaller team; if the room is full a bot gives up its place
function join(w, opts = {}) {
  useMap(w);
  let team = TEAMS.includes(opts.team) ? opts.team : (teamCount(w, 'red') <= teamCount(w, 'blue') ? 'red' : 'blue');
  if (teamCount(w, team) >= MAX_TEAM) team = enemyOf(team);
  if (teamCount(w, team) >= MAX_TEAM) {
    const bot = w.players.filter(p => p.bot).pop();
    if (!bot) return null;
    team = bot.team; removeObj(w, bot);
  }
  const p = makePlayer(w, { name: opts.name, team, id: opts.id, element: opts.element, role: opts.role });
  catchUp(w, p);
  enterWorld(w, p);
  ev(w, { e: 'join', id: p.id, n: p.name, tm: team });
  return p;
}
function leave(w, id) {
  useMap(w);
  const p = w.players.find(q => q.id === id);
  if (!p) return;
  ev(w, { e: 'leave', id, n: p.name });
  removeObj(w, p);
}
function botName(w) {
  const used = new Set(w.players.map(p => p.name));
  const n = BOT_NAMES.find(n => !used.has('Bot ' + n));
  return n ? 'Bot ' + n : 'Bot ' + w.nid;
}
function addBot(w, team) {
  useMap(w);
  if (!TEAMS.includes(team) || teamCount(w, team) >= MAX_TEAM) return null;
  // bots take a role nobody on their team has yet, when there is one
  const taken = new Set(members(w, team).map(q => q.role));
  const roles = Object.keys(ROLES).filter(r => !taken.has(r));
  const b = makePlayer(w, { name: botName(w), bot: true, team, diff: w.cfg.diff, role: roles.length ? pick(roles) : undefined });
  pickStyle(b);
  catchUp(w, b);
  enterWorld(w, b);
  ev(w, { e: 'join', id: b.id, n: b.name, tm: team });
  return b;
}
function removeBot(w, id) {
  useMap(w);
  const p = w.players.find(q => q.id === id);
  if (!p || !p.bot) return false;
  ev(w, { e: 'leave', id, n: p.name });
  removeObj(w, p);
  return true;
}
function setTeam(w, id, team) {
  useMap(w);
  const p = w.players.find(q => q.id === id);
  if (!p || p.bot || !TEAMS.includes(team) || p.team === team || teamCount(w, team) >= MAX_TEAM) return false;
  p.team = team; pickColor(w, p);
  if (w.match.ph === 'play' || w.match.ph === 'post') { p.dead = true; p.hp = 0; p.lastCause = 'switch'; }
  else placeForRound(w, p);
  ev(w, { e: 'switch', id: p.id, n: p.name, tm: team });
  if (w.match.ph === 'play') checkRoundEnd(w);
  return true;
}
function setBotDifficulty(w, diff) { if (!DIFF[diff]) return; w.cfg.diff = diff; for (const p of w.players) if (p.bot) p.diff = diff; }
function setMap(w, key) {
  if (!MAPS[key] || w.match.ph !== 'lobby') return false;
  w.cfg.map = key; w.cracks = []; useMap(w);
  for (const p of w.players) placeForRound(w, p);
  ev(w, { e: 'map', map: key });
  return true;
}
function setOption(w, key, val) {
  if (w.match.ph !== 'lobby' || !OPTIONS[key] || !(val in OPTIONS[key].values)) return false;
  useMap(w);
  w.cfg.opt[key] = val;
  for (const p of w.players) { applyStats(p); p.hp = p.maxHp; }
  return true;
}
function setPointsToWin(w, n) { if (w.match.ph !== 'lobby' || ![3, 5].includes(+n)) return false; w.cfg.pointsToWin = +n; return true; }
function canStart(w) { return teamCount(w, 'red') > 0 && teamCount(w, 'blue') > 0; }
function startMatch(w) {
  useMap(w);
  if (w.match.ph !== 'lobby' || !canStart(w)) return false;
  resetMatch(w);
  return true;
}
function toLobby(w) {
  useMap(w);
  const M = w.match;
  M.ph = 'lobby'; M.T = 0; M.rd = 1; M.gm = 1; M.wins = { red: 0, blue: 0 }; M.gw = { red: 0, blue: 0 }; M.picks = 0; M.opening = false; M.rw = null; M.mw = null;
  w.arrows = []; w.pickups = []; w.zones = []; w.cracks = []; useMap(w);
  for (const p of w.players) { p.kills = 0; p.deaths = 0; p.amber = 0; p.earned = 0; p.up = []; p.hones = {}; p.offer = null; p.ready = false; p.streak = 0; p.emp = false; p.empPts = 0; placeForRound(w, p); }
  ev(w, { e: 'phase', ph: 'lobby' });
}

function setInput(w, id, inp) {
  const p = w.players.find(q => q.id === id);
  if (!p || p.bot || !inp) return;
  let mx = +inp.mx || 0, my = +inp.my || 0;
  const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
  p.input.mx = mx; p.input.my = my;
  if (Number.isFinite(+inp.aim)) p.input.aim = +inp.aim;
  if (Number.isFinite(+inp.tx) && Number.isFinite(+inp.ty)) { p.input.tx = clamp(+inp.tx, 0, AW); p.input.ty = clamp(+inp.ty, 0, AH); }
  p.input.draw = !!inp.draw;
  if (inp.dash) p.wantDash = true;
  if (inp.q) p.wantAb[0] = true;
  if (inp.e) p.wantAb[1] = true;
}

// ---------------- shop ----------------
// ---------------- picks ----------------
const treesOf = id => [TREE[id].tree].concat(TREE[id].also || []);
const inTree = (p, id) => treesOf(id).some(t => t === p.element || t === p.role || (t === 'element' && !!ELEMENTS[p.element]));
const picksIn = (p, tree) => p.up.filter(id => !TREE[id].base && TREE[id].tree === tree && !TREE[id].cap).length;
function canTake(p, id) {
  const n = TREE[id];
  if (!n || n.base || has(p, id) || !inTree(p, id)) return false;
  if (n.req && !n.req.every(r => has(p, r))) return false;
  if (n.reqAny && !n.reqAny.some(r => has(p, r))) return false;
  if (n.excl && n.excl.some(x => has(p, x))) return false;
  if (n.cap && picksIn(p, n.tree === 'element' ? p.element : n.tree) < CAP_PICKS) return false;
  if (n.active && !p.slots.includes(null)) return false;
  return true;
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// three cards: at least one from each of your trees when possible, filled with stackable boosts
function rollOffer(p, avoid = [], opening = false, noAbil = false) {
  let all = Object.keys(TREE).filter(id => canTake(p, id));
  // the pick right after the opening one has no abilities, so the second slot has to be earned later
  if (noAbil) all = all.filter(id => !TREE[id].active);
  // the opening pick is always a choice between abilities from your role
  if (opening) {
    const abil = shuffle(all.filter(id => TREE[id].active && !TREE[id].cap && TREE[id].tree === p.role));
    if (abil.length >= 2) return abil.slice(0, OFFER_SIZE);
  }
  const isRole = id => TREE[id].tree === p.role;
  const offer = [];
  const add = id => { if (id && !offer.includes(id) && offer.length < OFFER_SIZE) offer.push(id); };
  // fresh cards first (not in the hand being rerolled), one from each tree when possible
  const fresh = shuffle(all.filter(id => !avoid.includes(id)));
  add(fresh.find(isRole)); add(fresh.find(id => !isRole(id)));
  fresh.forEach(add);
  // then boosts you weren't just shown, then anything left
  shuffle(Object.keys(HONES).filter(h => !avoid.includes(h))).forEach(add);
  shuffle(all.slice()).forEach(add);
  Object.keys(HONES).forEach(add);
  return shuffle(offer);
}
function takeCard(w, p, id) {
  if (HONES[id]) p.hones[id] = (p.hones[id] || 0) + 1;
  else { p.up.push(id); }
  const hpWas = p.maxHp;
  applyStats(p);
  if (p.maxHp > hpWas) p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - hpWas));
  p.offer = null; p.picked = true;
  if (p.bot) restyle(p);
  ev(w, { e: 'picked', id: p.id, card: id });
}
function choose(w, id, index) {
  const p = w.players.find(q => q.id === id);
  if (!p || w.match.ph !== 'pick' || !p.offer || p.picked) return false;
  const card = p.offer[index | 0];
  if (!card) return false;
  takeCard(w, p, card);
  return true;
}
// Bot playstyles: each bot picks one at the start of a match from its role and a random aggression,
// and leans further into it as its upgrades line up (e.g. Battering Ram makes it a brawler).
const STYLES = {
  brawler:    { name: 'Brawler',    near: 110, far: 250, charge: [0.45, 0.8], bash: 1,    cards: ['rush', 'fortify', 'pin', 'ram', 'stance', 'vital', 'quake', 'colossus', 'riot', 'deflect', 'feather', 'fleet', 'double', 'dash', 'bramble', 'barbs', 'gust', 'scatter'] },
  skirmisher: { name: 'Skirmisher', near: 230, far: 430, charge: null,        bash: 0.25, cards: ['volley', 'wind', 'seeker', 'swap', 'boomerang', 'ricochet', 'split', 'curve', 'quickshot', 'double', 'fleet', 'dash', 'grapple', 'rain', 'surefoot'] },
  marksman:   { name: 'Marksman',   near: 420, far: 660, charge: [0.92, 1],   bash: 0.05, cards: ['railshot', 'recoil', 'spot', 'steady', 'longbow', 'deadeye', 'pierce', 'ballista', 'glass', 'heavy', 'pin'] },
  guardian:   { name: 'Guardian',   near: 240, far: 420, charge: null,        bash: 0.15, mates: true, cards: ['totem', 'harpoon', 'rally', 'bond', 'wall', 'oath', 'revive', 'snare', 'trap', 'deeproots', 'gust'] },
};
STYLES.stalker = { name: 'Stalker', near: 140, far: 320, charge: [0.75, 1], bash: 0.35, cards: ['sstrike', 'clone', 'blossom', 'recall', 'sharpstar', 'flurry', 'execution', 'swiftstep', 'thirdstep', 'phase', 'dance', 'execute', 'blink', 'smoke', 'stealth', 'ambush', 'shadowdash', 'deathmark', 'cloak', 'quickfeet', 'double', 'dash', 'fleet'] };
const ROLE_STYLE = { ninja: 'stalker', assassin: 'stalker', juggernaut: 'brawler', sniper: 'marksman', warden: 'guardian', trapper: 'guardian', ranger: 'skirmisher', trickster: 'skirmisher' };
function pickStyle(p) {
  const ai = p.ai;
  ai.aggr = rand(0.2, 1);
  // mostly true to their role, sometimes not: an aggressive ranger may brawl, a cautious trickster may snipe
  let s = ROLE_STYLE[p.role] || 'skirmisher';
  if (Math.random() < 0.25) s = ai.aggr > 0.7 ? 'brawler' : ai.aggr < 0.4 ? 'marksman' : 'skirmisher';
  if (p.role === 'ninja' && s === 'marksman') s = 'skirmisher'; // their arrows don't reach that far
  ai.style = ai.baseStyle = s;
}
function restyle(p) {
  const ai = p.ai; if (!ai.baseStyle) return;
  let best = ai.baseStyle, bestS = 1.5;
  for (const [k, st] of Object.entries(STYLES)) {
    const sc = p.up.filter(id => st.cards.includes(id)).length + (k === ai.baseStyle ? 1.5 : 0);
    if (sc > bestS) { bestS = sc; best = k; }
  }
  ai.style = best;
}
// bots: capstones first, then abilities, cards that suit their playstyle, anything that builds toward one; boosts last
function botPickIndex(p) {
  const st = STYLES[p.ai && p.ai.style];
  const score = id => HONES[id] ? 0 : (TREE[id].cap ? 5 : 1) + (TREE[id].active ? 1 : 0) + (st && st.cards.includes(id) ? 1.8 : 0) + Math.random() * 1.5;
  let best = 0;
  p.offer.forEach((id, i) => { if (score(id) > score(p.offer[best])) best = i; });
  return best;
}
function startPick(w) {
  const M = w.match;
  M.ph = 'pick'; M.T = TIMES.pick;
  for (const p of w.players) {
    p.picked = false; p.offer = rollOffer(p, [], M.opening, !M.opening && M.picks === 1);
    if (p.bot) takeCard(w, p, p.offer[botPickIndex(p)]);
  }
  ev(w, { e: 'phase', ph: 'pick', rd: M.rd, op: M.opening ? 1 : 0 });
}
function finishPick(w) {
  // anyone who didn't choose in time gets one of their three cards at random
  for (const p of w.players) if (!p.picked && p.offer) {
    const card = p.offer[p.bot ? botPickIndex(p) : Math.floor(Math.random() * p.offer.length)];
    takeCard(w, p, card);
    if (!p.bot) ev(w, { e: 'autoPicked', id: p.id, card });
  }
  const M = w.match;
  M.picks++;
  if (M.opening) M.opening = false; else M.rd++;
  M.gm = 1; M.gw = { red: 0, blue: 0 };
  startPre(w);
}
function setLoadout(w, id, element, role) {
  const p = w.players.find(q => q.id === id);
  if (!p || (w.match.ph !== 'lobby' && p.up.length)) return false;
  if (isLocked(element) || isLocked(role)) return false;
  if (ELEMENTS[element]) p.element = element;
  if (ROLES[role]) p.role = role;
  p.up = w.match.ph === 'lobby' ? [] : [p.element];
  applyStats(p);
  ev(w, { e: 'loadout', id: p.id, el: p.element, ro: p.role });
  return true;
}
// give a newcomer (or a bot added mid-match) as many picks as everyone else has had
function catchUp(w, p) {
  p.up = [p.element]; p.hones = {}; applyStats(p);
  if (w.match.ph === 'lobby') { p.up = []; return; }
  const picks = w.match.picks;
  for (let i = 0; i < picks; i++) { p.offer = rollOffer(p, [], i === 0, i === 1); takeCard(w, p, p.offer[botPickIndex(p)]); }
  p.picked = w.match.ph === 'pick';
}

function setReady(w, id, ready) {
  const p = w.players.find(q => q.id === id);
  if (p && !p.bot) p.ready = !!ready;
}
// ---------------- rounds ----------------
function placeForRound(w, p) {
  const team = members(w, p.team).sort((a, b) => (a.bot - b.bot) || (a.id < b.id ? -1 : 1));
  const s = SPAWNS[p.team][Math.max(0, team.indexOf(p)) % 4];
  applyStats(p);
  Object.assign(p, {
    x: s.x, y: s.y, vx: 0, vy: 0, hp: p.maxHp, dead: false, falling: 0, stuck: 0, burn: 0, slow: 0,
    frozen: 0, frostN: 0, frostT: 0, dashLock: 0, snare: false, grap: null, over: 0, poisonN: 0, poisonT: 0, burnDps: 5, quickT: 0, disarm: 0, poisonBy: null, contT: 0,
    knock: 0, inv: 0, dashT: 0, dashCd: 0, dashN: p.dashMaxN, charge: 0, drawing: false, thr: 0, tdx: 0, tdy: 0,
    lastHitBy: null, lastHitT: -99, lastCause: '', killedBy: null, pw: emptyPowers(), wantDash: false, lastHurtT: -99, pinT: 0, pinned: 0, dashK: 1,
    pinSafe: 0, volleyArmed: false, railArmed: false, recoilArmed: false, seekArmed: false, swapArmed: false, boomArmed: false, execArmed: false,
    windT: 0, fortT: 0, phaseT: 0, shroudT: 0, blinkGap: 0, caltT: 0, rush: null, throwCd: 0, wasDraw: false, strikeN: 0, strikeT: 0, markPos: null, staggerT: 0, markT: 0, stealthT: 0, ambushT: 0, markReady: 0, slowK: 0.5, fallCause: 'pit', coat: {},
    abCd: [0, 0], wantAb: [false, false], reviveUsed: false, revT: 0, revOf: null, revP: 0,
  });
  p.aim = Math.atan2(AH / 2 - s.y, AW / 2 - s.x);
  p.input.draw = false;
}
function startPre(w) {
  const M = w.match;
  M.ph = 'pre'; M.T = TIMES.pre; M.rw = null; M.clutch = {}; M.first = null;
  w.arrows = []; w.pickups = []; w.zones = []; w.later = [];
  w.cracks = MAP.cracks.map(() => 0); useMap(w);
  for (const p of w.players) { placeForRound(w, p); p.g0 = { k: p.kills, dmg: p.stats.dmg, hits: p.stats.hits, shots: p.stats.shots, ring: p.stats.ring, taken: p.stats.taken }; p.gEmp = p.emp; }
  ev(w, { e: 'phase', ph: 'pre', rd: M.rd, gm: M.gm });
}
// ends one game; the first team to win gamesToWin games takes the round and a point
// a few lines about what happened in the game that just ended; the client turns them into words
function gameHighlights(w, winner, timedOut) {
  const M = w.match, out = [];
  const d = p => { const g = p.g0 || { k: 0, dmg: 0, hits: 0, shots: 0, ring: 0 }; return { k: p.kills - g.k, dmg: p.stats.dmg - g.dmg, hits: p.stats.hits - g.hits, shots: p.stats.shots - g.shots, ring: p.stats.ring - g.ring }; };
  const played = w.players.filter(p => p.lastCause !== 'join' && p.lastCause !== 'switch');
  const best = (list, f, min) => list.reduce((b, p) => { const v = f(p); return v >= min && (!b || v > b.v) ? { p, v } : b; }, null);
  const c = winner && M.clutch && M.clutch[winner];
  const hero = c && w.players.find(q => q.id === c.id && !q.dead);
  if (hero) out.push({ t: 'clutch', id: hero.id, n: hero.name, vs: c.vs, tm: winner });
  if (winner) {
    const team = members(w, winner).filter(p => played.includes(p));
    const tk = team.reduce((s, p) => s + d(p).k, 0);
    const top = best(team, p => d(p).k, 2);
    if (team.length >= 2 && top && top.v >= tk * 0.6 && !hero) out.push({ t: 'carry', id: top.p.id, n: top.p.name, k: top.v, tk, tm: winner });
    if (team.length >= 2 && team.every(p => !p.dead)) out.push({ t: 'flawless', tm: winner });
    const up = team.filter(p => !p.dead);
    if (!timedOut && up.length === 1 && up[0].hp <= 20 && !hero) out.push({ t: 'close', id: up[0].id, n: up[0].name, hp: Math.max(1, Math.ceil(up[0].hp)) });
  }
  if (timedOut) out.push({ t: 'time', tm: winner });
  const dur = w.t - (M.gStart || w.t);
  if (winner && !timedOut && dur < 25) out.push({ t: 'quick', s: Math.max(1, Math.round(dur)) });
  const ring = best(played, p => d(p).ring, 2);
  if (ring) out.push({ t: 'ring', id: ring.p.id, n: ring.p.name, r: ring.v });
  const aim = best(played.filter(p => d(p).shots >= 4), p => d(p).hits / d(p).shots, 0.7);
  if (aim) out.push({ t: 'aim', id: aim.p.id, n: aim.p.name, h: d(aim.p).hits, s: d(aim.p).shots });
  const dmg = best(played, p => d(p).dmg, 30);
  if (dmg) out.push({ t: 'dmg', id: dmg.p.id, n: dmg.p.name, v: Math.round(dmg.v) });
  if (M.first && out.length < 3) out.push({ t: 'first', id: M.first.id, n: M.first.n, vn: M.first.vn });
  // one line per archer at most, four lines in total
  const seen = new Set();
  return out.filter(h => !h.id || (!seen.has(h.id) && seen.add(h.id))).slice(0, 4);
}
// one row per archer for the game that just ended, for balance stats
function gameRecord(w, winner, timedOut) {
  const M = w.match, r = v => Math.round(v * 10) / 10;
  const played = w.players.filter(p => p.lastCause !== 'join' && p.lastCause !== 'switch');
  return {
    type: 'game', v: 1, t: Date.now(), mid: w.matchId, map: w.cfg.map, df: w.cfg.diff, opt: Object.assign({}, w.cfg.opt), rd: M.rd, gm: M.gm,
    dur: r(w.t - (M.gStart || w.t)), to: timedOut ? 1 : 0, win: winner || null,
    size: [members(w, 'red').length, members(w, 'blue').length],
    p: played.map(p => {
      const g = p.g0 || { k: 0, dmg: 0, hits: 0, shots: 0, ring: 0, taken: 0 };
      return {
        n: p.name, b: p.bot ? 1 : 0, tm: p.team, el: p.element, ro: p.role, hc: p.hcap || 0,
        up: p.up.filter(id => TREE[id] && !TREE[id].base), hn: Object.assign({}, p.hones),
        w: winner ? (p.team === winner ? 1 : 0) : 0.5, s: p.dead ? 0 : 1,
        k: p.kills - g.k, dmg: r(p.stats.dmg - g.dmg), tk: r(p.stats.taken - g.taken),
        sh: p.stats.shots - g.shots, hi: p.stats.hits - g.hits, ring: p.stats.ring - g.ring,
        e: p.gEmp ? 1 : 0, how: p.dead ? (p.lastHow || p.lastCause || '') : '',
      };
    }),
  };
}
function endRound(w, winner, timedOut) {
  const M = w.match;
  if (w.matchId) w.records.push(gameRecord(w, winner, timedOut));
  M.ph = 'post'; M.rw = winner || 'draw';
  if (winner) {
    M.gw[winner]++;
    for (const p of members(w, winner)) { p.amber += AMBER.roundWin; p.earned += AMBER.roundWin; }
  }
  for (const p of w.players) if (!p.dead) { p.amber += AMBER.survive; p.earned += AMBER.survive; }
  const hl = gameHighlights(w, winner, timedOut);
  const cl = hl.find(h => h.t === 'clutch');
  if (cl) ev(w, { e: 'clutch', id: cl.id, n: cl.n, vs: cl.vs, tm: winner });
  const roundWon = !!winner && M.gw[winner] >= w.cfg.gamesToWin;
  M.T = roundWon ? TIMES.roundPost : TIMES.post;
  ev(w, { e: 'gameEnd', rw: M.rw, rd: M.rd, gm: M.gm, gw: [M.gw.red, M.gw.blue], rwon: roundWon ? 1 : 0, wins: [M.wins.red + (roundWon && winner === 'red' ? 1 : 0), M.wins.blue + (roundWon && winner === 'blue' ? 1 : 0)], hl, to: timedOut ? 1 : 0 });
  if (roundWon) {
    M.wins[winner]++;
    ev(w, { e: 'roundEnd', rw: winner, rd: M.rd, wins: [M.wins.red, M.wins.blue] });
  }
}
function resetMatch(w) {
  useMap(w);
  const M = w.match;
  M.rd = 1; M.gm = 1; M.wins = { red: 0, blue: 0 }; M.gw = { red: 0, blue: 0 }; M.picks = 0; M.mw = null;
  w.matchId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  for (const p of w.players) if (p.bot) pickStyle(p); // a fresh mood each match
  for (const p of w.players) { p.kills = 0; p.deaths = 0; p.amber = 0; p.earned = 0; p.up = [p.element]; p.hones = {}; p.offer = null; p.picked = false; p.ready = false; p.streak = 0; p.emp = false; p.empPts = 0; p.stats = { shots: 0, hits: 0, dmg: 0, taken: 0, ring: 0, longest: 0 }; applyStats(p); }
  ev(w, { e: 'matchStart' });
  // everyone makes one opening pick before round 1
  for (const p of w.players) placeForRound(w, p);
  M.opening = true;
  startPick(w);
}
function afterPost(w) {
  const M = w.match;
  const champ = TEAMS.find(t => M.wins[t] >= w.cfg.pointsToWin);
  if (champ) {
    M.ph = 'over'; M.T = 0; M.mw = champ; // stays up until the host chooses rematch or lobby
    ev(w, { e: 'matchEnd', mw: champ, wins: [M.wins.red, M.wins.blue] });
    if (w.matchId) w.records.push({ type: 'match', v: 1, t: Date.now(), mid: w.matchId, map: w.cfg.map, win: champ, pts: [M.wins.red, M.wins.blue] });
  } else if (M.rw !== 'draw' && M.gw[M.rw] >= w.cfg.gamesToWin) startPick(w); // round over: upgrade picks
  else { M.gm++; startPre(w); }
}
function alive(w, team) { return members(w, team).filter(p => !p.dead).length; }
function checkRoundEnd(w) {
  const r = alive(w, 'red'), b = alive(w, 'blue');
  if (r && b) return;
  endRound(w, r ? 'red' : b ? 'blue' : null);
}
function timeoutRound(w) {
  const r = alive(w, 'red'), b = alive(w, 'blue');
  if (r !== b) return endRound(w, r > b ? 'red' : 'blue', true);
  const hp = t => members(w, t).filter(p => !p.dead).reduce((s, p) => s + p.hp, 0);
  const hr = hp('red'), hb = hp('blue');
  endRound(w, Math.abs(hr - hb) < 1 ? null : hr > hb ? 'red' : 'blue', true);
}

// ---------------- combat ----------------
function hurt(w, f, dmg, kx, ky, src, by, quiet) {
  if (f.dead || f.falling > 0) return false;
  const hazard = !!LETHAL[src] || src === 'poison';
  if (!hazard && (f.inv > 0 || f.pw.aegis > 0)) {
    if (!quiet) ev(w, { e: 'block', x: f.x, y: f.y - 26 });
    return false;
  }
  if (by && by !== f.id) { f.lastHitBy = by; f.lastHitT = w.t; }
  // Guardian's Oath: the Warden takes a little more so the team around them takes less
  if (has(f, 'oath')) dmg *= 1.1;
  else if (w.players.some(q => q !== f && q.team === f.team && !q.dead && has(q, 'oath') && Math.hypot(q.x - f.x, q.y - f.y) < 170)) dmg *= 0.8;
  if (f.markT > 0) dmg *= 1.3; // Death Mark / Spotter's Mark
  if (f.fortT > 0) dmg *= 0.7; // Fortify
  if (f.shroudT > 0 && f.shroudTerror && !hazard) dmg *= 1.25; // Night Terror
  if (dmg > 0) f.lastHurtT = w.t;
  // stats: damage counts for whoever caused it, including hazards and burns after a knockback
  const applied = Math.max(0, Math.min(dmg, f.hp));
  const creditId = by && by !== f.id ? by : (f.lastHitBy && w.t - f.lastHitT < 5 ? f.lastHitBy : null);
  const credit = creditId && w.players.find(q => q.id === creditId && q.team !== f.team);
  if (credit) credit.stats.dmg += applied;
  f.stats.taken += applied;
  f.hp -= dmg;
  if (!quiet) { f.flash = 0.12; ev(w, { e: 'dmg', id: f.id, x: r1(f.x), y: r1(f.y - f.r - 8), v: Math.round(dmg) }); }
  if (f.pinned > 0) kx = ky = 0; // pinned to the wall: nothing moves them
  if (kx || ky) {
    kx *= OPT('kb'); ky *= OPT('kb');
    if (f.staggerT > 0) { kx *= 1.15; ky *= 1.15; } // Stone
    if (f.fortT > 0) { kx *= 0.3; ky *= 0.3; } // Fortify
    if (f.rush) { kx *= 0.25; ky *= 0.25; } // Bull Rush
    // Bond: a nearby Warden teammate steadies you
    if (w.players.some(q => q !== f && q.team === f.team && !q.dead && has(q, 'bond') && Math.hypot(q.x - f.x, q.y - f.y) < 170)) { kx *= 0.75; ky *= 0.75; }
    f.vx += kx / f.mass; f.vy += ky / f.mass;
    f.knock = Math.max(f.knock, 0.25 + Math.hypot(kx, ky) / f.mass / 1600);
  }
  if (f.hp <= 0) kill(w, f, src);
  else if (!hazard && by && f.hp < f.maxHp * 0.15) {
    // Execution (Ninja): whatever you hit that drops below 15% goes down
    const k = w.players.find(q => q.id === by);
    if (k && k.team !== f.team && has(k, 'execution')) { ev(w, { e: 'executed', x: r1(f.x), y: r1(f.y), id: f.id }); kill(w, f, 'execute'); }
  }
  return true;
}

// move a knocked-out archer's marker out of pits and lava so teammates can reach it to revive
function safeMarker(f) {
  for (let k = 0; k < 4; k++) {
    for (const h of HAZ) {
      if (h.type === 'tar' || !inHaz(h, f.x, f.y, 22)) continue;
      const a = hazAway(h, f.x, f.y);
      f.x += a.nx * (22 - a.dist + 4); f.y += a.ny * (22 - a.dist + 4);
    }
  }
  f.x = clamp(f.x, WALL + 20, AW - WALL - 20); f.y = clamp(f.y, WALL + 20, AH - WALL - 20);
}
// knockouts in a row needed to be empowered; knocking out someone empowered counts for EMPOWER_BONUS
const EMPOWER_AT = 5, EMPOWER_BONUS = 3;
const EMPOWER = {
  stone:  { name: 'Landslide', desc: 'Your arrows knock back 35% harder and stagger for twice as long.' },
  void:   { name: 'Eclipse', desc: 'Your rifts are 60% bigger and last a second longer.' },
  frost:  { name: "Winter's Grip", desc: 'Your 2nd frost hit freezes, even without Frostbite.' },
  flame:  { name: 'Blaze', desc: 'You leave a trail of fire, and your arrows set the ground alight wherever they land.' },
  storm:  { name: 'Overcharge', desc: 'Lightning arcs 2 extra times and your dash recharges twice as fast.' },
  poison: { name: 'Plague', desc: 'A poison aura around you adds a stack to every enemy inside it 4 times a second.' },
  shadow: { name: 'Nightfall', desc: 'Your bullseyes also shroud every other enemy within 220px of the target.' },
};
// a short code describing the finishing blow, turned into words by the client
function howKilled(f, cause) {
  if (cause !== 'arrow') return cause;
  const a = f.lastArrow || {};
  if (a.chain) return 'chain';
  if (a.shur) return 'shuriken';
  if (a.bolt) return 'bolt';
  if (a.dist >= 600) return 'longshot';
  if (a.el) return 'el_' + a.el;
  if (a.crit) return 'crit';
  return 'arrow';
}
function kill(w, f, cause) {
  if (f.dead) return;
  const left = Math.max(0, f.hp); // health lost to a pit or other instant knockout still counts as damage
  f.dead = true; f.hp = 0; f.deaths++;
  f.stats.taken += left;
  f.drawing = false; f.charge = 0; f.over = 0; f.falling = 0; f.lastCause = cause; f.grap = null; f.revP = 0;
  let killer = null;
  if (f.lastHitBy && w.t - f.lastHitT < 5) killer = w.players.find(q => q.id === f.lastHitBy && q.team !== f.team) || null;
  f.killedBy = killer ? killer.name : null;
  let gain = 0;
  if (killer) {
    const topKills = Math.max(...members(w, f.team).map(q => q.kills));
    killer.kills++;
    if (has(killer, 'dance') && !killer.dead) { killer.dashN = killer.dashMaxN; killer.dashCd = 0; killer.abCd = [0, 0]; ev(w, { e: 'dance', id: killer.id }); }
    killer.stats.dmg += left;
    if (LETHAL[cause]) killer.stats.ring++;
    gain = AMBER.kill + (LETHAL[cause] ? AMBER.hazardKill : 0);
    killer.amber += gain; killer.earned += gain;
  }
  const how = howKilled(f, cause);
  f.lastHow = how;
  const dist = cause === 'arrow' && f.lastArrow && f.lastArrow.dist ? Math.round(f.lastArrow.dist / 50) : 0;
  ev(w, { e: 'kill', k: killer ? killer.id : null, kn: killer ? killer.name : null, kc: killer ? killer.color : null,
    v: f.id, vn: f.name, vc: f.color, vt: f.team, c: cause, how, m: dist, x: r1(f.x), y: r1(f.y), am: gain });
  // streaks: knockouts in a row without being knocked out
  const wasEmp = f.emp;
  if ((f.streak >= 3 || wasEmp) && killer) ev(w, { e: 'shutdown', k: killer.id, kn: killer.name, v: f.id, vn: f.name, n: f.streak, emp: wasEmp ? 1 : 0 });
  if (wasEmp) ev(w, { e: 'unpowered', id: f.id, n: f.name });
  f.streak = 0; f.emp = false; f.empPts = 0;
  if (killer) {
    killer.streak++;
    killer.empPts += wasEmp ? EMPOWER_BONUS : 1;
    const nowEmp = !killer.emp && killer.empPts >= EMPOWER_AT;
    if (nowEmp) { killer.emp = true; killer.gEmp = true; ev(w, { e: 'empowered', id: killer.id, n: killer.name, el: killer.element, s: killer.streak, via: wasEmp ? 1 : 0 }); }
    if ([3, 5, 7, 10].includes(killer.streak) && !nowEmp) ev(w, { e: 'streak', id: killer.id, n: killer.name, s: killer.streak });
  }
  if (killer && !w.match.first) w.match.first = { id: killer.id, n: killer.name, vn: f.name };
  // clutch: remember when a team is down to its last archer against 2 or more
  if (w.match.ph === 'play') {
    const mates = members(w, f.team).filter(q => !q.dead);
    const foesUp = members(w, enemyOf(f.team)).filter(q => !q.dead).length;
    if (mates.length === 1 && foesUp >= 2 && !w.match.clutch[f.team]) w.match.clutch[f.team] = { id: mates[0].id, vs: foesUp };
  }
  safeMarker(f);
  f.trapSet = null;
  if (w.match.ph === 'play') checkRoundEnd(w);
}

function fire(w, p, ang, c, burst) {
  // Volley: the armed shot becomes the first of three
  if (!burst && p.volleyArmed) {
    p.volleyArmed = false; burst = 1;
    for (const t of [VOLLEY_GAP, VOLLEY_GAP * 2]) w.later.push({ t, ty: 'volley', owner: p.id, c });
  }
  const heavy = p.pw.heavy > 0;
  const bolt = has(p, 'ballista') && p.over >= 1;
  const speed = (380 + 920 * c) * (has(p, 'longbow') ? 1.2 : 1) * (p.role === 'sniper' ? 1.1 : 1) * (has(p, 'obsidian') ? 0.92 : 1) * (has(p, 'colossus') ? 0.85 : 1) * OPT('aspeed');
  if (p.stealthT > 0) breakStealth(w, p);
  const full = c >= 0.99; // a full draw: flies fastest and triggers "fully drawn" upgrades
  let dmg = (2 + 10 * c) * (p.dmgMul || 1);
  let kb = (180 + 620 * c) * (heavy ? 1.9 : 1) * (has(p, 'heavy') ? 1.25 : 1) * (p.kbMul || 1);
  if (bolt) { dmg *= 1.5; kb *= 2; }
  if (burst) { dmg *= 0.65; kb *= 0.65; }
  const rail = !burst && p.railArmed; if (rail) p.railArmed = false;
  const take = k => { const v = !burst && p[k]; if (v) p[k] = false; return v; };
  const recoil = take('recoilArmed'), seek = take('seekArmed'), swap = take('swapArmed'), boom = take('boomArmed'), exec = take('execArmed');
  if (boom) dmg *= 1.25;
  if (recoil) kb *= 1.6;
  if (full && has(p, 'boulder')) kb *= 1.3;
  if (p.emp && p.element === 'stone') kb *= 1.35; // Landslide
  const el = Object.keys(ELEMENTS).find(e => has(p, e)) || null;
  let spread = p.pw.multi > 0 ? [-0.14, 0, 0.14] : [0];
  if (full && has(p, 'scatter')) { spread = p.pw.multi > 0 ? [-0.26, -0.13, 0, 0.13, 0.26] : [-0.13, 0, 0.13]; dmg *= 0.4; kb *= 0.45; }
  const snare = p.snare; p.snare = false;
  p.stats.shots += spread.length;
  for (const s of spread) {
    const a = ang + s;
    w.arrows.push({
      id: w.nid++, owner: p.id, team: p.team, color: p.color, own: p,
      x: p.x + Math.cos(a) * (p.r + 8), y: p.y + Math.sin(a) * (p.r + 8),
      vx: Math.cos(a) * speed * (rail ? 1.8 : 1), vy: Math.sin(a) * speed * (rail ? 1.8 : 1), v0: speed * (rail ? 1.8 : 1), ang: a, dist: 0, age: 0,
      dmg, kb, full, crit: false, heavy, el, bolt, snare, rail, big: has(p, 'colossus'), seek, swap, boom, exec, drag: rail ? 0 : has(p, 'longbow') ? 0.2 : 0.45,
      burst: full && el && has(p, 'burst'), pierce: rail || boom ? 99 : full && has(p, 'pierce') ? 1 : 0, hit: [],
      split: full && has(p, 'split'), curve: has(p, 'curve'),
      bounces: (p.pw.ricochet > 0 ? 2 : 0) + (has(p, 'ricochet') ? 1 : 0), explosive: p.pw.explosive > 0, life: p.role === 'ninja' && !boom ? 0.5 : 2.4, stuck: 0,
    });
  }
  p.over = 0;
  if (recoil) { p.vx -= Math.cos(ang) * 640; p.vy -= Math.sin(ang) * 640; p.knock = Math.max(p.knock, 0.3); ev(w, { e: 'recoil', id: p.id, x: r1(p.x), y: r1(p.y) }); }
  ev(w, { e: 'fire', id: p.id, x: r1(p.x), y: r1(p.y), c: r2(c), b: bolt ? 1 : 0 });
}



function explode(w, x, y, owner, team) {
  ev(w, { e: 'boom', x: r1(x), y: r1(y) });
  for (const p of w.players) {
    if (p.dead || p.falling > 0) continue;
    const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy);
    if (d > 125 + p.r) continue;
    const n = d || 1, force = 250 + 650 * Math.max(0, 1 - d / 130);
    if (p.id === owner) { // rocket jump: knockback, no damage
      p.vx += dx / n * force * 0.8; p.vy += dy / n * force * 0.8; p.knock = Math.max(p.knock, 0.35);
    } else if (p.team !== team) hurt(w, p, 8, dx / n * force, dy / n * force, 'blast', owner);
  }
}

// ---------------- physics ----------------
function impact(w, f, speed, side, pos) {
  if (f.dashT > 0) return;
  const spiked = side && SPIKES.some(s => s.side === side && pos > s.a && pos < s.b);
  if (spiked && speed > 120) {
    ev(w, { e: 'spike', id: f.id, x: r1(f.x), y: r1(f.y) });
    hurt(w, f, 14 + speed * 0.02, 0, 0, 'spikes', null);
  } else if (f.knock > 0 && speed > 420) {
    ev(w, { e: 'thud', id: f.id, x: r1(f.x), y: r1(f.y) });
    hurt(w, f, (speed - 420) * 0.035 + 3, 0, 0, 'wall', null);
  }
}
function collideWorld(w, f) {
  const minX = WALL + f.r, maxX = AW - WALL - f.r, minY = WALL + f.r, maxY = AH - WALL - f.r;
  if (f.x < minX) { const s = -f.vx; f.x = minX; f.vx = Math.abs(f.vx) * 0.35; impact(w, f, s, 'left', f.y); tryPin(w, f, s); }
  if (f.x > maxX) { const s = f.vx; f.x = maxX; f.vx = -Math.abs(f.vx) * 0.35; impact(w, f, s, 'right', f.y); tryPin(w, f, s); }
  if (f.y < minY) { const s = -f.vy; f.y = minY; f.vy = Math.abs(f.vy) * 0.35; impact(w, f, s, 'top', f.x); tryPin(w, f, s); }
  if (f.y > maxY) { const s = f.vy; f.y = maxY; f.vy = -Math.abs(f.vy) * 0.35; impact(w, f, s, 'bottom', f.x); tryPin(w, f, s); }
  if (f.dead) return;
  for (const p of PILLARS) {
    const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy), m = p.r + f.r;
    if (d < m) {
      const nx = dx / (d || 1), ny = dy / (d || 1);
      const vn = f.vx * nx + f.vy * ny;
      f.x = p.x + nx * m; f.y = p.y + ny * m;
      if (vn < 0) { f.vx -= 1.35 * vn * nx; f.vy -= 1.35 * vn * ny; impact(w, f, -vn, null, 0); tryPin(w, f, -vn); }
    }
  }
}

// Movement feel: air-hockey style thrust and drag.
// Holding a direction builds "throttle" gradually, throttle pushes you along, drag caps your speed.
// Letting go cuts the push but keeps most of the momentum, so you glide to a stop.
const MOVE = {
  rampUp: 1.1,     // seconds for throttle to build from 0 to full while a key is held (the slow first steps)
  rampDown: 0.2,   // seconds for throttle to fade after letting go
  drag: 2.2,       // drag at full throttle; with rampUp this sets ~2s from still to top speed
  glide: 1.3,      // drag while coasting with no key held: lower = longer air-hockey glide
  brake: 6,        // extra drag on the part of your motion that points against the key you're holding (turning)
  turnRate: 10,    // how fast the push swings to a new direction
  overSpeed: 9,    // extra drag on speed above the walking cap (after dashes)
  knockDrag: 1.5,  // drag while knocked back
  knockPush: 0.3,  // share of your push that still works while knocked back
  dashSpeed: 850,  // dash launch speed
  dashDrag: 5,     // how fast the dash burst fades
  dashTime: 0.34,  // seconds of dash (you clear pits during this)
};

function accelerate(f, mx, my, sp, dt) {
  const moving = !!(mx || my);
  // throttle ramps with an ease-in so the very first moment is slowest
  f.thr = clamp(f.thr + (moving ? dt / (MOVE.rampUp * (f.rampMul || 1)) : -dt / MOVE.rampDown), 0, 1);
  if (moving) {
    const k = 1 - Math.exp(-MOVE.turnRate * dt);
    f.tdx += (mx - f.tdx) * k; f.tdy += (my - f.tdy) * k;
  }
  const push = f.thr * f.thr * (3 - 2 * f.thr); // smoothstep
  const glide = ICE ? ICE.glide : MOVE.glide;
  let drag = glide + (MOVE.drag - glide) * push;
  let thrust = sp * MOVE.drag * push;
  if (f.inTar && !f.sure) drag *= 3; // bog: same push, triple drag, so about a third of the speed
  if (f.knock > 0) { drag = f.inTar && !f.sure ? 7 : ICE ? ICE.knock : MOVE.knockDrag; thrust *= MOVE.knockPush; }
  if (f.stuck > 0 && f.knock <= 0) drag = 12; // rooted: can't walk, but hits still send you flying
  f.vx += f.tdx * thrust * dt; f.vy += f.tdy * thrust * dt;
  const e = Math.exp(-drag * dt);
  f.vx *= e; f.vy *= e;
  // turning: bleed off motion that goes against the held direction
  if (moving && f.knock <= 0) {
    const along = f.vx * mx + f.vy * my;
    if (along < 0) { const b = along * (1 - Math.exp(-(ICE ? ICE.brake : MOVE.brake) * dt)); f.vx -= mx * b; f.vy -= my * b; }
  }
  const cur = Math.hypot(f.vx, f.vy), cap = f.speed;
  if (cur > cap * 1.05 && f.knock <= 0) {
    const target = cap + (cur - cap) * Math.exp(-(ICE ? ICE.over : MOVE.overSpeed) * dt);
    f.vx *= target / cur; f.vy *= target / cur;
  }
}

function stepBody(w, f, mx, my, dt) {
  f.flash = Math.max(0, f.flash - dt);
  if (f.falling > 0) {
    f.falling += dt;
    f.x += f.vx * dt * 0.3; f.y += f.vy * dt * 0.3;
    if (f.falling > 0.6) kill(w, f, f.fallCause || 'pit');
    return;
  }
  let sp = f.speed;
  if (f.drawing) sp *= 0.55;
  if (f.slow > 0) sp *= f.sure ? 0.85 : (f.slowK || 0.5); // frost
  if (f.riftSlow > 0) { f.riftSlow -= dt; sp *= f.sure ? 0.9 : 0.7; }
  if (f.caltT > 0) { f.caltT -= dt; sp *= f.sure ? 0.85 : 0.6; } // Caltrops
  if (f.stuck > 0) { f.stuck -= dt; sp = 0; }
  f.frozen = Math.max(0, f.frozen - dt);
  const airborne = f.dashT > 0 || !!f.grap;
  if (f.grap) {
    // Grapple: reel toward the anchor, crossing pits and lava
    const g = f.grap, dx = g.x - f.x, dy = g.y - f.y, d = Math.hypot(dx, dy) || 1;
    g.t -= dt;
    f.vx = dx / d * 760; f.vy = dy / d * 760;
    if (d < f.r + 26 || g.t <= 0) { f.grap = null; f.vx *= 0.4; f.vy *= 0.4; }
  } else if (f.rush) {
    // Bull Rush: a straight, unstoppable charge
    f.rush.t -= dt; f.knock = 0;
    f.vx = f.rush.dx * 560; f.vy = f.rush.dy * 560;
    if (f.rush.t <= 0) { f.rush = null; f.vx *= 0.4; f.vy *= 0.4; }
  } else if (f.dashT > 0) {
    f.dashT -= dt;
    const e = Math.exp(-MOVE.dashDrag * (f.dashK || 1) * dt); f.vx *= e; f.vy *= e; // burst that fades smoothly
  } else {
    accelerate(f, mx, my, sp, dt);
    if (f.knock > 0) f.knock -= dt;
  }
  if (f.pinned > 0) { f.vx = 0; f.vy = 0; }
  f.x += f.vx * dt; f.y += f.vy * dt;
  collideWorld(w, f);
  if (f.dead) return;

  let inTar = false, inLava = false, inPit = false;
  for (const h of HAZ) {
    if (h.type === 'tar' && inHaz(h, f.x, f.y)) inTar = true;
    else if (h.type === 'lava' && inHaz(h, f.x, f.y, -4)) inLava = true;
    else if (h.type === 'pit' && inHaz(h, f.x, f.y, -f.r * 0.35)) { inPit = true; f.fallCause = h.water ? 'water' : 'pit'; }
  }
  if (airborne) { inLava = false; inPit = false; }
  if (inTar && !f.inTar && !f.sure && f.knock > 0 && Math.hypot(f.vx, f.vy) > 140) {
    f.stuck = 1.4; f.vx *= 0.2; f.vy *= 0.2;
    ev(w, { e: 'stuck', id: f.id, x: r1(f.x), y: r1(f.y - 26) });
  }
  f.inTar = inTar;
  if (inLava) { hurt(w, f, 30 * dt, 0, 0, 'lava', null, true); f.burn = Math.max(f.burn, 1.5); }
  else if (f.burn > 0) { f.burn -= dt; hurt(w, f, (f.burnDps || 5) * dt, 0, 0, 'burn', null, true); if (f.burn <= 0) f.burnDps = 5; }
  if (!f.dead && f.poisonT > 0) { f.poisonT -= dt; hurt(w, f, f.poisonN * 1.6 * f.poisonMul * dt, 0, 0, 'poison', null, true); if (f.poisonT <= 0) f.poisonN = 0; }
  if (f.dead) return;
  if (inPit) {
    f.falling = 0.001; f.drawing = false; f.charge = 0; f.stuck = 0;
    ev(w, { e: 'fall', id: f.id, x: r1(f.x), y: r1(f.y) });
  }
}

function updatePlayer(w, p, dt) {
  if (p.dead) return;
  for (const k in p.pw) p.pw[k] = Math.max(0, p.pw[k] - dt);
  p.inv = Math.max(0, p.inv - dt);
  p.slow = Math.max(0, p.slow - dt);
  p.frostT = Math.max(0, p.frostT - dt);
  p.dashLock = Math.max(0, p.dashLock - dt);
  p.quickT = Math.max(0, p.quickT - dt);
  p.deflectT = Math.max(0, (p.deflectT || 0) - dt);
  p.windT = Math.max(0, (p.windT || 0) - dt); p.fortT = Math.max(0, (p.fortT || 0) - dt); p.phaseT = Math.max(0, (p.phaseT || 0) - dt);
  p.shroudT = Math.max(0, (p.shroudT || 0) - dt); p.blinkGap = Math.max(0, (p.blinkGap || 0) - dt);
  if (p.markPos) {
    p.markPos.t -= dt;
    if (p.markPos.t <= 0) { p.markPos = null; const i = p.slots.indexOf('recall'); if (i >= 0) p.abCd[i] = TREE.recall.active.cd * (p.abCdMul || 1); }
  }
  if (p.trapSet) {
    p.trapSet.t -= dt;
    if (p.trapSet.t <= 0) {
      const T = p.trapSet; p.trapSet = null;
      w.zones.push({ id: w.nid++, ty: 'trap', x: T.x, y: T.y, r: 22, t: 45, team: p.team, owner: p.id, arm: 0.3 });
      ev(w, { e: 'trapSet', id: p.id, tm: p.team, x: r1(T.x), y: r1(T.y) });
    }
  }
  p.pinT = Math.max(0, (p.pinT || 0) - dt); p.pinned = Math.max(0, (p.pinned || 0) - dt);
  p.staggerT = Math.max(0, (p.staggerT || 0) - dt); p.markT = Math.max(0, (p.markT || 0) - dt);
  p.ambushT = Math.max(0, (p.ambushT || 0) - dt); p.markReady = Math.max(0, (p.markReady || 0) - dt);
  if (p.stealthT > 0) { p.stealthT -= dt; if (p.stealthT <= 0) { p.stealthT = 0.001; breakStealth(w, p); } }
  // dash charges refill one at a time
  if (p.dashN < p.dashMaxN) { p.dashCd -= dt * (p.emp && p.element === 'storm' ? 2 : 1) * (p.stealthT > 0 && has(p, 'shadowdash') ? 2 : 1); if (p.dashCd <= 0) { p.dashN++; p.dashCd = p.dashN < p.dashMaxN ? p.dashCdMax : 0; } }
  const inp = p.input;
  const mx = inp.mx, my = inp.my, ml = Math.hypot(mx, my);
  p.aim = inp.aim;

  // bogs hold you: no dashing while you're in one (Sure Footing ignores this)
  if (p.wantDash && p.inTar && !p.sure && p.dashN > 0) { if (!p.bot && !(p.bogMsgT > w.t)) { p.bogMsgT = w.t + 1.5; ev(w, { e: 'abFail', id: p.id, why: "Can't dash in the bog" }); } p.wantDash = false; }
  if (p.wantDash && p.role === 'ninja' && p.dashN > 0 && p.dashLock <= 0 && p.falling <= 0 && p.stuck <= 0 && !p.grap && !p.rush && p.blinkGap <= 0) {
    ninjaBlink(w, p);
    p.wantDash = false;
  }
  if (p.wantDash && p.role !== 'ninja' && p.dashN > 0 && p.dashLock <= 0 && p.falling <= 0 && p.stuck <= 0 && !p.grap && !p.rush) {
    const dx = Math.cos(p.aim), dy = Math.sin(p.aim); // dash always goes where you're aiming
    // frost: the dash is slower but goes as far (speed, fade and duration all stretch together)
    const k = p.slow > 0 ? (p.sure ? 0.9 : 0.7) : 1;
    p.dashK = k;
    p.vx = dx * MOVE.dashSpeed * k; p.vy = dy * MOVE.dashSpeed * k; p.dashT = MOVE.dashTime / k; p.knock = 0;
    if (p.dashN === p.dashMaxN) p.dashCd = p.dashCdMax;
    p.dashN--;
    p.dashDir = [dx, dy]; p.shoved = [];
    if (has(p, 'quickshot')) p.quickT = 0.9;
    if (p.stealthT > 0 && !has(p, 'shadowdash')) breakStealth(w, p);
    ev(w, { e: 'dash', id: p.id, x: r1(p.x), y: r1(p.y), dx: r2(dx), dy: r2(dy) });
  }
  p.wantDash = false;

  for (let i = 0; i < MAX_SLOTS; i++) {
    p.abCd[i] = Math.max(0, p.abCd[i] - dt);
    if (!p.wantAb[i]) continue;
    p.wantAb[i] = false;
    const id = p.slots[i];
    if (!id || p.abCd[i] > 0 || (p.falling > 0 && !(id === 'recall' && p.markPos))) continue;
    if (id !== 'stealth' && id !== 'blink' && p.stealthT > 0) breakStealth(w, p);
    const ok = useAbility(w, p, id);
    p.abCd[i] = ok === 'rearm' ? 0.35 : ok ? TREE[id].active.cd * (p.abCdMul || 1) : 0.8;
  }

  p.disarm = Math.max(0, p.disarm - dt);
  if (p.role === 'ninja') {
    // shuriken: a click throws one at once; holding keeps throwing
    p.throwCd = Math.max(0, (p.throwCd || 0) - dt);
    p.strikeT = Math.max(0, (p.strikeT || 0) - dt); if (p.strikeT <= 0) p.strikeN = 0;
    const press = inp.draw && !p.wasDraw;
    if (inp.draw && p.falling <= 0 && p.disarm <= 0 && (p.throwCd <= 0 || (press && p.throwCd < 0.12))) {
      throwStar(w, p, p.aim);
      p.throwCd = THROW_CD / ((has(p, 'flurry') ? 1.3 : 1) * (1 + 0.08 * ((p.hones && p.hones.hone_draw) || 0)) * (p.pw.quick > 0 ? 1.8 : 1));
    }
    p.wasDraw = !!inp.draw; p.drawing = false; p.charge = 0; p.over = 0;
  } else if (inp.draw && p.falling <= 0 && p.disarm <= 0) {
    const prev = p.charge;
    p.drawing = true;
    p.charge = Math.min(1, p.charge + dt * p.drawMul * (p.pw.quick > 0 ? 2.2 : 1) * (p.quickT > 0 ? 3 : 1) * (p.ambushT > 0 ? 1.6 : 1));
    if (prev < 1 && p.charge >= 1) ev(w, { e: 'full', id: p.id });
    if (p.charge >= 1 && has(p, 'ballista')) { const was = p.over; p.over += dt; if (was < 1 && p.over >= 1) ev(w, { e: 'loaded', id: p.id }); }
  } else if (p.drawing) {
    if (p.charge >= 0.12 && p.falling <= 0) fire(w, p, p.aim, p.charge);
    p.drawing = false; p.charge = 0; p.over = 0;
  }
  stepBody(w, p, mx, my, dt);
  if (p.dead) return;
  if (p.emp) empowered(w, p, dt);
  p.healing = false;
  if (HEAL && p.falling <= 0 && Math.hypot(p.x - HEAL.x, p.y - HEAL.y) < HEAL.r && p.hp < p.maxHp) {
    p.hp = Math.min(p.maxHp, p.hp + HEAL.rate * dt * (p.poisonT > 0 ? 0.5 : 1)); p.healing = true;
  }
  // Revive: stand over a knocked-out teammate
  if (has(p, 'revive') && !p.reviveUsed && w.match.ph === 'play') {
    // progress builds while you're close and drains (rather than resetting) if you drift off
    const t = w.players.find(q => q.team === p.team && q.dead && q.lastCause !== 'join' && q.lastCause !== 'switch' && Math.hypot(q.x - p.x, q.y - p.y) < 56);
    if (t && p.revOf !== t.id) { p.revOf = t.id; p.revT = 0; }
    if (t) p.revT += dt; else p.revT = Math.max(0, p.revT - dt * 2);
    const tgt = w.players.find(q => q.id === p.revOf);
    if (tgt && tgt.dead) tgt.revP = Math.max(tgt.revP, p.revT / 3);
    if (t && p.revT >= 3) {
      Object.assign(t, { dead: false, hp: t.maxHp * 0.5, inv: 1, vx: 0, vy: 0, falling: 0, stuck: 0, burn: 0, slow: 0, knock: 0,
        frozen: 0, grap: null, lastHitBy: null, lastCause: '', killedBy: null, revP: 0, thr: 0 });
      p.reviveUsed = true; p.revT = 0; p.revOf = null;
      ev(w, { e: 'revive', id: t.id, n: t.name, by: p.id, bn: p.name, x: r1(t.x), y: r1(t.y) });
    }
  }
}

// ---------------- abilities ----------------
// Ninja: a short, near-instant hop toward the cursor, over pits and lava
function ninjaBlink(w, p) {
  const a = p.aim;
  const dx = Math.cos(a), dy = Math.sin(a);
  let reach = NINJA_BLINK * (has(p, 'longstep') ? 1.4 : 1) * (p.slow > 0 && !p.sure ? 0.7 : 1), nx = p.x, ny = p.y;
  for (; reach > 10; reach -= 8) {
    nx = clamp(p.x + dx * reach, WALL + p.r, AW - WALL - p.r); ny = clamp(p.y + dy * reach, WALL + p.r, AH - WALL - p.r);
    if (!PILLARS.some(q => Math.hypot(nx - q.x, ny - q.y) < q.r + p.r)) break;
  }
  const x0 = p.x, y0 = p.y;
  p.x = nx; p.y = ny; p.vx = dx * 240; p.vy = dy * 240; p.knock = 0; p.thr = Math.max(p.thr, 0.6);
  if (p.dashN === p.dashMaxN) p.dashCd = p.dashCdMax;
  p.dashN--; p.blinkGap = 0.09;
  if (has(p, 'phase')) p.phaseT = 0.25;
  if (has(p, 'flicker')) p.quickT = 0.7;
  if (p.stealthT > 0) breakStealth(w, p);
  ev(w, { e: 'nblink', id: p.id, x1: r1(x0), y1: r1(y0), x2: r1(nx), y2: r1(ny) });
}
const THROW_CD = 0.36;
// one shuriken (or a spread with the Multishot powerup); weaker than an arrow, no charging
function throwStar(w, p, ang) {
  if (p.stealthT > 0) breakStealth(w, p);
  const dbl = p.strikeN > 0; if (dbl) p.strikeN--;
  const dmg = 7 * (p.dmgMul || 1) * (has(p, 'sharpstar') ? 1.25 : 1) * (dbl ? 1.75 : 1);
  const kb = 400 * (p.kbMul || 1) * (p.pw.heavy > 0 ? 1.9 : 1) * (p.emp && p.element === 'stone' ? 1.35 : 1);
  const el = Object.keys(ELEMENTS).find(e => has(p, e)) || null;
  const spread = p.pw.multi > 0 ? [-0.14, 0, 0.14] : [0];
  for (const off of spread) makeStar(w, p, p.x, p.y, ang + off, { dmg, kb, el, dbl, life: 0.5 });
  p.stats.shots += spread.length;
  ev(w, { e: 'throw', id: p.id, d: dbl ? 1 : 0 });
}
function makeStar(w, p, x, y, a, o) {
  const sp = 1050 * OPT('aspeed');
  w.arrows.push({ id: w.nid++, owner: p.id, team: p.team, color: p.color, own: p,
    x: x + Math.cos(a) * (p.r + 6), y: y + Math.sin(a) * (p.r + 6), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, v0: sp, ang: a, dist: 0, age: 0,
    dmg: o.dmg, kb: o.kb, full: false, crit: false, heavy: false, el: o.el || null, bolt: false, snare: false, rail: false, big: false,
    drag: 0.6, burst: false, burstOK: !!(o.el && has(p, 'burst')), pierce: 0, hit: [], split: false, curve: false,
    bounces: p.pw.ricochet > 0 ? 2 : 0, explosive: p.pw.explosive > 0 && !o.weak, life: o.life || 0.5, stuck: 0, shur: true, star: true, dbl: o.dbl });
}
function nearestFoeTo(w, p, x, y, maxD) {
  let best = null, bd = maxD;
  for (const q of w.players) {
    if (q.team === p.team || q.dead || q.falling > 0) continue;
    const d = Math.hypot(q.x - x, q.y - y);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}
function useAbility(w, p, id) {
  const ax = Math.cos(p.aim), ay = Math.sin(p.aim);
  switch (id) {
    case 'snare':
      p.snare = true; ev(w, { e: 'armed', id: p.id }); return true;
    case 'blink': {
      // hop toward the cursor, backing off from walls and boulders; pits and lava don't matter in the air
      const dx = p.input.tx - p.x, dy = p.input.ty - p.y, d = Math.hypot(dx, dy) || 1;
      let reach = Math.min(BLINK_RANGE, d), nx = p.x, ny = p.y;
      for (; reach > 10; reach -= 8) {
        nx = clamp(p.x + dx / d * reach, WALL + p.r, AW - WALL - p.r); ny = clamp(p.y + dy / d * reach, WALL + p.r, AH - WALL - p.r);
        if (!PILLARS.some(q => Math.hypot(nx - q.x, ny - q.y) < q.r + p.r)) break;
      }
      const x0 = p.x, y0 = p.y; p.x = nx; p.y = ny; p.falling = 0;
      ev(w, { e: 'blink', id: p.id, x1: r1(x0), y1: r1(y0), x2: r1(nx), y2: r1(ny), st: p.stealthT > 0 ? 1 : 0 });
      return true;
    }
    case 'harpoon': {
      const ax = Math.cos(p.aim), ay = Math.sin(p.aim);
      let hit = null, bestT = HARPOON_RANGE;
      for (const q of w.players) {
        if (q.team === p.team || q.dead || q.falling > 0 || q.pinned > 0) continue;
        const rx = q.x - p.x, ry = q.y - p.y, t = rx * ax + ry * ay;
        if (t < 0 || t > bestT || Math.abs(rx * ay - ry * ax) > q.r + 8 || !clearShot(p.x, p.y, q.x, q.y)) continue;
        hit = q; bestT = t;
      }
      const ex = hit ? hit.x : p.x + ax * HARPOON_RANGE, ey = hit ? hit.y : p.y + ay * HARPOON_RANGE;
      ev(w, { e: 'harpoon', id: p.id, x1: r1(p.x), y1: r1(p.y), x2: r1(ex), y2: r1(ey), hit: hit ? 1 : 0 });
      if (hit) { hurt(w, hit, 4, -ax * 820, -ay * 820, 'harpoon', p.id); hit.stuck = Math.max(hit.stuck, 0.5); }
      return true;
    }
    case 'sstrike': {
      const q = nearestFoeTo(w, p, p.input.tx, p.input.ty, 240);
      if (!q || Math.hypot(q.x - p.x, q.y - p.y) > 360) { if (!p.bot) ev(w, { e: 'abFail', id: p.id, why: 'Point your cursor at an enemy nearby' }); return false; }
      // behind them (the way they're not facing); try either side if that spot is a hazard or a boulder
      const d0 = q.r + p.r + 14; let spot = null;
      for (const off of [0, 0.7, -0.7, 1.4, -1.4]) {
        const a = q.aim + Math.PI + off, x = clamp(q.x + Math.cos(a) * d0, WALL + p.r, AW - WALL - p.r), y = clamp(q.y + Math.sin(a) * d0, WALL + p.r, AH - WALL - p.r);
        if (lethalDist(x, y) > 24 && !PILLARS.some(o => Math.hypot(x - o.x, y - o.y) < o.r + p.r)) { spot = { x, y }; break; }
      }
      if (!spot) return false;
      const x0 = p.x, y0 = p.y;
      p.x = spot.x; p.y = spot.y; p.vx = p.vy = 0; p.knock = 0; p.strikeN = 3; p.strikeT = 1.5; p.throwCd = 0;
      ev(w, { e: 'sstrike', id: p.id, x1: r1(x0), y1: r1(y0), x2: r1(p.x), y2: r1(p.y) });
      return true;
    }
    case 'clone':
      w.zones.push({ id: w.nid++, ty: 'clone', x: p.x, y: p.y, r: p.r, t: 4, team: p.team, owner: p.id, fireT: 0.35, aim: p.aim });
      p.stealthT = 1.5;
      ev(w, { e: 'clone', id: p.id, x: r1(p.x), y: r1(p.y) });
      return true;
    case 'blossom': {
      const dmg = 7 * (p.dmgMul || 1) * (has(p, 'sharpstar') ? 1.25 : 1), el = Object.keys(ELEMENTS).find(e => has(p, e)) || null;
      for (let i = 0; i < 12; i++) makeStar(w, p, p.x, p.y, p.aim + i / 12 * TAU, { dmg, kb: 400 * (p.kbMul || 1), el, life: 0.4, weak: true });
      ev(w, { e: 'blossom', id: p.id, x: r1(p.x), y: r1(p.y) });
      return true;
    }
    case 'recall':
      if (!p.markPos) {
        p.markPos = { x: p.x, y: p.y, t: 5 };
        w.zones.push({ id: w.nid++, ty: 'smark', x: p.x, y: p.y, r: 18, t: 5, team: p.team, owner: p.id });
        ev(w, { e: 'smark', id: p.id, x: r1(p.x), y: r1(p.y) });
        return 'rearm';
      } else {
        const m = p.markPos, x0 = p.x, y0 = p.y; p.markPos = null;
        w.zones = w.zones.filter(z => !(z.ty === 'smark' && z.owner === p.id));
        p.x = m.x; p.y = m.y; p.vx = p.vy = 0; p.knock = 0; p.falling = 0;
        ev(w, { e: 'recall', id: p.id, x1: r1(x0), y1: r1(y0), x2: r1(m.x), y2: r1(m.y) });
        return true;
      }
    case 'recoil': p.recoilArmed = true; ev(w, { e: 'armed', id: p.id, k: 'recoil' }); return true;
    case 'seeker': p.seekArmed = true; ev(w, { e: 'armed', id: p.id, k: 'seeker' }); return true;
    case 'swap': p.swapArmed = true; ev(w, { e: 'armed', id: p.id, k: 'swap' }); return true;
    case 'boomerang': p.boomArmed = true; ev(w, { e: 'armed', id: p.id, k: 'boomerang' }); return true;
    case 'execute': p.execArmed = true; ev(w, { e: 'armed', id: p.id, k: 'execute' }); return true;
    case 'spot': {
      const q = nearestFoeTo(w, p, p.input.tx, p.input.ty, 220);
      if (!q) { if (!p.bot) ev(w, { e: 'abFail', id: p.id, why: 'Point your cursor at an enemy' }); return false; }
      q.markT = 5; ev(w, { e: 'marked', id: q.id, x: r1(q.x), y: r1(q.y) });
      return true;
    }
    case 'rush':
      p.rush = { dx: Math.cos(p.aim), dy: Math.sin(p.aim), t: 0.55 }; p.shoved = []; p.dashT = 0; p.drawing = false; p.charge = 0;
      ev(w, { e: 'rush', id: p.id, x: r1(p.x), y: r1(p.y) });
      return true;
    case 'fortify': p.fortT = 3; ev(w, { e: 'fortify', id: p.id, x: r1(p.x), y: r1(p.y) }); return true;
    case 'wind': p.dashN = p.dashMaxN; p.dashCd = 0; p.windT = 4; ev(w, { e: 'wind', id: p.id, x: r1(p.x), y: r1(p.y) }); return true;
    case 'flash': {
      const dx = p.input.tx - p.x, dy = p.input.ty - p.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
      let reach = Math.min(FLASH_RANGE, Math.max(d, 60)), nx = p.x, ny = p.y;
      for (; reach > 10; reach -= 8) {
        nx = clamp(p.x + ux * reach, WALL + p.r, AW - WALL - p.r); ny = clamp(p.y + uy * reach, WALL + p.r, AH - WALL - p.r);
        if (!PILLARS.some(q => Math.hypot(nx - q.x, ny - q.y) < q.r + p.r)) break;
      }
      const x0 = p.x, y0 = p.y; let n = 0;
      for (const q of w.players) {
        if (q.team === p.team || q.dead || q.falling > 0) continue;
        if (segDist(q.x, q.y, x0, y0, nx, ny) > q.r + 14) continue;
        hurt(w, q, 12 * (p.dmgMul || 1), ux * 460 * (p.kbMul || 1), uy * 460 * (p.kbMul || 1), 'flash', p.id); n++;
      }
      p.x = nx; p.y = ny; p.vx = ux * 200; p.vy = uy * 200; p.knock = 0;
      ev(w, { e: 'flash', id: p.id, x1: r1(x0), y1: r1(y0), x2: r1(nx), y2: r1(ny), n });
      return true;
    }
    case 'shuriken': {
      for (const off of [-0.34, -0.17, 0, 0.17, 0.34]) {
        const a = p.aim + off, sp = 950 * OPT('aspeed');
        w.arrows.push({ id: w.nid++, owner: p.id, team: p.team, color: p.color, own: p,
          x: p.x + Math.cos(a) * (p.r + 6), y: p.y + Math.sin(a) * (p.r + 6), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, v0: sp, ang: a, dist: 0, age: 0,
          dmg: 6 * (p.dmgMul || 1), kb: 240 * (p.kbMul || 1), full: false, crit: false, heavy: false, el: null, bolt: false, snare: false, rail: false, big: false,
          drag: 1.2, burst: false, pierce: 0, hit: [], split: false, curve: false, bounces: 0, explosive: false, life: 0.42, stuck: 0, shur: true });
      }
      ev(w, { e: 'shuriken', id: p.id, x: r1(p.x), y: r1(p.y) });
      return true;
    }
    case 'caltrops':
      w.zones.push({ id: w.nid++, ty: 'caltrops', x: p.x, y: p.y, r: 70, t: 5, team: p.team, owner: p.id });
      ev(w, { e: 'caltrops', id: p.id, x: r1(p.x), y: r1(p.y) });
      return true;
    case 'railshot':
      p.railArmed = true; ev(w, { e: 'railArmed', id: p.id }); return true;
    case 'totem':
      w.zones.push({ id: w.nid++, ty: 'totem', x: p.x, y: p.y, r: 120, t: 5, team: p.team, owner: p.id });
      ev(w, { e: 'totem', id: p.id, x: r1(p.x), y: r1(p.y) });
      return true;
    case 'smoke': {
      let tx = p.input.tx, ty = p.input.ty;
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      if (d > 300) { tx = p.x + dx / d * 300; ty = p.y + dy / d * 300; }
      tx = clamp(tx, WALL + 30, AW - WALL - 30); ty = clamp(ty, WALL + 30, AH - WALL - 30);
      w.zones.push({ id: w.nid++, ty: 'smoke', x: tx, y: ty, r: 95, t: 5, team: p.team, owner: p.id });
      ev(w, { e: 'smoke', id: p.id, x: r1(tx), y: r1(ty) });
      return true;
    }
    case 'volley':
      p.volleyArmed = true; ev(w, { e: 'volleyArmed', id: p.id }); return true;
    case 'stealth':
      p.stealthT = has(p, 'cloak') ? 9 : 6; ev(w, { e: 'stealthOn', id: p.id, x: r1(p.x), y: r1(p.y) }); return true;
    case 'deflect':
      p.deflectT = 1; ev(w, { e: 'deflectUp', id: p.id, x: r1(p.x), y: r1(p.y) }); return true;
    case 'trap': {
      const mine = w.zones.filter(z => z.ty === 'trap' && z.owner === p.id);
      if (mine.length >= 2) w.zones.splice(w.zones.indexOf(mine[0]), 1);
      // thrown to the spot under the cursor, up to TRAP_RANGE away
      let tx = p.input.tx, ty = p.input.ty;
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      if (d > TRAP_RANGE) { tx = p.x + dx / d * TRAP_RANGE; ty = p.y + dy / d * TRAP_RANGE; }
      tx = clamp(tx, WALL + 24, AW - WALL - 24); ty = clamp(ty, WALL + 24, AH - WALL - 24);
      // it takes TRAP_SET seconds to weave; you move at half speed meanwhile, and being knocked out cancels it
      p.trapSet = { t: TRAP_SET, x: tx, y: ty };
      ev(w, { e: 'trapStart', id: p.id, tm: p.team, x: r1(tx), y: r1(ty) });
      return true;
    }
    case 'gust': {
      ev(w, { e: 'gust', x: r1(p.x), y: r1(p.y), a: r2(p.aim) });
      for (const q of w.players) {
        if (q.team === p.team || q.dead || q.falling > 0) continue;
        const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
        if (d > 230) continue;
        const off = Math.abs(((Math.atan2(dy, dx) - p.aim + Math.PI) % TAU + TAU) % TAU - Math.PI);
        if (off > 0.62) continue;
        const f = 280 + 560 * (1 - d / 260);
        hurt(w, q, 3, dx / d * f, dy / d * f, 'gust', p.id);
      }
      return true;
    }
    case 'quake': {
      ev(w, { e: 'quake', x: r1(p.x), y: r1(p.y) });
      for (const q of w.players) {
        if (q.team === p.team || q.dead || q.falling > 0) continue;
        const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy) || 1;
        if (d > 200) continue;
        const f = 300 + 650 * (1 - d / 215);
        hurt(w, q, 10, dx / d * f, dy / d * f, 'quake', p.id);
      }
      return true;
    }
    case 'wall': {
      const cx = p.x + ax * 46, cy = p.y + ay * 46, px = -ay * 52, py = ax * 52;
      w.zones.push({ id: w.nid++, ty: 'wall', x: cx - px, y: cy - py, x2: cx + px, y2: cy + py, t: 4, team: p.team, owner: p.id });
      ev(w, { e: 'wallUp', x: r1(cx), y: r1(cy) });
      return true;
    }
    case 'rain': {
      let tx = p.input.tx, ty = p.input.ty;
      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      if (d > 520) { tx = p.x + dx / d * 520; ty = p.y + dy / d * 520; }
      tx = clamp(tx, WALL + 40, AW - WALL - 40); ty = clamp(ty, WALL + 40, AH - WALL - 40);
      w.zones.push({ id: w.nid++, ty: 'rain', x: tx, y: ty, r: 88, t: 1, team: p.team, owner: p.id });
      ev(w, { e: 'rainMark', x: r1(tx), y: r1(ty) });
      return true;
    }
    case 'grapple': {
      // cast along the aim for the first wall or boulder within reach
      for (let d = 30; d <= 480; d += 8) {
        const x = p.x + ax * d, y = p.y + ay * d;
        const hitWall = x < WALL || x > AW - WALL || y < WALL || y > AH - WALL;
        const pil = PILLARS.find(q => Math.hypot(x - q.x, y - q.y) < q.r);
        if (hitWall || pil) {
          if (d < 70) break;
          p.grap = { x: clamp(x, WALL, AW - WALL), y: clamp(y, WALL, AH - WALL), t: 0.8 };
          p.knock = 0; p.stuck = 0; p.dashT = 0;
          ev(w, { e: 'grapple', id: p.id, x1: r1(p.x), y1: r1(p.y), x2: r1(p.grap.x), y2: r1(p.grap.y) });
          return true;
        }
      }
      ev(w, { e: 'abFail', id: p.id, why: 'Nothing to grapple' });
      return false;
    }
  }
  return false;
}
// Contagion: a poisoned archer passes a stack to nearby teammates once a second
function updateContagion(w, dt) {
  for (const q of w.players) {
    if (q.dead || q.poisonT <= 0 || !q.poisonBy) continue;
    const src = w.players.find(o => o.id === q.poisonBy);
    if (!src || !has(src, 'contagion')) continue;
    q.contT -= dt;
    if (q.contT > 0) continue;
    q.contT = 1.5;
    for (const r of w.players) {
      if (r === q || r.team !== q.team || r.dead || r.falling > 0) continue;
      if (Math.hypot(r.x - q.x, r.y - q.y) > 85) continue;
      r.poisonMax = Math.max(r.poisonMax, q.poisonMax); r.poisonMul = Math.max(r.poisonMul, q.poisonMul);
      r.poisonN = Math.min(r.poisonMax, r.poisonN + 1); r.poisonT = 4; r.poisonBy = q.poisonBy;
      r.lastHitBy = q.poisonBy; r.lastHitT = w.t;
      ev(w, { e: 'spread', x1: r1(q.x), y1: r1(q.y), x2: r1(r.x), y2: r1(r.y) });
    }
  }
}
function updateZones(w, dt) {
  for (let i = w.zones.length - 1; i >= 0; i--) {
    const z = w.zones[i];
    if (z.delay > 0) {
      z.delay -= dt;
      const tg = z.follow && w.players.find(q => q.id === z.follow && !q.dead && q.falling <= 0);
      if (tg) { z.x = tg.x; z.y = tg.y; }
      if (z.delay <= 0) ev(w, { e: 'zone', ty: z.ty, x: r1(z.x), y: r1(z.y), q: z.q ? 1 : 0 });
      continue;
    }
    z.t -= dt;
    if (z.ty === 'fire') {
      for (const q of w.players) {
        if (q.team === z.team || q.dead || q.falling > 0 || q.dashT > 0) continue;
        if (Math.hypot(q.x - z.x, q.y - z.y) < z.r + q.r * 0.5) { q.burn = Math.max(q.burn, 1); if (z.owner !== q.id) { q.lastHitBy = z.owner; q.lastHitT = w.t; } }
      }
    } else if (z.ty === 'toxic') {
      const own = w.players.find(o => o.id === z.owner), vir = own && has(own, 'virulent');
      for (const q of w.players) {
        if (q.team === z.team || q.dead || q.falling > 0) continue;
        if (Math.hypot(q.x - z.x, q.y - z.y) > z.r + q.r * 0.5) continue;
        z.ticks[q.id] = (z.ticks[q.id] || 0) - dt;
        if (z.ticks[q.id] <= 0) {
          z.ticks[q.id] = 0.8;
          q.poisonMax = vir ? 5 : Math.max(q.poisonMax, 3); q.poisonMul = vir ? 1.33 : q.poisonMul;
          q.poisonN = Math.min(q.poisonMax, q.poisonN + 1); q.poisonT = 4; q.poisonBy = z.owner;
          if (z.owner !== q.id) { q.lastHitBy = z.owner; q.lastHitT = w.t; }
        }
      }
    } else if (z.ty === 'trap') {
      z.arm = Math.max(0, z.arm - dt);
      if (z.arm <= 0) for (const q of w.players) {
        if (q.team === z.team || q.dead || q.falling > 0 || q.dashT > 0 || q.grap) continue;
        if (Math.hypot(q.x - z.x, q.y - z.y) < z.r + q.r * 0.6) {
          root(q, 2.2, w.players.find(o => o.id === z.owner)); hurt(w, q, 12, 0, 0, 'trap', z.owner);
          ev(w, { e: 'trapHit', x: r1(z.x), y: r1(z.y) });
          z.t = 0; break;
        }
      }
    } else if (z.ty === 'clone') {
      const o = w.players.find(q => q.id === z.owner);
      z.fireT -= dt;
      if (!o || o.dead) { z.t = 0; }
      else if (z.fireT <= 0) {
        z.fireT = 0.6;
        const q = nearestFoeTo(w, o, z.x, z.y, 460);
        if (q && clearShot(z.x, z.y, q.x, q.y)) {
          z.aim = Math.atan2(q.y - z.y, q.x - z.x);
          makeStar(w, o, z.x, z.y, z.aim, { dmg: 5 * (o.dmgMul || 1), kb: 320 * (o.kbMul || 1), el: null, life: 0.5, weak: true });
          ev(w, { e: 'throw', id: o.id, clone: 1 });
        }
      }
    } else if (z.ty === 'caltrops') {
      for (const q of w.players) {
        if (q.team === z.team || q.dead || q.falling > 0 || q.dashT > 0 || Math.hypot(q.x - z.x, q.y - z.y) > z.r + q.r * 0.5) continue;
        q.caltT = 0.15; hurt(w, q, 5 * dt, 0, 0, 'caltrops', z.owner, true);
      }
    } else if (z.ty === 'totem') {
      for (const q of w.players) {
        if (q.team !== z.team || q.dead || q.falling > 0 || q.hp >= q.maxHp || Math.hypot(q.x - z.x, q.y - z.y) > z.r) continue;
        q.hp = Math.min(q.maxHp, q.hp + 8 * dt * (q.poisonT > 0 ? 0.5 : 1)); q.healing = true;
      }
    } else if (z.ty === 'rift') {
      for (const q of w.players) {
        if (q.team === z.team || q.dead || q.falling > 0 || q.pinned > 0) continue;
        const dx = z.x - q.x, dy = z.y - q.y, d = Math.hypot(dx, dy) || 1;
        if (d > z.r) continue;
        const k = z.pull * (0.55 + 0.45 * (1 - d / z.r)) * dt / q.mass;
        q.vx += dx / d * k; q.vy += dy / d * k;
        if (z.nul) q.dashLock = Math.max(q.dashLock, 0.2);
        q.riftSlow = 0.15; // caught in the void: 30% slower
        q.lastHitBy = z.owner; q.lastHitT = w.t;
      }
      if (z.t <= 0 && z.collapse) {
        ev(w, { e: 'collapse', x: r1(z.x), y: r1(z.y), r: z.r });
        for (const q of w.players) {
          if (q.team === z.team || q.dead || q.falling > 0) continue;
          const dx = q.x - z.x, dy = q.y - z.y, d = Math.hypot(dx, dy) || 1;
          if (d > z.r * 1.1) continue;
          hurt(w, q, 5, dx / d * 520, dy / d * 520, 'blast', z.owner);
        }
      }
    } else if (z.ty === 'rain' && z.t <= 0) {
      ev(w, { e: 'rainHit', x: r1(z.x), y: r1(z.y) });
      for (const q of w.players) {
        if (q.team === z.team || q.dead || q.falling > 0) continue;
        const dx = q.x - z.x, dy = q.y - z.y, d = Math.hypot(dx, dy);
        if (d > z.r + q.r) continue;
        const n = d || 1, f = 260 + 240 * (1 - d / z.r);
        hurt(w, q, 10, dx / n * f, dy / n * f, 'rain', z.owner);
      }
    }
    if (z.t <= 0) w.zones.splice(i, 1);
  }
}

const TRAP_RANGE = 280, TRAP_SET = 0.5;
const plagueR = p => 110 * p.r / 16;
function blazePatch(w, owner, x, y, r, t, follow) {
  w.zones.push({ id: w.nid++, ty: 'fire', x, y, r, t, team: owner.team, owner: owner.id, delay: follow ? CLOUD_DELAY : 0, follow: follow || null, q: 1 });
  if (!follow) ev(w, { e: 'zone', ty: 'fire', x: r1(x), y: r1(y), q: 1 });
}
// a cloud made by a hit waits this long, following the target, so it lands where the knockback leaves them
const CLOUD_DELAY = 0.45;
// Blaze leaves fire behind a moving archer; Plague poisons enemies standing close
function empowered(w, p, dt) {
  if (p.element === 'flame') {
    p.trailT -= dt;
    if (p.trailT <= 0 && Math.hypot(p.vx, p.vy) > 110) {
      p.trailT = 0.22;
      w.zones.push({ id: w.nid++, ty: 'fire', x: p.x - p.vx * 0.06, y: p.y - p.vy * 0.06, r: 26, t: 1.6, team: p.team, owner: p.id });
    }
  } else if (p.element === 'poison') {
    // ticks quickly, so staying close stacks it up fast
    p.auraT -= dt;
    if (p.auraT > 0) return;
    p.auraT = 0.25;
    for (const q of w.players) {
      if (q.team === p.team || q.dead || q.falling > 0 || Math.hypot(q.x - p.x, q.y - p.y) > plagueR(p)) continue;
      const before = q.poisonN;
      // stacks keep hurting for 5 seconds after they leave the aura
      q.poisonMax = Math.max(q.poisonMax, has(p, 'virulent') ? 5 : 3); q.poisonN = Math.min(q.poisonMax, q.poisonN + 1); q.poisonT = Math.max(q.poisonT, 5);
      if (has(p, 'potent')) q.poisonMul = Math.max(q.poisonMul, 1.5);
      q.poisonBy = p.id; q.lastHitBy = p.id; q.lastHitT = w.t;
      if (q.poisonN > before) ev(w, { e: 'spread', x1: r1(p.x), y1: r1(p.y), x2: r1(q.x), y2: r1(q.y) });
    }
  }
}

function separate(w) {
  const list = w.players.filter(f => !f.dead && f.falling <= 0);
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.r + b.r;
      if (d >= m || d === 0) continue;
      const nx = dx / d, ny = dy / d, ov = m - d, tm = a.mass + b.mass;
      // a pinned archer doesn't budge; whoever touches them takes all the push
      const pa = a.pinned > 0, pb = b.pinned > 0;
      const sa = pa ? 0 : pb ? 1 : b.mass / tm, sb = pb ? 0 : pa ? 1 : a.mass / tm;
      a.x -= nx * ov * sa; a.y -= ny * ov * sa;
      b.x += nx * ov * sb; b.y += ny * ov * sb;
      // Bramble Coat: touching the Trapper roots you
      for (const [s, t] of [[a, b], [b, a]]) {
        if (!has(s, 'bramble') || s.team === t.team || t.stuck > 0 || (s.coat[t.id] || 0) > w.t) continue;
        s.coat[t.id] = w.t + 3; root(t, 1.4, null); t.lastHitBy = s.id; t.lastHitT = w.t;
        ev(w, { e: 'snared', x: r1(t.x), y: r1(t.y) });
      }
      // dash shove
      for (const [s, t, sgn] of [[a, b, 1], [b, a, -1]]) {
        if ((s.dashT > 0 || s.rush) && s.team !== t.team && !s.shoved.includes(t.id)) {
          s.shoved.push(t.id);
          ev(w, { e: 'shove', x: r1((a.x + b.x) / 2), y: r1((a.y + b.y) / 2) });
          const ram = (has(s, 'ram') ? 2 : 1) * (has(s, 'colossus') ? 1.4 : 1) * (s.rush ? 1.9 : 1);
          const dir = s.rush ? [s.rush.dx, s.rush.dy] : s.dashDir;
          hurt(w, t, (has(s, 'ram') ? 14 : 4) + (has(s, 'colossus') ? 6 : 0) + (s.rush ? 5 : 0), dir[0] * 520 * ram, dir[1] * 520 * ram, 'shove', s.id);
          if (!s.rush) { s.vx *= 0.4; s.vy *= 0.4; }
        }
      }
      // bowling: a knocked body slamming into another passes the hit along
      if ((a.knock > 0 || b.knock > 0) && !pa && !pb) {
        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rel > 260) {
          const j2 = rel * 0.85;
          a.vx -= nx * j2 * b.mass / tm; a.vy -= ny * j2 * b.mass / tm;
          b.vx += nx * j2 * a.mass / tm; b.vy += ny * j2 * a.mass / tm;
          a.knock = Math.max(a.knock, 0.35); b.knock = Math.max(b.knock, 0.35);
          const dmg = 2 + rel * 0.01;
          const credit = a.knock > 0 && a.lastHitBy ? a.lastHitBy : b.lastHitBy;
          ev(w, { e: 'thud', x: r1((a.x + b.x) / 2), y: r1((a.y + b.y) / 2) });
          if (credit !== b.id) { b.lastHitBy = credit; b.lastHitT = w.t; }
          if (credit !== a.id) { a.lastHitBy = credit; a.lastHitT = w.t; }
          hurt(w, a, dmg, 0, 0, 'crush', null); hurt(w, b, dmg, 0, 0, 'crush', null);
        }
      }
    }
  }
}

function stickArrow(w, a, t) {
  a.stuck = t; a.vx = a.vy = 0;
  if (a.own && a.own.emp && a.own.element === 'flame' && !a.own.dead) blazePatch(w, a.own, clamp(a.x, WALL + 22, AW - WALL - 22), clamp(a.y, WALL + 22, AH - WALL - 22), 32, 2.2);
  if (a.explosive) { explode(w, a.x, a.y, a.owner, a.team); a.stuck = 0.01; }
  else ev(w, { e: 'thunk', x: r1(a.x), y: r1(a.y) });
}

function shroud(f, by) {
  f.shroudT = Math.max(f.shroudT || 0, by && has(by, 'lingering') ? 5 : 2.5);
  f.shroudR = by && has(by, 'blinding') ? 100 : 170;
  f.shroudSlow = !!(by && has(by, 'creeping'));
  f.shroudTerror = !!(by && has(by, 'terror'));
}
function root(f, t, by) { if (by && has(by, 'deeproots')) t *= 2; f.stuck = Math.max(f.stuck, f.sure ? t * 0.4 : t); }
// elemental and trapper effects when an arrow lands
function onArrowEffects(w, a, f, primary) {
  const owner = a.own;
  if (a.snare && primary) { root(f, 1.8, owner); ev(w, { e: 'snared', x: r1(f.x), y: r1(f.y) }); }
  if (!a.el || f.dead) return;
  if (a.el === 'frost') {
    const perma = owner && has(owner, 'permafrost');
    f.slowK = perma ? 0.3 : f.slow > 0 ? Math.min(f.slowK || 0.5, 0.5) : 0.5;
    f.slow = Math.max(f.slow, perma ? 4 : 3);
    f.frostN = f.frostT > 0 ? f.frostN + 1 : 1; f.frostT = 6;
    const gripping = owner && owner.emp && owner.element === 'frost';
    if (owner && (has(owner, 'frostbite') || gripping) && f.frostN >= (gripping ? 2 : 3)) {
      f.frostN = 0; f.frozen = f.sure ? 0.8 : 2; root(f, 2, owner);
      if (has(owner, 'deepfreeze')) { f.disarm = Math.max(f.disarm, f.sure ? 1.5 : 3); f.drawing = false; f.charge = 0; f.over = 0; ev(w, { e: 'disarm', x: r1(f.x), y: r1(f.y - 44) }); }
      ev(w, { e: 'freeze', x: r1(f.x), y: r1(f.y) });
    }
  } else if (a.el === 'poison') {
    const vir = owner && has(owner, 'virulent');
    f.poisonMax = vir ? 5 : 3; f.poisonMul = (vir ? 1.33 : 1) * (owner && has(owner, 'potent') ? 1.5 : 1);
    f.poisonN = Math.min(f.poisonMax, f.poisonN + 1); f.poisonT = 4; f.poisonBy = a.owner;
    if (primary && a.full && owner && has(owner, 'toxic')) {
      w.zones.push({ id: w.nid++, ty: 'toxic', x: f.x, y: f.y, r: 56, t: 3, team: a.team, owner: a.owner, ticks: {}, delay: CLOUD_DELAY, follow: f.id });
    }
  } else if (a.el === 'flame') {
    const inf = owner && has(owner, 'inferno');
    f.burn = Math.max(f.burn, inf ? 5 : 2); f.burnDps = Math.max(f.burnDps || 4.5, (inf ? 5.5 : 4.5) * (owner && has(owner, 'pyre') ? 1.5 : 1));
    // Blaze: every hit sets the ground alight
    if (primary && owner && owner.emp && owner.element === 'flame') blazePatch(w, owner, f.x, f.y, 40, 2.5, f.id);
    if (primary && a.full && owner && has(owner, 'wildfire')) {
      w.zones.push({ id: w.nid++, ty: 'fire', x: f.x, y: f.y, r: 48, t: 3, team: a.team, owner: a.owner, delay: CLOUD_DELAY, follow: f.id });
    }
  } else if (a.el === 'stone') {
    // stagger: lose some draw, take more knockback for a moment
    const land = owner && owner.emp && owner.element === 'stone';
    f.staggerT = Math.max(f.staggerT || 0, land ? 4 : 2);
    if (f.drawing) f.charge *= 0.6;
    if (owner && has(owner, 'petrify')) f.dashLock = Math.max(f.dashLock, f.staggerT);
    ev(w, { e: 'stagger', x: r1(f.x), y: r1(f.y) });
    if (primary && a.full && owner && has(owner, 'aftershock')) {
      ev(w, { e: 'aftershock', x: r1(f.x), y: r1(f.y) });
      for (const q of w.players) {
        if (q === f || q.team === a.team || q.dead || q.falling > 0) continue;
        const dx = q.x - f.x, dy = q.y - f.y, d = Math.hypot(dx, dy) || 1;
        if (d > 110 + q.r) continue;
        hurt(w, q, 3, dx / d * 420, dy / d * 420, 'quake', a.owner);
      }
    }
  } else if (a.el === 'shadow' && a.crit) { // only bullseyes shroud
    shroud(f, owner);
    ev(w, { e: 'shroud', id: f.id, x: r1(f.x), y: r1(f.y) });
    if (primary && owner && owner.emp && owner.element === 'shadow') {
      for (const q of w.players) {
        if (q === f || q.team === a.team || q.dead || q.falling > 0 || Math.hypot(q.x - f.x, q.y - f.y) > 220) continue;
        shroud(q, owner); ev(w, { e: 'shroud', id: q.id, x: r1(q.x), y: r1(q.y) });
      }
    }
  } else if (a.el === 'void' && primary && a.crit) { // only bullseyes open a rift
    // a rift where the arrow struck; it drags in everyone else on their team
    const hz = owner && has(owner, 'horizon'), ecl = owner && owner.emp && owner.element === 'void';
    const r = 120 * (hz ? 1.3 : 1) * (owner && has(owner, 'unstable') ? 1.5 : 1) * (ecl ? 1.6 : 1);
    // it opens a moment later where the knockback leaves the target, so it holds them there too
    w.zones.push({ id: w.nid++, ty: 'rift', x: f.x, y: f.y, r, t: (hz ? 3 : 2) + (ecl ? 1 : 0), pull: hz ? 980 : 820, team: a.team, owner: a.owner,
      delay: CLOUD_DELAY, follow: f.id, collapse: !!(owner && has(owner, 'collapse')), nul: !!(owner && has(owner, 'nullfield')) });
  } else if (a.el === 'storm' && primary) {
    if (a.crit && owner && has(owner, 'echo') && !a.echo) w.later.push({ t: 0.5, ty: 'echo', target: f.id, owner: a.owner, team: a.team });
    if (owner && has(owner, 'static')) { f.dashLock = 2; }
    // arc from the target to the nearest enemy not yet hit, once (or three times with Forked Lightning)
    const jumps = (owner && has(owner, 'forked') ? 3 : 1) + (owner && owner.emp && owner.element === 'storm' ? 2 : 0), done = [f];
    const zap = owner && has(owner, 'overload') ? 2 : 1;
    let from = f;
    for (let j = 0; j < jumps; j++) {
      let best = null, bd = 170;
      for (const q of w.players) {
        if (done.includes(q) || q.team === a.team || q.dead || q.falling > 0) continue;
        const d = Math.hypot(q.x - from.x, q.y - from.y);
        if (d < bd) { bd = d; best = q; }
      }
      if (!best) break;
      const d = bd || 1;
      ev(w, { e: 'chain', x1: r1(from.x), y1: r1(from.y), x2: r1(best.x), y2: r1(best.y) });
      best.lastArrow = { el: 'storm', chain: true };
      hurt(w, best, 4 * zap, 0, 0, 'arrow', a.owner); // arcs hurt but don't push
      done.push(best); from = best;
    }
    // nobody (or not enough enemies) to arc to: the spare arcs crackle back into the target
    const spare = jumps - (done.length - 1);
    if (spare > 0 && !f.dead) {
      ev(w, { e: 'overload', x: r1(f.x), y: r1(f.y), n: spare });
      f.lastArrow = { el: 'storm', chain: true };
      hurt(w, f, 3 * spare * zap, 0, 0, 'arrow', a.owner);
    }
  }
}
// is this arrow coming at f from the direction f is facing?
// how close to dead centre counts as a bullseye (share of the target's radius), and what it's worth
const BULLSEYE = 0.4, CRIT_MUL = 1.5;
// a pin needs a full-draw hit, then a slam into a wall or boulder within PIN_WINDOW seconds at PIN_SPEED or faster
const VOLLEY_GAP = 0.12, BLINK_RANGE = 220, HARPOON_RANGE = 420, NINJA_BLINK = 150, FLASH_RANGE = 240;
// is this archer hidden inside smoke from someone standing at (x, y)?
function inSmoke(w, q, x, y) {
  for (const z of w.zones) {
    if (z.ty !== 'smoke') continue;
    const qIn = Math.hypot(q.x - z.x, q.y - z.y) < z.r, meIn = Math.hypot(x - z.x, y - z.y) < z.r;
    if (qIn && !meIn) return true;
  }
  return false;
}
const PIN_WINDOW = 0.45, PIN_SPEED = 380, PIN_TIME = 3, PIN_IMMUNE = 4;
function breakStealth(w, p) {
  if (!(p.stealthT > 0)) return;
  p.stealthT = 0;
  if (has(p, 'ambush')) p.ambushT = 2.5;
  if (has(p, 'deathmark')) p.markReady = 2;
  ev(w, { e: 'stealthOff', id: p.id, x: r1(p.x), y: r1(p.y) });
}
function tryPin(w, f, speed) {
  if (!(f.pinT > 0) || f.dead || f.falling > 0) return;
  f.pinT = 0; // one chance: a slow bump uses it up without pinning
  if (!(speed >= PIN_SPEED)) return;
  if ((f.pinSafe || 0) > w.t) return; // just been pinned: can't be pinned again straight away
  const t = f.sure ? PIN_TIME * 0.5 : PIN_TIME;
  f.pinSafe = w.t + t + PIN_IMMUNE;
  f.stuck = Math.max(f.stuck, t); f.pinned = t; f.vx = f.vy = 0; f.knock = 0;
  if (f.pinBy) { f.lastHitBy = f.pinBy; f.lastHitT = w.t; }
  ev(w, { e: 'pinned', id: f.id, by: f.pinBy, x: r1(f.x), y: r1(f.y) });
}
function headOn(f, a) {
  const v = Math.hypot(a.vx, a.vy) || 1;
  return (-a.vx / v) * Math.cos(f.aim) + (-a.vy / v) * Math.sin(f.aim) > 0.5;
}
function arrowHit(w, a, f) {
  const v = Math.hypot(a.vx, a.vy) || 1;
  let kf = a.kb * Math.sqrt(Math.min(1, v / a.v0));
  if (a.own && has(a.own, 'barbs') && (f.stuck > 0 || f.frozen > 0)) kf *= 1.5;
  if (a.own && has(a.own, 'shatter') && (f.slow > 0 || f.frozen > 0)) kf *= 1.35;
  // Deadeye: no bonus under 200px of flight, rising to +60% at 700px
  // Marksman (every Sniper): up to +20% more from 250px to 650px
  const range = (a.own && has(a.own, 'deadeye') ? 0.6 * clamp((a.dist - 200) / 500, 0, 1) : 0)
    + (a.own && a.own.role === 'sniper' ? 0.2 * clamp((a.dist - 250) / 400, 0, 1) : 0);
  const held = f.stuck > 0 || f.frozen > 0;
  const chill = a.el === 'frost' && (f.slow > 0 || f.frozen > 0) ? 1.3 : 1; // Frost Arrows
  let dmg = a.dmg * (a.own && has(a.own, 'deeproots') && f.stuck > 0 ? 1.25 : 1) * (a.own && a.own.role === 'trapper' && held ? 1.15 : 1) * chill * (1 + range);
  // Backstab (every Assassin): a hit landing on the target's back hurts more and throws them further
  const fromBehind = (a.vx / v) * Math.cos(f.aim) + (a.vy / v) * Math.sin(f.aim) > 0.5;
  const backstab = fromBehind && a.own && a.own.role === 'assassin';
  if (backstab) { dmg *= 1.4; kf *= 1.3; ev(w, { e: 'backstab', x: r1(f.x), y: r1(f.y) }); }
  if (fromBehind && has(f, 'quickfeet')) dmg *= 0.85;
  if (a.exec && f.hp < f.maxHp * 0.4) { dmg *= 2; ev(w, { e: 'execute', x: r1(f.x), y: r1(f.y) }); } // Coup de Grace
  // Death Mark: the first hit out of stealth marks the target
  if (a.own && a.own.markReady > 0) { a.own.markReady = 0; f.markT = 5; ev(w, { e: 'marked', id: f.id, x: r1(f.x), y: r1(f.y) }); }
  // Pin: a full-draw hit arms a short window; slamming into a wall or boulder during it pins the target
  if (a.full && a.own && has(a.own, 'pin')) { f.pinT = PIN_WINDOW; f.pinBy = a.owner; f.pinAng = Math.atan2(a.vy, a.vx); }
  // Bullseye: an arrow whose path runs through the middle of the target is a critical hit
  const off = Math.abs((f.x - a.x) * a.vy / v - (f.y - a.y) * a.vx / v);
  a.crit = off <= f.r * BULLSEYE;
  if (a.star) { a.full = a.crit; a.burst = a.crit && a.burstOK; }
  const dmgHit = dmg * (a.crit ? CRIT_MUL : 1);
  f.lastArrow = { el: a.el, crit: a.crit, bolt: a.bolt, dist: a.dist, shur: a.shur };
  // Riot Shield: hits from the front are softened
  const shielded = has(f, 'riot') && headOn(f, a);
  if (shielded) ev(w, { e: 'shield', x: r1(f.x + Math.cos(f.aim) * f.r), y: r1(f.y + Math.sin(f.aim) * f.r) });
  const landed = hurt(w, f, dmgHit * (shielded ? 0.65 : 1), a.vx / v * kf * (shielded ? 0.7 : 1), a.vy / v * kf * (shielded ? 0.7 : 1), 'arrow', a.owner);
  if (!landed) return;
  if (f.stealthT > 0) breakStealth(w, f); // only an arrow hit breaks stealth; burns, poison and blasts don't
  if (a.own && !a.counted) { a.counted = true; a.own.stats.hits++; a.own.stats.longest = Math.max(a.own.stats.longest, a.dist); }
  ev(w, { e: 'hit', x: r1(a.x), y: r1(a.y), cr: a.crit ? 1 : 0, id: f.id, by: a.owner, el: a.el, b: a.bolt ? 1 : 0, ls: range > 0.3 ? 1 : 0 });
  onArrowEffects(w, a, f, true);
  if (a.burst) {
    ev(w, { e: 'burst', x: r1(a.x), y: r1(a.y), el: a.el });
    for (const q of w.players) {
      if (q === f || q.team === a.team || q.dead || q.falling > 0) continue;
      if (Math.hypot(q.x - a.x, q.y - a.y) < 80 + q.r) { q.lastArrow = { el: a.el, burst: true }; hurt(w, q, 3, 0, 0, 'arrow', a.owner); onArrowEffects(w, a, q, false); }
    }
  }
}

function segDist(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / L2, 0, 1);
  return Math.hypot(x1 + dx * t - px, y1 + dy * t - py);
}
function updateArrows(w, dt) {
  const walls = w.zones.filter(z => z.ty === 'wall');
  const born = [];
  outer:
  for (let i = w.arrows.length - 1; i >= 0; i--) {
    const a = w.arrows[i];
    if (a.stuck > 0) { a.stuck -= dt; if (a.stuck <= 0) w.arrows.splice(i, 1); continue; }
    a.age += dt;
    // Seeker Arrow: bend toward the nearest enemy ahead
    if (a.seek && a.age < 1.2) {
      const h = Math.atan2(a.vy, a.vx); let best = null, bd = 380;
      for (const q of w.players) {
        if (q.team === a.team || q.dead || q.falling > 0 || a.hit.includes(q.id)) continue;
        const d = Math.hypot(q.x - a.x, q.y - a.y);
        if (d < bd && angOff(Math.atan2(q.y - a.y, q.x - a.x), h) < 1.1) { bd = d; best = q; }
      }
      if (best) {
        const want = Math.atan2(best.y - a.y, best.x - a.x), diff = ((want - h + Math.PI) % TAU + TAU) % TAU - Math.PI;
        const turn = clamp(diff, -2.2 * dt, 2.2 * dt), sp = Math.hypot(a.vx, a.vy);
        a.vx = Math.cos(h + turn) * sp; a.vy = Math.sin(h + turn) * sp;
      }
    }
    // Boomerang: out, then back to the thrower, able to hit everyone again
    if (a.boom) {
      const o = a.own;
      if (!a.back && a.age > 0.42) { a.back = true; a.hit = []; a.life = 1.6; a.drag = 0; ev(w, { e: 'boomTurn', x: r1(a.x), y: r1(a.y) }); }
      if (a.back) {
        if (!o || o.dead || o.falling > 0) a.life = 0;
        else {
          const dx = o.x - a.x, dy = o.y - a.y, d = Math.hypot(dx, dy) || 1, sp = Math.max(760, Math.hypot(a.vx, a.vy));
          a.vx = dx / d * sp; a.vy = dy / d * sp;
          if (d < o.r + 12) { w.arrows.splice(i, 1); ev(w, { e: 'catch', id: o.id }); continue outer; }
        }
      }
    }
    // Curve Shot: steer toward where the archer is aiming now
    if (a.curve && a.own && !a.own.dead && a.age < 0.9) {
      const cur = Math.atan2(a.vy, a.vx), want = a.own.aim;
      const diff = ((want - cur + Math.PI) % TAU + TAU) % TAU - Math.PI;
      const turn = clamp(diff, -0.9 * dt, 0.9 * dt), sp = Math.hypot(a.vx, a.vy);
      a.vx = Math.cos(cur + turn) * sp; a.vy = Math.sin(cur + turn) * sp;
    }
    const sp = Math.hypot(a.vx, a.vy);
    const steps = Math.max(1, Math.ceil(sp * dt / 10));
    const sdt = dt / steps;
    for (let s = 0; s < steps; s++) {
      a.x += a.vx * sdt; a.y += a.vy * sdt; a.dist += sp * sdt;
      if (a.x < WALL || a.x > AW - WALL) {
        a.x = clamp(a.x, WALL, AW - WALL);
        if (a.bounces > 0) { a.bounces--; a.vx *= -1; ev(w, { e: 'ping', x: r1(a.x), y: r1(a.y) }); }
        else { stickArrow(w, a, 4); continue outer; }
      }
      if (a.y < WALL || a.y > AH - WALL) {
        a.y = clamp(a.y, WALL, AH - WALL);
        if (a.bounces > 0) { a.bounces--; a.vy *= -1; ev(w, { e: 'ping', x: r1(a.x), y: r1(a.y) }); }
        else { stickArrow(w, a, 4); continue outer; }
      }
      for (const p of PILLARS) {
        const dx = a.x - p.x, dy = a.y - p.y, d = Math.hypot(dx, dy);
        if (d < p.r) {
          const nx = dx / (d || 1), ny = dy / (d || 1);
          if (a.bounces > 0) {
            a.bounces--; const vn = a.vx * nx + a.vy * ny;
            a.vx -= 2 * vn * nx; a.vy -= 2 * vn * ny;
            a.x = p.x + nx * (p.r + 1); a.y = p.y + ny * (p.r + 1);
            ev(w, { e: 'ping', x: r1(a.x), y: r1(a.y) });
          } else { a.x = p.x + nx * p.r; a.y = p.y + ny * p.r; stickArrow(w, a, 3); continue outer; }
        }
      }
      // shield walls stop enemy arrows
      for (const z of walls) {
        if (z.team === a.team) continue;
        if (segDist(a.x, a.y, z.x, z.y, z.x2, z.y2) < 6) { ev(w, { e: 'blocked', x: r1(a.x), y: r1(a.y) }); stickArrow(w, a, 2); continue outer; }
      }
      for (const f of w.players) {
        if (f.team === a.team || f.dead || f.falling > 0 || a.hit.includes(f.id) || f.phaseT > 0) continue;
        if (Math.hypot(f.x - a.x, f.y - a.y) < f.r + (a.big ? 10 : 4)) {
          if (f.deflectT > 0 && headOn(f, a)) {
            // Deflect: send it back where it came from, as the deflector's arrow
            const src = a.own && !a.own.dead ? a.own : null, sp2 = Math.hypot(a.vx, a.vy) * 1.05;
            const ang = src ? Math.atan2(src.y - f.y, src.x - f.x) : Math.atan2(-a.vy, -a.vx);
            Object.assign(a, { team: f.team, owner: f.id, own: f, color: f.color, vx: Math.cos(ang) * sp2, vy: Math.sin(ang) * sp2, v0: Math.max(a.v0, sp2), hit: [f.id], dist: 0, life: 2, bounces: 0, counted: false, dmg: a.dmg * 0.6, kb: a.kb * 0.6 });
            a.x = f.x + Math.cos(ang) * (f.r + 6); a.y = f.y + Math.sin(ang) * (f.r + 6);
            ev(w, { e: 'deflect', x: r1(a.x), y: r1(a.y), id: f.id });
            continue outer;
          }
          arrowHit(w, a, f);
          // Switcheroo: trade places with whoever the arrow hit
          if (a.swap && a.own && !a.own.dead && a.own.falling <= 0 && !f.dead && f.falling <= 0) {
            const o = a.own, ox = o.x, oy = o.y;
            ev(w, { e: 'swap', x1: r1(o.x), y1: r1(o.y), x2: r1(f.x), y2: r1(f.y) });
            o.x = f.x; o.y = f.y; f.x = ox; f.y = oy; o.vx = o.vy = 0; f.vx = -f.vx; f.vy = -f.vy; f.stuck = Math.max(f.stuck, 0.6); a.swap = false; // they keep flying away from you
          }
          if (a.explosive) explode(w, a.x, a.y, a.owner, a.team);
          if (a.pierce > 0 && !a.explosive) { a.pierce--; a.hit.push(f.id); if (!a.rail && !a.boom) { a.vx *= 0.8; a.vy *= 0.8; } continue; }
          w.arrows.splice(i, 1);
          continue outer;
        }
      }
    }
    // Split Arrow: one full-draw arrow becomes three
    if (a.split && a.dist > 260) {
      a.split = false;
      const base = Math.atan2(a.vy, a.vx), v = Math.hypot(a.vx, a.vy);
      for (const off of [-0.2, 0.2]) {
        born.push(Object.assign({}, a, { id: w.nid++, vx: Math.cos(base + off) * v, vy: Math.sin(base + off) * v,
          dmg: a.dmg * 0.4, kb: a.kb * 0.45, hit: a.hit.slice(), burst: false, pierce: 0 }));
      }
      a.dmg *= 0.4; a.kb *= 0.45;
      ev(w, { e: 'split', x: r1(a.x), y: r1(a.y) });
    }
    a.ang = Math.atan2(a.vy, a.vx);
    const drag = Math.exp(-a.drag * dt);
    a.vx *= drag; a.vy *= drag;
    a.life -= dt;
    if (a.life <= 0 || Math.hypot(a.vx, a.vy) < 170) {
      a.stuck = 1.2; a.vx = a.vy = 0;
      if (a.own && a.own.emp && a.own.element === 'flame' && !a.own.dead) blazePatch(w, a.own, a.x, a.y, 32, 2.2);
      if (a.explosive) { explode(w, a.x, a.y, a.owner, a.team); a.stuck = 0.01; }
    }
  }
  for (const b of born) w.arrows.push(b);
}

// ---------------- pickups ----------------
// Amber only appears on the centre line, as a mirrored pair, so it's never closer to one team's side.
// Powerups only appear at the exact centre.
function amberSpotFree(x, y) {
  if (HAZ.some(h => h.type !== 'tar' && inHaz(h, x, y, 24))) return false;
  if (PILLARS.some(p => Math.hypot(x - p.x, y - p.y) < p.r + 26)) return false;
  return true;
}
function spawnAmberPair(w) {
  const [y0, y1] = MAP.amberY;
  for (let t = 0; t < 30; t++) {
    const y = rand(y0, y1);
    const spots = [{ x: CENTER_X, y }, { x: CENTER_X, y: AH - y }];
    if (!spots.every(s => amberSpotFree(s.x, s.y))) continue;
    if (spots.some(s => w.pickups.some(u => Math.hypot(u.x - s.x, u.y - s.y) < 60))) continue;
    for (const s of spots) {
      w.pickups.push({ id: w.nid++, x: s.x, y: s.y, type: 'amber', life: 22, age: 0 });
      ev(w, { e: 'puSpawn', x: r1(s.x), y: r1(s.y), ty: 'amber' });
    }
    return;
  }
}
// powerups appear at the arena's power spots, taking turns so no side is favoured
function spawnCenterPower(w) {
  if (w.pickups.some(u => u.type !== 'amber')) return;
  const spot = MAP.power[w.powerIdx++ % MAP.power.length];
  const type = Math.random() < 0.2 ? 'heal' : pick(PU_TIMED);
  w.pickups.push({ id: w.nid++, x: spot.x, y: spot.y, type, life: 16, age: 0 });
  ev(w, { e: 'puSpawn', x: spot.x, y: spot.y, ty: type });
}
function spawnChannel(w) {
  if (w.pickups.some(u => u.type !== 'amber')) { w.chT = 4; return; }
  const spot = MAP.power[w.powerIdx++ % MAP.power.length];
  const type = pick(Object.keys(CHANNEL));
  w.pickups.push({ id: w.nid++, x: spot.x, y: spot.y, type, life: 25, age: 0, chan: true, cp: 0, ct: null, cs: 0 });
  ev(w, { e: 'chanSpawn', x: spot.x, y: spot.y, ty: type });
}
function captureChannel(w, u, team, who) {
  const foes = w.players.filter(q => q.team !== team && !q.dead && q.falling <= 0);
  if (u.type === 'winter') for (const q of foes) {
    const t = q.sure ? 2 : 4;
    q.frozen = Math.max(q.frozen, t); q.stuck = Math.max(q.stuck, t); q.disarm = Math.max(q.disarm, t / 2); q.drawing = false; q.charge = 0;
    q.lastHitBy = who.id; q.lastHitT = w.t;
  }
  if (u.type === 'thunder') for (const q of foes) { ev(w, { e: 'thunder', x: r1(q.x), y: r1(q.y) }); q.lastArrow = null; hurt(w, q, 15, 0, 0, 'thunder', who.id); }
  if (u.type === 'sanctuary') for (const q of members(w, team)) if (!q.dead) q.hp = Math.min(q.maxHp, q.hp + 40);
  ev(w, { e: 'chanDone', ty: u.type, tm: team, id: who.id, n: who.name, x: r1(u.x), y: r1(u.y) });
}
function updateChannel(w, u, dt) {
  const inside = w.players.filter(p => !p.dead && p.falling <= 0 && Math.hypot(p.x - u.x, p.y - u.y) < CHANNEL_R + p.r * 0.5);
  const teams = [...new Set(inside.map(p => p.team))];
  u.cs = teams.length > 1 ? 1 : 0;
  if (teams.length === 1) {
    const t = teams[0];
    if (u.ct && u.ct !== t && u.cp > 0) u.cp = Math.max(0, u.cp - dt / CHANNEL_TIME * 1.5); // wind the other team's progress back first
    else { u.ct = t; u.cp += dt / CHANNEL_TIME; }
    if (u.cp >= 1) { captureChannel(w, u, t, inside[0]); return true; }
  } else if (!teams.length) u.cp = Math.max(0, u.cp - dt / CHANNEL_TIME * 0.5);
  return false;
}
function updatePickups(w, dt) {
  w.amberT -= dt; w.puT -= dt;
  w.chT = (w.chT == null ? 20 : w.chT) - dt;
  if (w.chT <= 0) { w.chT = rand(30, 40); spawnChannel(w); }
  if (w.amberT <= 0) { w.amberT = rand(3.5, 5); if (w.pickups.filter(u => u.type === 'amber').length < 6) spawnAmberPair(w); }
  if (w.puT <= 0) { w.puT = rand(12, 16); spawnCenterPower(w); }
  for (let i = w.pickups.length - 1; i >= 0; i--) {
    const u = w.pickups[i];
    u.age += dt;
    if (u.age > u.life) { w.pickups.splice(i, 1); continue; }
    if (u.chan) { if (updateChannel(w, u, dt)) { w.pickups.splice(i, 1); w.chT = rand(30, 40); } continue; }
    for (const p of w.players) {
      if (p.dead || p.falling > 0) continue;
      if (Math.hypot(u.x - p.x, u.y - p.y) < p.r + 16) {
        if (u.type === 'amber') {
          // a little health and a head start on your cooldowns
          const g = AMBER.pickup; p.amber += g; p.earned += g;
          p.hp = Math.min(p.maxHp, p.hp + AMBER_BOOST.hp);
          if (p.dashN < p.dashMaxN) p.dashCd = Math.max(0, p.dashCd - AMBER_BOOST.dash);
          p.abCd = p.abCd.map(c => Math.max(0, c - AMBER_BOOST.ability));
        }
        else if (u.type === 'heal') p.hp = Math.min(p.maxHp, p.hp + 40);
        else p.pw[u.type] = PU[u.type].dur;
        ev(w, { e: 'pick', id: p.id, ty: u.type, x: r1(u.x), y: r1(u.y) });
        w.pickups.splice(i, 1);
        break;
      }
    }
  }
}

// ---------------- bots ----------------
function lethalDist(x, y) {
  let m = Infinity;
  for (const h of HAZ) if (h.type !== 'tar') m = Math.min(m, hazAway(h, x, y).dist);
  for (const h of WARN) m = Math.min(m, hazAway(h, x, y).dist);
  // spike walls count as lethal edges
  for (const s of SPIKES) {
    if (s.side === 'top' && x > s.a && x < s.b) m = Math.min(m, y - WALL);
    if (s.side === 'bottom' && x > s.a && x < s.b) m = Math.min(m, AH - WALL - y);
    if (s.side === 'left' && y > s.a && y < s.b) m = Math.min(m, x - WALL);
    if (s.side === 'right' && y > s.a && y < s.b) m = Math.min(m, AW - WALL - x);
  }
  return m;
}
function clearShot(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1;
  for (const p of PILLARS) {
    const t = clamp(((p.x - x1) * dx + (p.y - y1) * dy) / L2, 0, 1);
    if (Math.hypot(x1 + dx * t - p.x, y1 + dy * t - p.y) < p.r + 5) return false;
  }
  return true;
}
function botSteer(p, gx, gy) {
  let dx = gx, dy = gy;
  // with momentum, judge danger from where we'll be shortly, not where we are
  const lx = p.x + p.vx * 0.8, ly = p.y + p.vy * 0.8;
  for (const h of WARN.length ? HAZ.concat(WARN) : HAZ) {
    const a0 = hazAway(h, p.x, p.y), a1 = hazAway(h, lx, ly);
    const a = a1.dist < a0.dist ? a1 : a0;
    const margin = p.r + (h.type === 'tar' ? 34 : 60);
    if (a.dist < margin) { const k = (margin - a.dist) / margin * 3; dx += a.nx * k; dy += a.ny * k; }
  }
  for (const q of PILLARS) {
    const ex = p.x - q.x, ey = p.y - q.y, d = Math.hypot(ex, ey) || 1, m = q.r + p.r + 24;
    if (d < m) { const k = (m - d) / m * 2; dx += ex / d * k; dy += ey / d * k; }
  }
  const E = 80;
  if (p.x < WALL + E) dx += (WALL + E - p.x) / E * 1.6;
  if (p.x > AW - WALL - E) dx -= (p.x - (AW - WALL - E)) / E * 1.6;
  if (p.y < WALL + E) dy += (WALL + E - p.y) / E * 1.6;
  if (p.y > AH - WALL - E) dy -= (p.y - (AH - WALL - E)) / E * 1.6;
  const l = Math.hypot(dx, dy);
  return l < 0.05 ? [0, 0] : [dx / l, dy / l];
}

function botThink(w, p, dt) {
  const ai = p.ai, inp = p.input, D = DIFF[p.diff] || DIFF.normal;
  if (p.dead || p.falling > 0) { inp.draw = false; inp.mx = inp.my = 0; return; }
  // stealthed enemies are invisible to bots unless they're right next to them
  const foes = w.players.filter(q => q.team !== p.team && !q.dead && q.falling <= 0 && !(q.stealthT > 0 && Math.hypot(q.x - p.x, q.y - p.y) > 110) && !(inSmoke(w, q, p.x, p.y) && Math.hypot(q.x - p.x, q.y - p.y) > 60)
    && !(p.shroudT > 0 && Math.hypot(q.x - p.x, q.y - p.y) > (p.shroudR || 170) + 20));
  const mates = w.players.filter(q => q.team === p.team && q !== p && !q.dead);
  ai.retarget -= dt;
  let T = foes.find(q => q.id === ai.target);
  if (!T || ai.retarget <= 0) {
    let bestS = Infinity;
    for (const q of foes) {
      const s = Math.hypot(q.x - p.x, q.y - p.y) + q.hp * 1.5 - (lethalDist(q.x, q.y) < 120 ? 150 : 0) + (q.inv > 0 ? 400 : 0);
      if (s < bestS) { bestS = s; T = q; }
    }
    ai.target = T ? T.id : null;
    ai.retarget = rand(0.8, 1.6);
  }

  // --- movement goal
  let gx = 0, gy = 0;
  const dT = T ? Math.hypot(T.x - p.x, T.y - p.y) : Infinity;
  // amber is worth a detour; a teammate already heading there means leave it
  const pk = w.pickups.reduce((best, u) => {
    const d = Math.hypot(u.x - p.x, u.y - p.y);
    const range = u.type === 'amber' ? 380 : 320;
    const mateCloser = mates.some(m => Math.hypot(u.x - m.x, u.y - m.y) < d * 0.8);
    return d < range && !mateCloser && (!best || d < best.d) ? { u, d } : best;
  }, null);
  ai.strafeT -= dt;
  if (ai.strafeT <= 0) { ai.strafe *= -1; ai.strafeT = rand(0.9, 2.4); }
  const hurtBad = HEAL && p.hp < p.maxHp * 0.5 && (!T || dT > 170);
  const healD = HEAL ? Math.hypot(HEAL.x - p.x, HEAL.y - p.y) : 0;
  const fallen = has(p, 'revive') && !p.reviveUsed ? mates.length >= 0 && w.players.find(q => q.team === p.team && q.dead && q.lastCause !== 'join' && q.lastCause !== 'switch') : null;
  const safeToRevive = fallen && !foes.some(q => Math.hypot(q.x - fallen.x, q.y - fallen.y) < 230);
  // big capture powerups: most bots go and stand in them, and fight over them
  const chan = w.pickups.find(u => u.chan);
  const chanD = chan ? Math.hypot(chan.x - p.x, chan.y - p.y) : Infinity;
  const wantChan = chan && chanD < 620 && (ai.aggr == null ? 0.6 : ai.aggr) > 0.3 && p.hp > p.maxHp * 0.3;
  if (wantChan && !safeToRevive) {
    gx = (chan.x - p.x) / 60 - p.vx / 160; gy = (chan.y - p.y) / 60 - p.vy / 160;
    if (chanD < CHANNEL_R * 0.6 && Math.hypot(gx, gy) < 0.4) { gx = 0; gy = 0; }
  } else if (safeToRevive) {
    // arrive and hold still: aim for the spot, minus our own momentum
    const d = Math.hypot(fallen.x - p.x, fallen.y - p.y) || 1;
    gx = (fallen.x - p.x) / 70 - p.vx / 140; gy = (fallen.y - p.y) / 70 - p.vy / 140;
    if (d < 30 && Math.hypot(gx, gy) < 0.35) { gx = 0; gy = 0; }
  } else if (hurtBad) {
    if (healD > HEAL.r * 0.5) { gx = (HEAL.x - p.x) / healD; gy = (HEAL.y - p.y) / healD; }
    else { gx = -(p.y - HEAL.y) / (healD || 1) * ai.strafe * 0.4; gy = (p.x - HEAL.x) / (healD || 1) * ai.strafe * 0.4; }
  } else if (pk && !pk.u.chan && (!T || pk.d < dT * 1.2)) {
    gx = (pk.u.x - p.x) / pk.d; gy = (pk.u.y - p.y) / pk.d;
  } else if (T) {
    // keep the distance this bot's playstyle likes; aggressive bots close in, cautious ones hang back
    const st = STYLES[ai.style] || STYLES.skirmisher, ag = ai.aggr == null ? 0.6 : ai.aggr;
    const near = st.near * (1.3 - ag * 0.6), far = st.far * (1.25 - ag * 0.5);
    const dx = T.x - p.x, dy = T.y - p.y, d = dT || 1, ux = dx / d, uy = dy / d;
    const shaky = p.hp < p.maxHp * 0.35 && ag < 0.65 && d < far * 1.2;
    if (shaky || d < near) { gx = -ux; gy = -uy; }
    else if (d > far || !clearShot(p.x, p.y, T.x, T.y)) { gx = ux * 0.8 - uy * ai.strafe * 0.5; gy = uy * 0.8 + ux * ai.strafe * 0.5; }
    else { gx = -uy * ai.strafe; gy = ux * ai.strafe; }
    // guardians stay close to their team
    if (st.mates && mates.length) {
      const m = mates.reduce((b, q) => { const dd = Math.hypot(q.x - p.x, q.y - p.y); return !b || dd < b.d ? { q, d: dd } : b; }, null);
      if (m.d > 200) { gx += (m.q.x - p.x) / m.d * 0.8; gy += (m.q.y - p.y) / m.d * 0.8; }
    }
    // dash-bash: brawlers (and bots with Battering Ram) dash straight into people
    ai.bashCd = (ai.bashCd || 0) - dt;
    const bashy = st.bash * ag * (has(p, 'ram') ? 1.6 : 1);
    if (d < 240 && d > 40 && p.dashN > 0 && ai.bashCd <= 0 && clearShot(p.x, p.y, T.x, T.y) && Math.random() < bashy * dt * 3) {
      const lead = 0.25, bx = T.x + T.vx * lead, by = T.y + T.vy * lead, ang = Math.atan2(by - p.y, bx - p.x);
      if (lethalDist(p.x + Math.cos(ang) * (d + 40), p.y + Math.sin(ang) * (d + 40)) > 50) { p.wantDash = true; ai.dashAim = ang; ai.bashCd = rand(1.5, 3); }
    }
  } else {
    gx = (AW / 2 - p.x) / 300; gy = (AH / 2 - p.y) / 300;
  }
  // stealthed: circle round to the far side of the target, so the shot throws them into a hazard or wall (or at least hits their back)
  if (p.stealthT > 0 && T) {
    const pt = ambushPoint(p, T); ai.ambush = pt;
    const d = Math.hypot(pt.x - p.x, pt.y - p.y) || 1;
    gx = (pt.x - p.x) / d; gy = (pt.y - p.y) / d;
    if (d < 40) { gx *= d / 40; gy *= d / 40; }
  } else ai.ambush = null;
  // spread out from teammates a little
  for (const m of mates) {
    const dx = p.x - m.x, dy = p.y - m.y, d = Math.hypot(dx, dy) || 1;
    if (d < 90) { gx += dx / d * (90 - d) / 90; gy += dy / d * (90 - d) / 90; }
  }

  // --- dodge incoming enemy arrows
  ai.dodgeCd -= dt;
  for (const a of w.arrows) {
    if (a.team === p.team || a.stuck > 0) continue;
    const rx = p.x - a.x, ry = p.y - a.y, v2 = a.vx * a.vx + a.vy * a.vy || 1;
    const t = (rx * a.vx + ry * a.vy) / v2;
    if (t <= 0 || t > 0.4) continue;
    const cx = rx - a.vx * t, cy = ry - a.vy * t, cd = Math.hypot(cx, cy);
    if (cd < p.r + 14) {
      let px = -a.vy, py = a.vx; const pl = Math.hypot(px, py) || 1; px /= pl; py /= pl;
      if (px * cx + py * cy < 0) { px = -px; py = -py; }
      gx = px * 2 + gx * 0.3; gy = py * 2 + gy * 0.3;
      if (ai.dodgeCd <= 0) {
        ai.dodgeCd = 0.7;
        if (Math.random() < D.dodge && p.dashN > 0 && lethalDist(p.x + px * 130, p.y + py * 130) > 40) { p.wantDash = true; ai.dashAim = Math.atan2(py, px); }
      }
      break;
    }
  }
  const [mx, my] = botSteer(p, gx, gy);
  inp.mx = mx; inp.my = my;

  // --- aim & shoot
  ai.reload -= dt;
  ai.errT -= dt;
  if (ai.errT <= 0) { ai.err = rand(-1, 1) * D.aimErr * (p.shroudT > 0 ? (p.shroudR < 150 ? 3.5 : 2.2) : 1); ai.errT = rand(0.3, 0.6); }
  if (!T) { ai.lastT = null; inp.draw = false; botAbilities(w, p, null, Infinity, foes, dt); if (p.wantDash && ai.dashAim != null) inp.aim = ai.dashAim; ai.dashAim = null; return; }
  const spd = (380 + 920 * Math.max(p.charge, ai.want)) * OPT('aspeed');
  // aim at where the target *appeared* to be (and to be heading) a reaction-time ago, like a person would
  const S = perceived(w, T, D.see || 0.24);
  const lt = Math.hypot(S[0] - p.x, S[1] - p.y) / spd * D.lead;
  const ax = S[0] + S[2] * (lt + (D.see || 0.24) * 0.5), ay = S[1] + S[3] * (lt + (D.see || 0.24) * 0.5);
  const wantAim = Math.atan2(ay - p.y, ax - p.x) + ai.err;
  // like a person: a moment to notice a new target (longer if it's behind them), then a limited turning speed
  if (ai.aimA == null) ai.aimA = p.aim;
  if (T.id !== ai.lastT) {
    ai.lastT = T.id;
    const behind = angOff(ai.aimA, Math.atan2(T.y - p.y, T.x - p.x)) > 1.6;
    ai.reactT = D.react + rand(0.15, 0.35) + (behind ? rand(0.2, 0.4) : 0);
  }
  ai.reactT = Math.max(0, (ai.reactT || 0) - dt);
  if (ai.reactT <= 0) {
    const diff = ((wantAim - ai.aimA + Math.PI) % TAU + TAU) % TAU - Math.PI, step = (D.turn || 5.5) * dt;
    ai.aimA += clamp(diff, -step, step);
  }
  inp.aim = ai.aimA;
  const onTarget = ai.reactT <= 0 && angOff(ai.aimA, wantAim) < 0.15;
  const los = clearShot(p.x, p.y, T.x, T.y);
  if (p.role === 'ninja') {
    // shuriken: keep throwing while lined up and in range
    inp.draw = los && onTarget && dT < 520 && T.inv <= 0 && !(p.stealthT > 0.6 && dT > 170 && !(ai.ambush && Math.hypot(ai.ambush.x - p.x, ai.ambush.y - p.y) < 70));
  } else if (!inp.draw) {
    if (ai.reload <= 0) {
      inp.draw = true;
      const st = STYLES[ai.style];
      ai.want = lethalDist(T.x, T.y) < 130 ? 1 : dT < 150 ? 0.35 : st && st.charge ? rand(Math.max(D.minCharge * 0.7, st.charge[0]), st.charge[1]) : rand(D.minCharge, 1);
    }
  } else if (p.charge >= ai.want && los && onTarget && T.inv <= 0 && !(has(p, 'ballista') && ai.want >= 1 && p.over < 1 && dT > 250) && !(p.stealthT > 0.6 && dT > 170 && !(ai.ambush && Math.hypot(ai.ambush.x - p.x, ai.ambush.y - p.y) < 70))) {
    inp.draw = false;
    ai.reload = rand(0.05, 0.3) + D.react;
  }
  botAbilities(w, p, T, dT, foes, dt);
  if (p.wantDash && ai.dashAim != null) inp.aim = ai.dashAim; // a dodge dash points the way out
  ai.dashAim = null;
}


// bots fire their abilities when the situation clearly calls for it
function ambushPoint(p, T) {
  let best = null;
  for (const h of HAZ) { if (h.type === 'tar') continue; const a = hazAway(h, T.x, T.y); if (a.dist < 260 && (!best || a.dist < best.d)) best = { nx: a.nx, ny: a.ny, d: a.dist }; }
  for (const [d, nx, ny] of [[T.x - WALL, 1, 0], [AW - WALL - T.x, -1, 0], [T.y - WALL, 0, 1], [AH - WALL - T.y, 0, -1]])
    if (d < 200 && (!best || d < best.d)) best = { nx, ny, d };
  let x, y;
  if (best) { x = T.x + best.nx * 150; y = T.y + best.ny * 150; } // stand opposite the danger: the shot pushes them into it
  else { x = T.x - Math.cos(T.aim) * 150; y = T.y - Math.sin(T.aim) * 150; } // otherwise, their back
  x = clamp(x, WALL + 40, AW - WALL - 40); y = clamp(y, WALL + 40, AH - WALL - 40);
  if (lethalDist(x, y) < 50) { x = T.x - Math.cos(T.aim) * 150; y = T.y - Math.sin(T.aim) * 150; x = clamp(x, WALL + 40, AW - WALL - 40); y = clamp(y, WALL + 40, AH - WALL - 40); }
  return { x, y };
}
function perceived(w, T, lag) {
  const H = w.hist; if (!H || !H.length) return [T.x, T.y, T.vx, T.vy];
  const want = w.t - lag; let e = H[0];
  for (const h of H) { if (h.t <= want) e = h; else break; }
  const r = e.p.find(x => x[0] === T.id);
  return r ? [r[1], r[2], r[3], r[4]] : [T.x, T.y, T.vx, T.vy];
}
function angOff(a, b) { return Math.abs(((a - b + Math.PI) % TAU + TAU) % TAU - Math.PI); }
function botAbilities(w, p, T, dT, foes, dt) {
  for (let i = 0; i < MAX_SLOTS; i++) {
    const id = p.slots[i];
    if (!id || p.abCd[i] > 0) continue;
    let use = false;
    switch (id) {
      case 'gust': use = !!T && dT < 190 && angOff(Math.atan2(T.y - p.y, T.x - p.x), p.input.aim) < 0.4; break;
      case 'quake': use = foes.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 140); break;
      case 'snare': use = p.charge > 0.55 && !!T && dT < 450; break;
      case 'blink': {
        // escape when thrown toward danger, or (brawlers and stalkers) close in fast
        const danger = p.knock > 0 && lethalDist(p.x + p.vx * 0.3, p.y + p.vy * 0.3) < 40;
        const st = STYLES[p.ai.style];
        if (danger) { const a = Math.atan2(AH / 2 - p.y, AW / 2 - p.x); p.input.tx = p.x + Math.cos(a) * 200; p.input.ty = p.y + Math.sin(a) * 200; use = true; }
        else if (T && st && (st.name === 'Stalker' || st.name === 'Brawler') && dT > 280 && dT < 480 && Math.random() < dt) { p.input.tx = T.x; p.input.ty = T.y; use = true; }
        break;
      }
      case 'harpoon': use = !!T && dT > 140 && dT < HARPOON_RANGE - 20 && angOff(Math.atan2(T.y - p.y, T.x - p.x), p.input.aim) < 0.12 && Math.random() < dt * 2; break;
      case 'recoil': use = !!T && dT < 190 && p.charge > 0.5; break;
      case 'spot': if (T && dT < 700) { p.input.tx = T.x; p.input.ty = T.y; use = true; } break;
      case 'rush': {
        if (!T || dT < 110 || dT > 330 || angOff(Math.atan2(T.y - p.y, T.x - p.x), p.input.aim) > 0.2) break;
        const ax = Math.cos(p.input.aim), ay = Math.sin(p.input.aim);
        use = [80, 160, 240, 300].every(d => lethalDist(p.x + ax * d, p.y + ay * d) > 45);
        break;
      }
      case 'fortify': use = p.hp < p.maxHp * 0.5 && foes.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 380); break;
      case 'wind': use = p.hp < p.maxHp * 0.4 || (p.dashN === 0 && !!T && dT < 200); break;
      case 'seeker': use = p.charge > 0.5 && !!T && dT > 220; break;
      case 'swap': use = p.charge > 0.6 && !!T && dT < 520 && Math.random() < dt * 2; break;
      case 'boomerang': use = p.charge > 0.6 && !!T && dT < 440; break;
      case 'execute': use = !!T && T.hp < T.maxHp * 0.45 && p.charge > 0.3; break;
      case 'sstrike': if (T && dT < 340 && dT > 90 && lethalDist(T.x, T.y) < 200) { p.input.tx = T.x; p.input.ty = T.y; use = true; } break;
      case 'clone': use = (p.hp < p.maxHp * 0.55 && foes.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 350)) || (!!T && dT < 300 && Math.random() < dt * 0.3); break;
      case 'blossom': use = foes.filter(q => Math.hypot(q.x - p.x, q.y - p.y) < 220).length >= 2 || foes.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 110); break;
      case 'recall':
        if (!p.markPos) use = !foes.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 260) && lethalDist(p.x, p.y) > 120 && Math.random() < dt;
        else use = p.hp < p.maxHp * 0.4 || p.falling > 0 || (p.knock > 0 && lethalDist(p.x + p.vx * 0.3, p.y + p.vy * 0.3) < 40);
        break;
      case 'railshot': use = p.charge > 0.6 && !!T && dT > 250 && !p.railArmed; break;
      case 'totem': use = p.hp < p.maxHp * 0.6 && !foes.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 200); break;
      case 'smoke': if (T && p.hp < p.maxHp * 0.45 && dT < 350) { p.input.tx = p.x; p.input.ty = p.y; use = true; } break;
      case 'volley': use = p.charge > 0.5 && !!T && dT < 480 && !p.volleyArmed; break;
      case 'trap':
        // throw it where the target is heading
        if (T && dT < TRAP_RANGE + 60 && dT > 60 && Math.random() < dt * 0.8) { p.input.tx = T.x + T.vx * 0.6; p.input.ty = T.y + T.vy * 0.6; use = true; }
        break;
      case 'stealth': use = !!T && ((dT > 260 && dT < 650 && p.hp > p.maxHp * 0.4) || (p.hp < p.maxHp * 0.35 && dT < 300)); break;
      case 'deflect': {
        const inc = w.arrows.some(a => {
          if (a.team === p.team || a.stuck > 0) return false;
          const rx = p.x - a.x, ry = p.y - a.y, v2 = a.vx * a.vx + a.vy * a.vy || 1, t = (rx * a.vx + ry * a.vy) / v2;
          return t > 0 && t < 0.35 && Math.hypot(rx - a.vx * t, ry - a.vy * t) < p.r + 10;
        });
        if (inc && T) { p.input.aim = Math.atan2(T.y - p.y, T.x - p.x); use = true; }
        break;
      }
      case 'rain':
        if (T && dT < 500 && dT > 120) { p.input.tx = T.x + T.vx * 0.7; p.input.ty = T.y + T.vy * 0.7; use = true; }
        break;
      case 'wall': {
        const threat = foes.find(q => q.drawing && q.charge > 0.6 && Math.hypot(q.x - p.x, q.y - p.y) < 600 && angOff(q.aim, Math.atan2(p.y - q.y, p.x - q.x)) < 0.2);
        if (threat) { p.input.aim = Math.atan2(threat.y - p.y, threat.x - p.x); use = true; }
        break;
      }
      case 'grapple': {
        // escape: when being thrown toward something deadly, reel to the nearest boulder or back toward the middle
        if (p.knock > 0 && lethalDist(p.x + p.vx * 0.4, p.y + p.vy * 0.4) < 40) {
          const anchor = PILLARS.reduce((b, q) => { const d = Math.hypot(q.x - p.x, q.y - p.y); return d > 80 && d < 460 && (!b || d < b.d) ? { q, d } : b; }, null);
          p.input.aim = anchor ? Math.atan2(anchor.q.y - p.y, anchor.q.x - p.x) : Math.atan2(AH / 2 - p.y, AW / 2 - p.x);
          use = true;
        }
        break;
      }
    }
    if (use) { p.aim = p.input.aim; p.wantAb[i] = true; }
  }
}

// ---------------- step ----------------
function step(w, dt) {
  useMap(w);
  w.t += dt;
  const M = w.match;
  if (M.ph === 'lobby') return;
  M.T -= dt;
  if (M.ph === 'pre') {
    for (const p of w.players) { if (p.bot) p.aim = Math.atan2(AH / 2 - p.y, AW / 2 - p.x); else p.aim = p.input.aim; p.wantDash = false; }
    if (M.T <= 0) { M.ph = 'play'; M.T = TIMES.game; M.gStart = w.t; w.amberT = 0.4; w.puT = 6; w.chT = rand(18, 26); ev(w, { e: 'phase', ph: 'play', rd: M.rd, gm: M.gm }); }
    return;
  }
  if (M.ph === 'post') { if (M.T <= 0) afterPost(w); return; }
  if (M.ph === 'pick') {
    if (M.T <= 0 || w.players.every(p => p.picked)) finishPick(w);
    return;
  }
  if (M.ph === 'over') return;

  // play
  for (const p of w.players) {
    if (p.dead) { p.revP = 0; continue; }
    const rallied = w.players.some(q => q !== p && q.team === p.team && !q.dead && has(q, 'rally') && Math.hypot(q.x - p.x, q.y - p.y) < 170);
    p.speed = p.baseSpeed * (p.windT > 0 ? 1.4 : 1) * (p.fortT > 0 ? 0.6 : 1) * (p.shroudT > 0 && p.shroudSlow ? 0.85 : 1) * (p.trapSet ? 0.5 : 1) * (rallied ? 1.15 : 1) * (p.stealthT > 0 ? 1.3 : 1) * (p.bot ? (DIFF[p.diff] || DIFF.normal).speed : 1);
    p.rallied = rallied;
  }
  // what bots perceive lags reality: remember where everyone was over the last half second
  if (w.players.some(p => p.bot)) {
    (w.hist = w.hist || []).push({ t: w.t, p: w.players.map(q => [q.id, q.x, q.y, q.vx, q.vy]) });
    while (w.hist.length > 40) w.hist.shift();
  }
  for (const p of w.players) if (p.bot) botThink(w, p, dt);
  updateCracks(w);
  // things that happen a moment later (Echo Strike)
  for (let i = w.later.length - 1; i >= 0; i--) {
    const L = w.later[i]; L.t -= dt; if (L.t > 0) continue;
    w.later.splice(i, 1);
    if (L.ty === 'volley') {
      // the rest of the burst follows your aim as it is now
      const p = w.players.find(q => q.id === L.owner && !q.dead && q.falling <= 0 && q.disarm <= 0);
      if (p) fire(w, p, p.aim, L.c, 2);
      continue;
    }
    const f = w.players.find(q => q.id === L.target && !q.dead && q.falling <= 0), own = w.players.find(q => q.id === L.owner);
    if (f && own) { ev(w, { e: 'echo', x: r1(f.x), y: r1(f.y) }); onArrowEffects(w, { el: 'storm', echo: true, team: L.team, owner: L.owner, own, full: false, crit: false }, f, true); }
  }
  for (const p of w.players) updatePlayer(w, p, dt);
  if (M.ph !== 'play') return;
  // Heavyweight (every Juggernaut) heals itself after 4 seconds unhurt
  for (const p of w.players) {
    if (p.role !== 'juggernaut' || p.dead || p.falling > 0 || p.hp >= p.maxHp || w.t - p.lastHurtT < 4) continue;
    p.hp = Math.min(p.maxHp, p.hp + 2 * dt * (p.poisonT > 0 ? 0.5 : 1)); p.healing = true;
  }
  // Mender (every Warden): you and teammates nearby heal after 4 seconds without being hit
  for (const p of w.players) {
    if (p.dead || p.falling > 0 || p.hp >= p.maxHp || w.t - p.lastHurtT < 4) continue;
    if (!w.players.some(q => q.team === p.team && !q.dead && q.role === 'warden' && Math.hypot(q.x - p.x, q.y - p.y) < 170)) continue;
    p.hp = Math.min(p.maxHp, p.hp + 2 * dt * (p.poisonT > 0 ? 0.5 : 1)); p.healing = true;
  }
  separate(w);
  updateArrows(w, dt);
  updateZones(w, dt);
  updateContagion(w, dt);
  updatePickups(w, dt);
  if (M.ph === 'play') checkRoundEnd(w);
  if (M.ph === 'play' && M.T <= 0) timeoutRound(w);
}

function snapshot(w) {
  const M = w.match;
  return {
    t: r3(w.t),
    m: { ph: M.ph, rd: M.rd, gm: M.gm, T: Math.max(0, Math.ceil(M.T)), wr: M.wins.red, wb: M.wins.blue, gr: M.gw.red, gb: M.gw.blue, rw: M.rw, mw: M.mw,
      op: M.opening ? 1 : 0, opt: w.cfg.opt, ptw: w.cfg.pointsToWin, gtw: w.cfg.gamesToWin, df: w.cfg.diff, map: w.cfg.map, cs: canStart(w) ? 1 : 0,
      cr: w.cracks && w.cracks.length ? w.cracks.join('') : '' },
    p: w.players.map(p => {
      const pw = {};
      for (const k in p.pw) if (p.pw[k] > 0) pw[k] = r1(p.pw[k]);
      return {
        id: p.id, n: p.name, c: p.color, b: p.bot ? 1 : 0, tm: p.team,
        x: r1(p.x), y: r1(p.y), vx: Math.round(p.vx), vy: Math.round(p.vy), a: r3(p.aim),
        hp: Math.max(0, Math.ceil(p.hp)), mh: p.maxHp, ch: r2(p.charge), dr: p.drawing ? 1 : 0,
        f: r2(p.falling), st: p.stuck > 0 ? 1 : 0, bu: p.burn > 0 ? 1 : 0, sl: p.slow > 0 ? 1 : 0, iv: p.inv > 0 ? 1 : 0,
        da: p.dashT > 0 ? 1 : 0, hl: p.healing ? 1 : 0, dn: p.dashN, dk: p.dashMaxN, ra: p.rallied ? 1 : 0,
        ab: p.slots, ac: p.abCd.map(r1), fz: p.frozen > 0 ? 1 : 0, sx: p.dashLock > 0 ? 1 : 0, ov: p.over >= 1 ? 1 : 0,
        sn: p.snare ? 1 : 0, vl: p.volleyArmed ? 1 : 0, rl: p.railArmed ? 1 : 0,
        arm: p.recoilArmed ? 'recoil' : p.seekArmed ? 'seeker' : p.swapArmed ? 'swap' : p.boomArmed ? 'boomerang' : p.execArmed ? 'execute' : undefined,
        sr: p.shroudT > 0 ? p.shroudR : undefined, rsh: p.rush ? 1 : 0, sk: p.strikeN || 0, ft: p.fortT > 0 ? 1 : 0, wd: p.windT > 0 ? 1 : 0, ph: p.phaseT > 0 ? 1 : 0, gr: p.grap ? [r1(p.grap.x), r1(p.grap.y)] : 0, rp: r2(p.revP || 0), rv: p.reviveUsed ? 1 : 0, fl: p.flash > 0 ? 1 : 0, dc: r2(p.dashCd), dm: p.dashCdMax, d: p.dead ? 1 : 0,
        k: p.kills, de: p.deaths, am: p.amber, er: p.earned, up: p.up, hn: p.hones, el: p.element, ro: p.role,
        of: p.offer, pk: p.picked ? 1 : 0, po: p.poisonN, dz: p.disarm > 0 ? 1 : 0, hc: p.hcap || 0, dfl: p.deflectT > 0 ? 1 : 0, ts: p.trapSet ? [r1(p.trapSet.x), r1(p.trapSet.y), r2(1 - p.trapSet.t / TRAP_SET)] : undefined, ti: p.title || undefined, pn: p.pinned > 0 && p.stuck > 0 ? 1 : 0, pa: p.pinned > 0 ? r2(p.pinAng || 0) : undefined, sg: p.staggerT > 0 ? 1 : 0, mk: p.markT > 0 ? 1 : 0, sth: p.stealthT > 0 ? 1 : 0, amb: p.ambushT > 0 ? 1 : 0, bs: p.bot && p.ai.style ? p.ai.style : undefined, em: p.emp ? 1 : 0, sk: p.streak, lh: p.lastHow, ep: Math.min(p.empPts, EMPOWER_AT), rz: r1(p.r),
        ss: [p.stats.shots, p.stats.hits, Math.round(p.stats.dmg), Math.round(p.stats.taken), p.stats.ring, Math.round(p.stats.longest)],
        pw, lc: p.lastCause, kb: p.killedBy,
      };
    }),
    a: w.arrows.map(a => ({ id: a.id, o: a.owner, x: r1(a.x), y: r1(a.y), g: r3(a.ang), s: a.stuck > 0 ? r2(a.stuck) : 0, c: a.color, cr: a.full ? 1 : 0, ex: a.explosive ? 1 : 0, rl: a.rail ? 1 : 0, bg: a.big ? 1 : 0, sk: a.seek ? 1 : 0, bm: a.boom ? 1 : 0, sw: a.swap ? 1 : 0, xq: a.exec ? 1 : 0, sh: a.shur ? (a.dbl ? 2 : 1) : 0, hv: a.heavy ? 1 : 0, el: a.el, b: a.bolt ? 1 : 0, sn: a.snare ? 1 : 0 })),
    z: w.zones.filter(z => !(z.delay > 0)).map(z => ({ id: z.id, ty: z.ty, x: r1(z.x), y: r1(z.y), x2: z.x2 != null ? r1(z.x2) : undefined, y2: z.y2 != null ? r1(z.y2) : undefined, r: z.r, t: r2(z.t), tm: z.team, o: z.owner })),
    u: w.pickups.map(u => ({ id: u.id, x: r1(u.x), y: r1(u.y), ty: u.type, ag: r1(u.age), li: u.life, cp: u.chan ? r2(u.cp) : undefined, ct: u.chan ? u.ct : undefined, cs: u.chan ? u.cs : undefined })),
  };
}

return {
  AW, AH, WALL, GATES, MAPS, MAP_KEYS, PU, PU_TIMED, TREE, HONES, ELEMENTS, ROLES, MAX_SLOTS, CAP_PICKS, OPTIONS, AMBER_BOOST, TRAP_RANGE,
  TEAMS, TEAM_INFO, DIFF, MAX_TEAM, AMBER, TIMES, BULLSEYE, CRIT_MUL, CHANNEL, CHANNEL_TIME, CHANNEL_R, LOCK_PREMIUM, isLocked, EMPOWER, EMPOWER_AT, EMPOWER_BONUS, CRACK_WARN, STYLES, cardInfo, archetypeName,
  plagueR, createWorld, join, leave, addBot, removeBot, setTeam, setBotDifficulty, setMap, setPointsToWin, canStart, startMatch, toLobby, setLoadout,
  setInput, choose, canTake, setOption, setHandicap, HANDICAPS, ACHIEVEMENTS, setTitle, treesOf, rollOffer, step, snapshot, resetMatch,
  // used by the automated tests to hand out specific upgrades
  _grant(w, id, cards) { const p = w.players.find(q => q.id === id); for (const c of cards) takeCard(w, p, c); applyStats(p); p.picked = false; return p; },
};
});
