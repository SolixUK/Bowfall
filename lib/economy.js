// Crests (the currency you earn by playing), unlocks, the weekly free rotation, and supporter status.
// Premium elements and roles (tagged `premium` in public/sim.js) can be unlocked with Crests or bought. Locks only ever
// apply to ranked (Find game) drafts, and only while the owner has switched them on (/locks on); practice, training and
// custom games always have everything. Status (supporter, founder, patron) is cosmetic: emblems and banner finishes.
'use strict';

const UNLOCK_COST = 12000;           // Crests for one premium element or role: about 18 hours of matches, a real grind (raised from 4,000 in 0.42.0)
const EARN = { game: 8, gameWin: 8, match: 25, matchWin: 25, firstWin: 100, achTier: 40, train: { B: 50, A: 100, S: 200 } };
const SUP_BOOST = 1.25;              // supporters earn Crests 25% faster
const SUP_STIPEND = 1000;            // Crests with each paid month of membership
const FOUNDER_CRESTS = 2000;
// supporter emblem tiers by months supported in total (they keep counting across breaks)
const SUP_TIERS = [{ m: 0, name: 'Supporter' }, { m: 3, name: 'Silver supporter' }, { m: 6, name: 'Gold supporter' }, { m: 12, name: 'Diamond supporter' }];
// prices in pence (GBP), used by the Stripe checkout
const PRICES = { supporter: 400, founder: 1500, unlock: 249, donateMin: 100, donateMax: 20000 };

module.exports = function economy(Sim) {
  const PREMIUM = {
    el: Object.keys(Sim.ELEMENTS).filter(k => Sim.ELEMENTS[k].premium),
    ro: Object.keys(Sim.ROLES).filter(k => Sim.ROLES[k].premium),
  };
  const isPremium = k => !!((Sim.ELEMENTS[k] || Sim.ROLES[k] || {}).premium);
  // this week's free premium element or role (weeks start on Monday, UTC); the owner can pin others
  function rotation(now = Date.now(), pinned) {
    if (pinned && (pinned.el || pinned.ro)) return { el: pinned.el || null, ro: pinned.ro || null, pinned: true };
    // just one a week, an element one week and a role the next, so a free pick is a treat rather than half the store
    const week = Math.floor((now / 86400000 + 3) / 7), list = [];
    for (let i = 0; i < Math.max(PREMIUM.el.length, PREMIUM.ro.length); i++) { if (PREMIUM.el[i]) list.push(['el', PREMIUM.el[i]]); if (PREMIUM.ro[i]) list.push(['ro', PREMIUM.ro[i]]); }
    const pick = list.length ? list[week % list.length] : null;
    return { el: pick && pick[0] === 'el' ? pick[1] : null, ro: pick && pick[0] === 'ro' ? pick[1] : null, week };
  }
  const supActive = u => { const s = u && u.career && u.career.sup; return !!(s && s.active && (!s.until || s.until > Date.now() - 3 * 86400000)); };
  function statusOf(u) {
    const c = (u && u.career) || {}, s = c.sup || {};
    const months = s.months || 0;
    let tier = 0; if (supActive(u)) { tier = 1; SUP_TIERS.forEach((t, i) => { if (months >= t.m) tier = i + 1; }); }
    return { sp: tier || null, fd: c.founder ? 1 : null, pt: c.patron ? 1 : null };
  }
  // can this account (or guest) pick this element or role in a ranked draft?
  function owns(u, key, locksOn, rot) {
    if (!locksOn || !isPremium(key)) return true;
    if (rot && (rot.el === key || rot.ro === key)) return true;
    const c = (u && u.career) || {};
    if (c.founder) return true;
    return Array.isArray(c.unlocks) && c.unlocks.includes(key);
  }
  function give(u, n, why) {
    const c = u.career || (u.career = {});
    const amt = Math.round(n * (supActive(u) && why !== 'stipend' && why !== 'founder' && why !== 'admin' ? SUP_BOOST : 1));
    c.crests = (c.crests || 0) + amt; c.crestsEarned = (c.crestsEarned || 0) + Math.max(0, amt);
    return amt;
  }
  // after a game or match in a game that counts (ranked, or a custom game without bots)
  function earnGame(u, won) { return give(u, EARN.game + (won ? EARN.gameWin : 0), 'game'); }
  function earnMatch(u, won) {
    let n = EARN.match + (won ? EARN.matchWin : 0);
    const c = u.career || (u.career = {}), day = new Date().toISOString().slice(0, 10);
    if (won && c.firstWinDay !== day) { c.firstWinDay = day; n += EARN.firstWin; }
    return give(u, n, 'match');
  }
  function earnTraining(u, kind, grade) {
    const c = u.career || (u.career = {}), got = c.trainPaid || (c.trainPaid = {}), order = ['D', 'C', 'B', 'A', 'S'];
    let n = 0;
    for (const g of ['B', 'A', 'S']) if (order.indexOf(grade) >= order.indexOf(g) && !(got[kind] || []).includes(g)) { n += EARN.train[g]; (got[kind] = got[kind] || []).push(g); }
    return n ? give(u, n, 'train') : 0;
  }
  function unlock(u, key) {
    const c = u.career || (u.career = {});
    c.unlocks = Array.isArray(c.unlocks) ? c.unlocks : [];
    if (!isPremium(key) || c.unlocks.includes(key)) return false;
    c.unlocks.push(key); return true;
  }
  function buyWithCrests(u, key) {
    const c = u.career || (u.career = {});
    if (!isPremium(key)) return 'That one is free for everyone.';
    if ((c.unlocks || []).includes(key) || c.founder) return 'You already own that.';
    if ((c.crests || 0) < UNLOCK_COST) return `You need ${UNLOCK_COST - (c.crests || 0)} more Crests.`;
    c.crests -= UNLOCK_COST; unlock(u, key); return null;
  }
  // the store's view of an account
  function wallet(u, locksOn, rot) {
    const c = (u && u.career) || {}, s = c.sup || {};
    return { crests: c.crests || 0, unlocks: c.unlocks || [], founder: !!c.founder, patron: !!c.patron, sup: { active: supActive(u), months: s.months || 0, since: s.since || null, until: s.until || null, cancelling: !!s.cancelling },
      status: statusOf(u), locks: !!locksOn, rotation: rot, cost: UNLOCK_COST, premium: PREMIUM, prices: PRICES };
  }
  return { UNLOCK_COST, EARN, SUP_BOOST, SUP_STIPEND, FOUNDER_CRESTS, SUP_TIERS, PRICES, PREMIUM, isPremium, rotation, supActive, statusOf, owns, give, earnGame, earnMatch, earnTraining, unlock, buyWithCrests, wallet };
};
