// Ranked seasons: three months each, starting on the first of January, April, July and October (UTC). Season 1 is the
// one that was running when the server first started with seasons. When a season ends, everyone's season is recorded
// (the tier they peaked at, in 1v1 and in team games), accounts get Crests for their peak tier, and ratings are softened
// toward the middle so the new season's climb means something; the first 3 matches of a season are placements again.
'use strict';
const PIVOT = 900, KEEP = 0.6, PLACEMENTS = 3;
const REWARD = { bronze: 100, silver: 200, gold: 400, plat: 600, diamond: 800, master: 1000, champ: 1500 }; // Crests

const quarterOf = t => { const d = new Date(t); return d.getUTCFullYear() * 4 + Math.floor(d.getUTCMonth() / 3); };
const quarterStart = q => Date.UTC(Math.floor(q / 4), (q % 4) * 3, 1);

module.exports = function seasons({ store, Sim, live, track, markDirty, give, START, log = console.log }) {
  let st = null; // { q0, done }: the quarter season 1 started in, and the last season whose end has been handled
  const info = (now = Date.now()) => {
    if (!st) return null;
    const q = quarterOf(now);
    return { n: q - st.q0 + 1, start: quarterStart(q), end: quarterStart(q + 1) };
  };
  async function init() {
    st = await store.getSetting('season').catch(() => null);
    if (!st || typeof st.q0 !== 'number') { st = { q0: quarterOf(Date.now()), done: 0 }; await store.setSetting('season', st); }
    await check();
  }
  // a rating change: remember the best this season reached, for the season's record
  function noteRating(u, key, elo) {
    const c = u.career || (u.career = {}), s = info(); if (!s) return;
    if (!c.sPeak || c.sPeak.n !== s.n) c.sPeak = { n: s.n };
    c.sPeak[key] = Math.max(c.sPeak[key] || elo, elo);
  }
  async function check() {
    const s = info(); if (!s) return;
    if (st.done >= s.n - 1) return;
    const ending = s.n - 1; // only the latest finished season is recorded, even if the server was off for longer
    const all = (await store.leaderboard('games', 100000)).map(u => live.get(u.id) || track(u));
    let n = 0;
    for (const u of all) {
      const c = u.career; if (!c || (c.elo == null && c.eloT == null)) continue;
      const placed = (c.rated != null ? c.rated : c.matches || 0) >= 5 || c.ai;
      const pk = c.sPeak && c.sPeak.n === ending ? c.sPeak : {};
      const peak1 = Math.max(pk.elo || 0, c.elo || 0) || null, peakT = Math.max(pk.eloT || 0, c.eloT || 0) || null;
      const t1 = placed && peak1 ? Sim.tierOf(peak1) : null, tT = placed && peakT ? Sim.tierOf(peakT) : null;
      c.seasons = (c.seasons || []).concat({ n: ending, elo: c.elo != null ? Math.round(c.elo) : null, eloT: c.eloT != null ? Math.round(c.eloT) : null,
        t1: t1 ? t1.label : null, k1: t1 ? t1.k : null, tT: tT ? tT.label : null, kT: tT ? tT.k : null }).slice(-12);
      const best = [t1, tT].filter(Boolean).sort((a, b) => b.i - a.i)[0];
      if (best && !c.ai && !u.guest && give) give(u, REWARD[best.k] || 0, 'season');
      for (const key of ['elo', 'eloT']) if (c[key] != null) c[key] = Math.round(PIVOT + (c[key] - PIVOT) * KEEP);
      if (!c.ai) c.rated = Math.min(c.rated != null ? c.rated : c.matches || 0, 5 - PLACEMENTS);
      c.sPeak = null;
      markDirty(u); n++;
    }
    st.done = s.n - 1; await store.setSetting('season', st);
    log(`Season ${ending} ended: ${n} players recorded, ratings softened for season ${s.n}.`);
  }
  return { init, info, check, noteRating, REWARD, PLACEMENTS, _st: () => st, _set: v => { st = v; } };
};
