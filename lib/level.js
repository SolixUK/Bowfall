// Account level, worked out from a player's career. Everything counts a little; winning counts most.
'use strict';
const XP_PER = { games: 10, wins: 15, kills: 4, matchWins: 40, ring: 2 };
function xpOf(career) {
  const c = career || {};
  let xp = 0;
  for (const k in XP_PER) xp += (c[k] || 0) * XP_PER[k];
  return Math.round(xp);
}
// level L starts at 40 × (L - 1)² xp: 40 for level 2, 160 for 3, 3240 for 10, 14440 for 20
const levelAt = xp => Math.floor(Math.sqrt(Math.max(0, xp) / 40)) + 1;
const xpFor = lv => 40 * (lv - 1) * (lv - 1);
function levelOf(career) {
  const xp = xpOf(career), lv = levelAt(xp);
  return { lv, xp, cur: xpFor(lv), next: xpFor(lv + 1) };
}
module.exports = { levelOf, xpOf, XP_PER };
