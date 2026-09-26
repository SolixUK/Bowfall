// Elo ratings, updated once per ranked (matchmade) match, when the last battle decides it. Custom games aren't rated.
// There are two ratings: 1v1 (career.elo) and team games, 2v2 and 3v3 (career.eloT, which starts from your 1v1 rating).
// A side's strength leans toward its best player (60% the average, 40% the best), so a strong friend can't carry a weak
// account into easy wins. In team games each player's change is also scaled by how much they did in the match (their
// share of the team's knockouts, assists and damage): a player who was carried gains less, and one who carried a losing
// team loses less. Every account also has a rating per role, updated the same way using their rating in that role.
'use strict';
const START = 800, K = 24, K_NEW = 40, NEW_MATCHES = 10;
const BOT_ELO = { easy: 700, normal: 900, hard: 1100, extreme: 1300, master: 1550 };
const expected = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400));
const round = v => Math.round(v * 10) / 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// which rating a mode uses
const keyFor = mode => (mode && mode !== '1v1' ? 'eloT' : 'elo');
// someone's rating for a mode (the team rating starts out as their 1v1 rating)
const ratingOf = (u, key) => { const c = (u && u.career) || {}; return key === 'eloT' ? (c.eloT != null ? c.eloT : c.elo || START) : c.elo || START; };
// how much a player's contribution scales their change in a team game: share 1 = pulled their weight
function perfScale(share, won) {
  if (share == null) return 1;
  return won ? clamp(0.5 + 0.5 * share, 0.5, 1.25) : clamp(1.4 - 0.4 * share, 0.7, 1.3);
}

// rec: the match's roster: { win, df, key, p: [{ id, b, tm, ro, w, share }] }; users: Map of sim player id -> account
// returns Map of account id -> { elo, role, roleElo, delta, key }
function rateGame(rec, users) {
  const out = new Map();
  if (!rec || !rec.win || !Array.isArray(rec.p)) return out; // draws and odd records aren't rated
  const key = rec.key || 'elo';
  const botElo = BOT_ELO[rec.df] || BOT_ELO.normal;
  const valOf = (p, role) => {
    const u = users.get(p.id);
    if (p.b && !u) return BOT_ELO[p.df] || botElo; // AI players from matchmaking have their own account and rating
    if (!u) return START;
    return role ? (((u.career || {}).relo || {})[p.ro] || START) : ratingOf(u, key);
  };
  const sides = { red: rec.p.filter(p => p.tm === 'red'), blue: rec.p.filter(p => p.tm === 'blue') };
  if (!sides.red.length || !sides.blue.length) return out;
  const strength = (list, swap) => {
    const vals = list.map(q => (swap && q === swap.p ? swap.v : valOf(q)));
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    return vals.length > 1 ? 0.6 * avg + 0.4 * Math.max(...vals) : avg;
  };
  for (const p of rec.p) {
    const u = users.get(p.id);
    if (!u) continue;
    const mine = sides[p.tm], theirs = sides[p.tm === 'red' ? 'blue' : 'red'];
    const opp = strength(theirs), score = p.w;
    const c = u.career || {};
    const k = (c.matches || 0) < NEW_MATCHES ? K_NEW : K;
    const scale = mine.length > 1 ? perfScale(p.share, score === 1) : 1;
    const e = expected(strength(mine), opp);
    const roleR = valOf(p, true);
    const eRole = expected(strength(mine, { p, v: roleR }), opp);
    const d = k * (score - e) * scale, dr = k * (score - eRole) * scale;
    out.set(u.id, { elo: round(ratingOf(u, key) + d), role: p.ro, roleElo: round(roleR + dr), delta: round(d), key, opp: Math.round(opp), mine: Math.round(strength(mine)) });
  }
  return out;
}
module.exports = { rateGame, expected, perfScale, keyFor, ratingOf, START, BOT_ELO };
