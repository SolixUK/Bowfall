// Elo ratings, updated once per ranked (matchmade) match, when the last battle decides it. Custom games aren't rated.
// Each side's strength is the average rating of its archers: accounts use their own rating, guests count as
// START and bots as BOT_ELO for their difficulty. A win against a stronger side gains more than one against a weaker side.
// Every account also has a rating per role, updated the same way but using their rating in the role they played.
'use strict';
const START = 800, K = 24, K_NEW = 40, NEW_MATCHES = 10;
const BOT_ELO = { easy: 700, normal: 900, hard: 1100, extreme: 1300, master: 1550 };
const expected = (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400));
const round = v => Math.round(v * 10) / 10;

// users can include matchmaking's AI players (bots with an account), who are rated like anyone else
// rec: the match's roster with each player's result (p: [{ id, b, tm, ro, w }], df: bot difficulty); users: Map of sim player id -> account
// returns Map of account id -> { elo, role, roleElo, delta }
function rateGame(rec, users) {
  const out = new Map();
  if (!rec || !rec.win || !Array.isArray(rec.p)) return out; // draws and odd records aren't rated
  const botElo = BOT_ELO[rec.df] || BOT_ELO.normal;
  const ratingOf = (p, role) => {
    const u = users.get(p.id);
    if (p.b && !u) return BOT_ELO[p.df] || botElo; // each bot by its own skill; AI players from matchmaking have their own account and rating
    if (!u) return START;
    const c = u.career || {};
    return role ? ((c.relo || {})[p.ro] || START) : (c.elo || START);
  };
  const sides = { red: rec.p.filter(p => p.tm === 'red'), blue: rec.p.filter(p => p.tm === 'blue') };
  if (!sides.red.length || !sides.blue.length) return out;
  const avg = (list, swap) => list.reduce((s, q) => s + (swap && q === swap.p ? swap.v : ratingOf(q)), 0) / list.length;
  for (const p of rec.p) {
    const u = users.get(p.id);
    if (!u) continue;
    const mine = sides[p.tm], theirs = sides[p.tm === 'red' ? 'blue' : 'red'];
    const opp = avg(theirs), score = p.w;
    const c = u.career || {};
    const k = (c.matches || 0) < NEW_MATCHES ? K_NEW : K;
    const e = expected(avg(mine), opp);
    const roleR = ratingOf(p, true);
    const eRole = expected(avg(mine, { p, v: roleR }), opp);
    const d = k * (score - e), dr = k * (score - eRole);
    out.set(u.id, { elo: round((c.elo || START) + d), role: p.ro, roleElo: round(roleR + dr), delta: round(d) });
  }
  return out;
}
module.exports = { rateGame, expected, START, BOT_ELO };
