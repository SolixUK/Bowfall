// Crests (the currency you earn by playing), unlocks, the weekly free rotation, supporter status and the season pass.
// Everything is a one-off purchase (0.75.0): no new monthly memberships are sold. Supporter is bought once and kept for
// good, its emblem climbing bronze to diamond with everything you've ever spent (gifts included); memberships bought
// before 0.75.0 carry on until they're cancelled, and their months count as spending. The season pass is bought once per
// ranked season: a track of 30 tiers earned by playing, Crests on every tier, 25% more Crests from games for the rest of
// the season and that season's banner finish, kept for good.
// Premium elements and roles (tagged `premium` in public/sim.js) can be unlocked with Crests or bought. Locks only ever
// apply to ranked (Find game) drafts, and only while the owner has switched them on (/locks on); practice, training and
// custom games always have everything. Status (supporter, founder, patron) is cosmetic: emblems and banner finishes.
'use strict';

const UNLOCK_COST = 12000;           // Crests for one premium element or role: about 18 hours of matches, a real grind (raised from 4,000 in 0.42.0)
const EARN = { game: 8, gameWin: 8, match: 25, matchWin: 25, firstWin: 100, achTier: 40, train: { B: 50, A: 100, S: 200 } };
const SUP_BOOST = 1.25;              // pass holders (and old monthly members while theirs lasts) earn Crests 25% faster
const SUP_STIPEND = 1000;            // Crests with each paid month of an old membership
const FOUNDER_CRESTS = 2000, SUPPORTER_CRESTS = 1000;
// supporter emblem tiers by total spent, in pence (an old membership's months count at £4 each)
const SUP_TIERS = [{ p: 0, name: 'Supporter' }, { p: 1500, name: 'Silver supporter' }, { p: 4000, name: 'Gold supporter' }, { p: 10000, name: 'Diamond supporter' }];
// prices in pence (GBP), used by the Stripe checkout
const PRICES = { supporter: 500, founder: 1500, unlock: 249, pass: 500, donateMin: 100, donateMax: 20000 };
// the season pass: 30 tiers of 300 pass points (one point per Crest a game or match earns before any boost, so about five
// matches a tier; 150 matches over a three-month season fills it). Free track: 150 Crests every 5th tier. With the pass:
// 100 Crests every tier and 1,000 more at the last.
const PASS = { tiers: 30, per: 300, free: { every: 5, crests: 150 }, paid: { crests: 100, last: 1000 } };
const GIFTABLE = ['pass', 'supporter', 'founder'];

module.exports = function economy(Sim) {
  let seasonN = () => 0; // the current ranked season's number (the server hands this in once seasons are running)
  const setSeason = fn => { seasonN = fn; };
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
  // an old monthly membership still running
  const memberActive = u => { const s = u && u.career && u.career.sup; return !!(s && s.active && (!s.until || s.until > Date.now() - 3 * 86400000)); };
  // a supporter: bought it once (for good), or an old membership still running
  const supActive = u => !!(u && u.career && u.career.supporter) || memberActive(u);
  const spentOf = u => { const c = (u && u.career) || {}; return (c.spent || 0) + ((c.sup && c.sup.months) || 0) * 400; };
  const passOwned = (u, n = seasonN()) => !!(n && u && u.career && Array.isArray(u.career.passes) && u.career.passes.includes(n));
  const boosted = u => memberActive(u) || passOwned(u);
  function statusOf(u) {
    const c = (u && u.career) || {};
    let tier = 0; if (supActive(u)) { const sp = spentOf(u); tier = 1; SUP_TIERS.forEach((t, i) => { if (sp >= t.p) tier = i + 1; }); }
    const o = { sp: tier || null, fd: c.founder ? 1 : null, pt: c.patron ? 1 : null };
    for (const n of Array.isArray(c.passes) ? c.passes : []) o['ps' + n] = 1; // (each season's pass finish, kept for good)
    return o;
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
    const amt = Math.round(n * (boosted(u) && (why === 'game' || why === 'match') ? SUP_BOOST : 1));
    c.crests = (c.crests || 0) + amt; c.crestsEarned = (c.crestsEarned || 0) + Math.max(0, amt);
    return amt;
  }
  // after a game or match in a game that counts (ranked, or a custom game without bots)
  function earnGame(u, won) { const n = EARN.game + (won ? EARN.gameWin : 0); return give(u, n, 'game') + passPoints(u, n); }
  function earnMatch(u, won) {
    let n = EARN.match + (won ? EARN.matchWin : 0);
    const c = u.career || (u.career = {}), day = new Date().toISOString().slice(0, 10);
    if (won && c.firstWinDay !== day) { c.firstWinDay = day; n += EARN.firstWin; }
    return give(u, n, 'match') + passPoints(u, n);
  }
  // ---- the season pass
  const passTier = pts => Math.min(PASS.tiers, Math.floor((pts || 0) / PASS.per));
  function passOf(u) { // this season's progress (a new season starts it again)
    const c = u.career || (u.career = {}), n = seasonN();
    if (!c.pass || c.pass.n !== n) c.pass = { n, pts: 0, free: 0, paid: 0 };
    return c.pass;
  }
  // Crests for every tier reached and not yet paid out: the free track for everyone, the pass track for holders
  function passPay(u) {
    const P = passOf(u), t = passTier(P.pts); let n = 0;
    for (let k = P.free + 1; k <= t; k++) if (k % PASS.free.every === 0) n += PASS.free.crests;
    P.free = Math.max(P.free, t);
    if (passOwned(u, P.n)) { for (let k = P.paid + 1; k <= t; k++) n += PASS.paid.crests + (k === PASS.tiers ? PASS.paid.last : 0); P.paid = Math.max(P.paid, t); }
    return n ? give(u, n, 'pass') : 0;
  }
  function passPoints(u, n) {
    if (!seasonN() || !u || u.guest || (u.career && u.career.ai)) return 0;
    const P = passOf(u); P.pts += n;
    return passPay(u);
  }
  // bought (or given) this season's pass: the pass track pays out for every tier already reached
  function grantPass(u, n = seasonN()) {
    const c = u.career || (u.career = {});
    c.passes = Array.isArray(c.passes) ? c.passes : [];
    if (!n || c.passes.includes(n)) return 0;
    c.passes.push(n);
    return n === seasonN() ? passPay(u) : 0;
  }
  function grantSupporter(u) { const c = u.career || (u.career = {}); if (c.supporter) return 0; c.supporter = Date.now(); return give(u, SUPPORTER_CRESTS, 'supporter'); }
  // can this gift go to them? (null if it can, or why not)
  function giftBlock(to, kind) {
    const c = (to && to.career) || {};
    if (!GIFTABLE.includes(kind)) return 'That can\'t be given as a gift.';
    if (kind === 'pass' && passOwned(to)) return `${to.name} already has this season's pass.`;
    if (kind === 'supporter' && c.supporter) return `${to.name} is already a supporter.`;
    if (kind === 'founder' && c.founder) return `${to.name} is already a Founder.`;
    return null;
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
    const c = (u && u.career) || {}, s = c.sup || {}, n = seasonN();
    const P = u && !u.guest && n ? passOf(u) : { pts: 0 };
    return { crests: c.crests || 0, unlocks: c.unlocks || [], founder: !!c.founder, patron: !!c.patron, supporter: !!c.supporter, spent: spentOf(u),
      sup: { active: supActive(u), member: memberActive(u), months: s.months || 0, since: s.since || null, until: s.until || null, cancelling: !!s.cancelling },
      pass: { n, owned: passOwned(u, n), pts: P.pts || 0, tier: passTier(P.pts), tiers: PASS.tiers, per: PASS.per, free: PASS.free, paid: PASS.paid, boost: SUP_BOOST },
      gifts: ((u && u.social && u.social.giftsIn) || []).filter(g => !g.seen).slice(0, 5),
      status: statusOf(u), locks: !!locksOn, rotation: rot, cost: UNLOCK_COST, premium: PREMIUM, prices: PRICES, tiers: SUP_TIERS, giftable: GIFTABLE };
  }
  return { UNLOCK_COST, EARN, SUP_BOOST, SUP_STIPEND, FOUNDER_CRESTS, SUPPORTER_CRESTS, SUP_TIERS, PRICES, PASS, GIFTABLE, PREMIUM, setSeason, isPremium, rotation, supActive, memberActive, passOwned, statusOf, owns, give, earnGame, earnMatch, earnTraining, unlock, buyWithCrests, grantPass, grantSupporter, giftBlock, passOf, passTier, wallet };
};
