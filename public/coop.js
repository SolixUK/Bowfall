// The co-op arcade: a team of people (one or two) against a ladder of fourteen AI duos, each with its own arena, map effects
// and a tactic that is the whole point of the fight. A run has three continues. Everyone picks their archetype and all three
// upgrades before each battle; battles are best of three games.
// Shared by the server (a run online, with a friend: lib/coop.js) and the page (a run on this device: solo, or with players on
// controllers). A "room" is { world, clients: Set of { cid, pid, name, user, watch }, host: cid, coop }; ctx says how to tell
// people things and where to keep the score. ctx.roster is lib/duos.json, ctx.fit lib/duo-fit.json.
(function (root) {
function coopFactory(ctx) {
  const { Sim, send, sendRoom, sysChat, broadcast, markDirty, isOwner } = ctx;
  const ROSTER = ctx.roster, FIT = ctx.fit && ctx.fit.duos ? ctx.fit : { duos: {} };
  const DIFFS = ROSTER.difficulties, DUOS = ROSTER.duos, CONTINUES = ROSTER.continues || 3;
  const SOLO_HCAP = { easy: 50, normal: 40, hard: 30, legend: 20 }; // one person against two: more health and damage
  const BASE_SCORE = 100, CARD_WAIT = 12, CONT_WAIT = 12; // (CONT_WAIT: seconds the Continue? countdown gives you after a loss)
  const BOSS = DUOS.find(d => d.boss) || null, LADDER = DUOS.filter(d => !d.boss); // points a duo is worth before the difficulty multiplier; seconds the result card shows before moving on
  const humansOf = room => [...room.clients].filter(c => c.pid && !c.watch);
  // a run's order: the duos shuffled (a different ladder every time), the machine always last
  const shuffled = () => { const a = LADDER.map(d => d.id); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } if (BOSS) a.push(BOSS.id); return a; };
  let cur = null; // (the run being worked on: set at the top of every entry point)
  const N = () => (cur && cur.order ? cur.order.length : DUOS.length);
  const duoAt = i => { const k = Math.max(0, Math.min(N() - 1, i)); return cur && cur.order ? DUOS.find(d => d.id === cur.order[k]) || DUOS[k] : DUOS[k]; };
  // the tactic a member plays: the roster's, with whatever training settled on top
  const tacOf = (duo, i) => { const fit = FIT.duos[duo.id]; return Object.assign({}, duo.members[i].tac, fit && fit.tacs ? fit.tacs[i] : null); };
  // what the page shows about a run (in every room message while one is on)
  function info(room) {
    const C = room.coop; if (!C) return undefined;
    const d = duoAt(C.idx);
    return { st: C.st, diff: C.diff, idx: C.idx, n: N(), lives: C.lives, score: C.score, solo: C.solo ? 1 : 0, beaten: C.beaten, fights: C.fights, paused: C.paused || undefined, test: C.test ? 1 : undefined,
      cont: C.st === 'lost' && !C.test ? Math.max(0, CONT_WAIT - (Date.now() - C.cardAt) / 1000) : undefined,
      duo: { id: d.id, name: d.name, boss: d.boss ? 1 : undefined, tell: d.tell, map: d.map, mapName: Sim.MAPS[d.map] ? Sim.MAPS[d.map].name : d.map, effects: d.effects, members: d.members.map(m => ({ name: m.name, el: m.el, ro: m.role, ups: m.ups })) },
      ready: [...C.ready], picks: Object.fromEntries([...C.picks].map(([cid, v]) => [cid, v])), result: C.result || undefined, best: C.best || undefined };
  }
  // the brief: the duo's arena and effects set up, everyone back in the lobby to choose (the bots are seated when the battle starts)
  function brief(room) {
    const C = room.coop, w = room.world, d = duoAt(C.idx);
    if (w.match.ph !== 'lobby') Sim.toLobby(w);
    for (const p of w.players.filter(q => q.bot && q.coopDuo)) Sim.removeBot(w, p.id);
    for (const c of humansOf(room)) Sim.setTeam(w, c.pid, 'red');
    Sim.setMap(w, d.map);
    w.cfg.opt.effect = d.effects.length ? d.effects.join('+') : 'none'; w.cfg.mut = d.effects.length ? d.effects.join('+') : null;
    w.cfg.pointsToWin = 1; w.cfg.gamesToWin = 2;
    seat(room);
    C.st = 'brief'; C.ready = new Set(); C.result = null;
    sysChat(room, `${C.idx + 1} of ${N()}: ${d.name} on ${Sim.MAPS[d.map].name}${d.effects.length ? ' (' + d.effects.map(k => Sim.MUTATORS[k].name).join(', ') + ')' : ''}. ${d.tell}`);
    sendRoom(room);
  }
  // the duo, seated on Blue with its upgrades, tactic and difficulty
  function seat(room) {
    const C = room.coop, w = room.world, d = duoAt(C.idx), D = DIFFS[C.diff];
    for (const p of w.players.filter(q => q.bot && q.coopDuo)) Sim.removeBot(w, p.id);
    d.members.forEach((m, i) => {
      const b = Sim.addBot(w, 'blue'); if (!b) return;
      b.name = m.name; b.coopDuo = true; Sim.setLoadout(w, b.id, m.el, m.role); b.forceUp = m.ups.slice();
      // their skill: the difficulty's band, rising with the place on the ladder (whoever you meet first is the gentlest, whoever
      // you meet last the sharpest), the second member a touch sharper; team sense always full (the tactic depends on it)
      const k = N() > 1 ? C.idx / (N() - 1) : 1, f = Math.min(1, D.facets[0] + (D.facets[1] - D.facets[0]) * k + 0.02 * i + (d.boost || 0)); // (boost: a duo whose tactic costs it firepower plays a touch sharper)
      if (m.boss) { // the machine: the top of the band and past it, inhuman at dodging, more health against two of you
        // (a hard fight, not an impossible one: the middle of the difficulty's band and a little more, sharper feet than eye)
        const solo = humansOf(room).length <= 1, mid = Math.min(1, (D.facets[0] + D.facets[1]) / 2 + 0.04);
        b.element = null; // (no element: it's a machine)
        b.dparams = Sim.facetParams({ aim: mid, pos: mid, dodge: Math.min(1, mid + 0.12), mind: 1 });
        b.boss = { hp: m.boss.hp[solo ? 0 : 1], sense: Math.min(1, 0.1 + 0.5 * mid * mid), el: m.extra || [], mode: null, at: 0 };
        b.forceUp = null;
        Sim.setBotMind(w, b.id, { aggr: 0.7, tr: { cover: 0.3, edge: 0.8, dash: 1, charge: 0.3 }, tactic: m.tac });
        Sim.applyStats(b); b.hp = b.maxHp;
        return;
      }
      b.dparams = Sim.facetParams({ aim: f, pos: f + 0.03, dodge: f - 0.03, mind: 1 });
      Sim.setBotMind(w, b.id, { aggr: 0.7, tr: { cover: 0.4, edge: 0.5, dash: 0.7, charge: 0.2 }, tactic: tacOf(d, i) });
    });
  }
  // the battle: everyone's chosen upgrades applied at the first pick, the solo handicap set, and off
  function fight(room) {
    const C = room.coop, w = room.world;
    if (w.match.ph !== 'lobby') return;
    const hum = humansOf(room); if (!hum.length) return;
    C.solo = hum.length === 1;
    seat(room); // (fresh for the battle: the machine's health depends on how many of you there are)
    for (const c of hum) {
      const p = w.players.find(q => q.id === c.pid); if (!p) continue;
      Sim.setTeam(w, p.id, 'red');
      const picks = C.picks.get(c.cid) || [];
      p.forceUp = picks.filter(id => Sim.TREE[id]).slice(0, 3);
      Sim.setHandicap(w, p.id, C.solo ? SOLO_HCAP[C.diff] : 0);
    }
    if (!Sim.startMatch(w)) { sysChat(room, 'Could not start the battle.'); return; }
    C.st = 'play'; C.fights++;
    const d = duoAt(C.idx), say = d.members[Math.floor(Math.random() * d.members.length)];
    chat(room, say, LINES.start[say.voice] || LINES.start.dry);
    sendRoom(room);
  }
  // after the battle: the result, the score, a continue spent or the next duo
  function settle(room) {
    const C = room.coop, w = room.world, d = duoAt(C.idx), D = DIFFS[C.diff];
    const won = w.match.mw === 'red';
    if (won) {
      const pts = Math.round(BASE_SCORE * D.mult * (d.boss ? 3 : 1) * (w.match.gw.blue === 0 ? 1.25 : 1)); // (a clean sweep is worth a quarter more; the machine three duos)
      C.score += pts; C.beaten = Math.max(C.beaten, C.idx + 1);
      C.result = { won: 1, pts, duo: d.name, last: C.idx + 1 >= N() };
      const say = d.members[Math.floor(Math.random() * d.members.length)]; chat(room, say, LINES.lost[say.voice] || LINES.lost.dry);
      sysChat(room, `${d.name} beaten: +${pts}. Score ${C.score}.`);
      if (C.idx + 1 >= N()) { C.st = 'done'; sysChat(room, `The ladder is clear on ${D.name}! Final score ${C.score}.`); record(room, true); }
      else { C.st = 'won'; C.idx++; }
    } else {
      if (!C.test) C.lives--;
      const say = d.members[Math.floor(Math.random() * d.members.length)]; chat(room, say, LINES.won[say.voice] || LINES.won.dry);
      C.result = { won: 0, duo: d.name, lives: C.lives };
      if (C.lives < 0) { C.st = 'done'; sysChat(room, `No continues left. The run ends at ${d.name}, ${C.beaten} of ${N()} beaten, score ${C.score}.`); record(room, false); }
      else { C.st = 'lost'; sysChat(room, C.test ? `${d.name} win this one. Test mode: try again as often as you like.` : `${d.name} win${d.boss ? 's' : ''} this one. Continue? ${C.lives} left.`); }
    }
    C.cardAt = Date.now();
    sendRoom(room);
  }
  // the run in people's records: best score on each difficulty, and the furthest duo reached
  function record(room, cleared) {
    const C = room.coop;
    if (C.test) return; // (test runs don't count)
    if (ctx.record) return ctx.record(room, C, cleared); // (the page keeps its own, and tells the server when signed in)
    for (const c of humansOf(room)) {
      const u = c.user || c.guest; if (!u) continue;
      const k = (u.career || (u.career = {})).coop || (u.career.coop = {});
      const b = k[C.diff] || (k[C.diff] = { best: 0, far: 0, runs: 0, clears: 0 });
      b.runs++; if (cleared) b.clears++; if (C.score > b.best) b.best = C.score; if (C.beaten > b.far) b.far = C.beaten;
      if (!C.best) C.best = {}; C.best[c.cid] = b.best;
      markDirty(u);
    }
  }
  function endRun(room) {
    const C = room.coop; if (!C) return;
    const w = room.world;
    if (w.match.ph !== 'lobby') Sim.toLobby(w);
    for (const p of w.players.filter(q => q.bot && q.coopDuo)) Sim.removeBot(w, p.id);
    for (const c of humansOf(room)) { const p = w.players.find(q => q.id === c.pid); if (p) { p.forceUp = null; Sim.setHandicap(w, p.id, 0); } }
    w.cfg.pointsToWin = 3; w.cfg.gamesToWin = 2; w.cfg.opt.effect = 'random'; w.cfg.mut = null;
    if (Sim.MAPS[w.cfg.map] && Sim.MAPS[w.cfg.map].coop) Sim.setMap(w, 'meadow');
    room.coop = null;
    sendRoom(room);
  }
  // one of the duo speaks (shown like any AI player's line)
  function chat(room, m, lines) {
    if (!lines || !lines.length) return;
    const p = room.world.players.find(q => q.bot && q.name === m.name);
    broadcast(room, { t: 'chat', n: m.name, tm: 'blue', c: p ? p.color : null, m: lines[Math.floor(Math.random() * lines.length)], ai: 1 });
  }
  // what they say, by the kind of character they are
  const LINES = {
    start: {
      keen: ['Ready? Good.', 'Eyes up.', 'Here we go.'], dry: ['Let\'s get this over with.', 'Try to make it interesting.', 'Same again, then.'],
      warm: ['Good luck out there!', 'Play nicely.', 'Oh, hello.'], quiet: ['...', 'Hm.'], sly: ['Come closer.', 'This will be fun. For me.', 'Watch your step.'],
      gruff: ['Right.', 'Come on then.', 'Hold still.'], bright: ['Showtime!', 'Ta-da!', 'Watch this!'], cold: ['Begin.', 'You should not have come.', 'It is already over.'],
    },
    won: {
      keen: ['Too slow.', 'Called it.'], dry: ['Well. That happened.', 'Again?'], warm: ['Unlucky! Go again?', 'So close!'], quiet: ['...', 'Quiet now.'],
      sly: ['Told you.', 'Right where I wanted you.'], gruff: ['Stay down.', 'Next.'], bright: ['Ha! Encore!', 'And for my next trick...'], cold: ['As expected.', 'Predictable.'],
    },
    lost: {
      keen: ['Well shot.', 'Fair.'], dry: ['Fine. Fine.', 'Beginner\'s luck.'], warm: ['Oh, well done!', 'You earned that.'], quiet: ['...!'],
      sly: ['Hmph. Lucky.', 'I let you.'], gruff: ['Grr.', 'Not bad.'], bright: ['Boo! Hiss!', 'The crowd turns on me!'], cold: ['Impossible.', 'This changes nothing.'],
    },
    kill: {
      keen: ['Got one!', 'Down!'], dry: ['Oops.', 'Mind the gap.'], warm: ['Sorry!', 'Oh dear.'], quiet: [], sly: ['Splash.', 'There.'], gruff: ['Ha.', 'Move.'], bright: ['Wheee!', 'Ten points!'], cold: ['Gone.', 'One.'],
    },
  };
  // the duo reacts to the fight now and then (not every time: a line a knockout at most, with a gap between)
  function events(room, evs) {
    const C = room.coop; if (!C || C.st !== 'play') return;
    const d = duoAt(C.idx), w = room.world;
    for (const e of evs) {
      if (e.e !== 'kill' || !e.k) continue;
      const k = w.players.find(q => q.id === e.k); if (!k || !k.bot) continue;
      const m = d.members.find(x => x.name === k.name); if (!m) continue;
      if ((C.saidAt || 0) > Date.now() - 9000 || Math.random() < 0.5) continue;
      C.saidAt = Date.now();
      setTimeout(() => chat(room, m, LINES.kill[m.voice] || LINES.kill.dry), 1200);
    }
  }
  // every so often: a finished battle settles; a result card moves on by itself after a while
  function tick(room) {
    const C = room.coop; if (!C) return;
    const w = room.world;
    if (C.st === 'play' && w.match.ph === 'over') settle(room);
    else if (C.st === 'done' && w.match.ph !== 'lobby' && Date.now() - (C.doneAt != null ? C.doneAt : C.cardAt) > 6000) { Sim.toLobby(w); sendRoom(room); } // (the run's over: back to the lobby for the final card)
    else if (C.st === 'won' && Date.now() - C.cardAt > CARD_WAIT * 1000) brief(room);
    else if (C.st === 'lost' && !C.test && Date.now() - C.cardAt > CONT_WAIT * 1000) { // nobody took the continue: that's the run
      const d = duoAt(C.idx); C.st = 'done'; C.doneAt = 0; C.result = { won: 0, duo: d.name, lives: C.lives, gaveUp: 1 };
      sysChat(room, `The run ends at ${d.name}: ${C.beaten} of ${N()} beaten, score ${C.score}.`); record(room, false); sendRoom(room);
    }
    else if (C.st === 'play' && !humansOf(room).length) endRun(room);
  }
  // messages from the page: { t: 'coop', op }
  function handle(room, ws, m) {
    const w = room.world, C = room.coop, isHost = room.host === ws.cid;
    const tell = msg => send(ws, { t: 'note', msg });
    switch (String(m.op)) {
      case 'start': {
        if (!isHost) return tell('Only the host can start a run.');
        if (room.ranked) return tell('Not in a ranked match.');
        if (w.match.ph !== 'lobby') return tell('Wait for this game to end.');
        const diff = DIFFS[m.diff] ? String(m.diff) : 'normal';
        const hum = humansOf(room);
        if (!hum.length || hum.length > 2) return tell('The arcade is for one or two archers.');
        for (const c of [...room.clients]) if (c.pid && c.watch) { Sim.leave(w, c.pid, true); c.pid = null; send(c, { t: 'you', id: null }); }
        const test = !!m.test && isOwner(ws.user); // (the owner's test runs: no end to the retries, nothing recorded)
        cur = room.coop = { diff, idx: 0, lives: CONTINUES, score: 0, beaten: 0, fights: 0, st: 'brief', ready: new Set(), picks: new Map(), solo: hum.length === 1, startedAt: Date.now(), order: shuffled(), test };
        sysChat(room, `Co-op arcade, ${DIFFS[diff].name}: ${N() - (BOSS ? 1 : 0)} duos in a new order, then the machine. ${test ? 'Test mode: unlimited retries.' : CONTINUES + ' continues.'} Choose your archetype and three upgrades before each battle.`);
        brief(room);
        return;
      }
      case 'pick': { // this person's three upgrades for the coming battle (checked again when they're applied)
        if (!C || !ws.pid) return;
        const ups = (Array.isArray(m.ups) ? m.ups : []).map(String).filter(id => Sim.TREE[id]).slice(0, 3);
        C.picks.set(ws.cid, ups); C.ready.delete(ws.cid);
        sendRoom(room);
        return;
      }
      case 'ready': {
        if (!C || !ws.pid || C.st !== 'brief') return;
        C.ready.add(ws.cid);
        if (humansOf(room).every(c => C.ready.has(c.cid))) fight(room); else sendRoom(room);
        return;
      }
      case 'go': if (C && isHost && C.st === 'brief') fight(room); return; // the host starts without waiting
      case 'pause': if (C && ws.pid && C.st === 'play' && !C.paused) { C.paused = ws.name; sysChat(room, `${ws.name} paused the battle.`); sendRoom(room); } return;
      case 'resume': if (C && C.paused && (C.paused === ws.name || isHost)) { C.paused = null; sysChat(room, 'On with it.'); sendRoom(room); } return;
      case 'next': if (C && ((C.st === 'won' && isHost) || (C.st === 'lost' && ws.pid))) brief(room); return; // (anyone playing can take the continue)
      case 'giveup': if (C && C.st === 'lost' && isHost) { C.cardAt = 0; C.test = false; tick(room); } return;
      case 'skip': { // the owner, for testing: forward or back a duo
        if (!C || !isOwner(ws.user)) return;
        if (w.match.ph !== 'lobby' && C.st === 'play') { Sim.toLobby(w); }
        C.idx = m.to != null ? Math.max(0, Math.min(N() - 1, m.to | 0)) : Math.max(0, Math.min(N() - 1, C.idx + (m.dir < 0 ? -1 : 1)));
        brief(room);
        return;
      }
      case 'quit': if (C && isHost) { sysChat(room, `The run ends: ${C.beaten} of ${N()} beaten, score ${C.score}.`); if (C.fights) record(room, false); endRun(room); } return;
      default: return;
    }
  }
  // someone leaving mid-run: a run with nobody left in it ends; in a two-person run the other carries on alone (with the solo handicap next battle)
  function left(room) { const C = room.coop; if (!C) return; if (!humansOf(room).length) endRun(room); else if (C.paused && !humansOf(room).some(c => c.name === C.paused)) { C.paused = null; sendRoom(room); } }
  return { handle: (room, ws, m) => { cur = room.coop; return handle(room, ws, m); }, tick: room => { cur = room.coop; return tick(room); }, info: room => { cur = room.coop; return info(room); }, events: (room, evs) => { cur = room.coop; return events(room, evs); }, left: room => { cur = room.coop; return left(room); }, endRun: room => { cur = room.coop; return endRun(room); }, DUOS, DIFFS, CONTINUES };
}
if (typeof module !== 'undefined' && module.exports) module.exports = coopFactory; else root.CoopLadder = coopFactory;
})(typeof window !== 'undefined' ? window : this);
