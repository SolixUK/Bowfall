// Clans: a named group with a short tag shown on its members' banners. One clan per account.
// A clan has a rating of its own. It only moves in ranked matches where a whole team is made up of that clan's members
// who queued together (two or more people, no AI players and nobody from outside): a win or loss against the other
// team's strength. Everything is kept in memory (there are few clans) and written through to the database.
'use strict';

const MAX_MEMBERS = 30, START = 800, K = 32;
const COLOURS = ['#ffcf5a', '#ff6b5a', '#5ad1ff', '#7dff8a', '#c58bff', '#ff8ad8', '#3fd0c9', '#ffffff'];
const cleanName = s => String(s || '').replace(/[^\p{L}\p{N} '\-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 24);
const cleanTag = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
const cleanMotto = s => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
const RANK = { leader: 3, officer: 2, member: 1 };

module.exports = function createClans(ctx) {
  const { store, Sim } = ctx;
  const clans = new Map(), byUser = new Map();
  const save = c => store.clanSave(c).catch(e => console.error('Could not save a clan:', e.message));
  const index = () => { byUser.clear(); for (const c of clans.values()) for (const m of c.members) byUser.set(m.id, c.id); };
  async function init() {
    clans.clear();
    for (const c of await store.clanList()) { const x = Object.assign({ members: [], invites: [], requests: [], rating: START, peak: START, games: 0, wins: 0, open: false, motto: '', col: COLOURS[0] }, c); if (!Sim.emblemOk(x.em)) x.em = Sim.emblemDefault(x.tag, x.col); clans.set(x.id, x); }
    index();
  }
  const of = uid => { const id = byUser.get(uid); return id ? clans.get(id) || null : null; };
  const tagOf = uid => { const c = of(uid); return c ? c.tag : null; };
  const colOf = uid => { const c = of(uid); return c ? c.col : null; };
  const emOf = uid => { const c = of(uid); return c ? c.em : null; };
  const memberOf = (c, uid) => c.members.find(m => m.id === uid) || null;
  const roleOf = (c, uid) => { const m = memberOf(c, uid); return m ? m.role : null; };
  const can = (c, uid, need) => (RANK[roleOf(c, uid)] || 0) >= RANK[need];
  const changed = (c, ids) => { index(); save(c); if (ctx.onChange) ctx.onChange(ids || c.members.map(m => m.id)); };

  // what a list shows
  const summary = c => ({ id: c.id, name: c.name, tag: c.tag, col: c.col, em: c.em, motto: c.motto, open: !!c.open, rating: Math.round(c.rating), peak: Math.round(c.peak || c.rating), games: c.games || 0, wins: c.wins || 0, size: c.members.length, max: MAX_MEMBERS, leader: (c.members.find(m => m.role === 'leader') || {}).name || null });
  // the clan's own page; officers and the leader also see who has asked to join and who has been invited
  function view(c, me) {
    const mine = me ? roleOf(c, me.id) : null;
    const v = Object.assign(summary(c), { created: c.created, role: mine, members: c.members.map(m => ({ id: m.id, name: m.name, role: m.role, joined: m.joined })).sort((a, b) => RANK[b.role] - RANK[a.role] || a.joined - b.joined),
      invited: me ? c.invites.some(x => x.id === me.id) : false, asked: me ? c.requests.some(x => x.id === me.id) : false });
    if (mine && RANK[mine] >= RANK.officer) { v.requests = c.requests.slice(); v.invites = c.invites.slice(); }
    return v;
  }
  // best first: clans that have played rated games, by rating; then the rest, biggest first
  const top = (n = 50) => [...clans.values()].sort((a, b) => ((b.games > 0) - (a.games > 0)) || (b.rating - a.rating) || (b.members.length - a.members.length) || (a.id - b.id)).slice(0, n).map(summary);
  const invitesFor = uid => [...clans.values()].filter(c => c.invites.some(x => x.id === uid)).map(summary);

  function addMember(c, u, role) {
    c.members.push({ id: u.id, name: u.name, role: role || 'member', joined: Date.now() });
    c.invites = c.invites.filter(x => x.id !== u.id); c.requests = c.requests.filter(x => x.id !== u.id);
    // joining one clan withdraws anything pending with the others
    for (const o of clans.values()) if (o !== c && (o.invites.some(x => x.id === u.id) || o.requests.some(x => x.id === u.id))) { o.invites = o.invites.filter(x => x.id !== u.id); o.requests = o.requests.filter(x => x.id !== u.id); save(o); }
  }
  async function create(u, f) {
    if (of(u.id)) return { error: 'Leave your clan first.' };
    const name = cleanName(f.name), tag = cleanTag(f.tag);
    if (name.length < 3) return { error: 'Clan names are 3 to 24 letters, numbers or spaces.' };
    if (tag.length < 2) return { error: 'Tags are 2 to 5 letters or numbers.' };
    const col = COLOURS.includes(f.col) ? f.col : COLOURS[0];
    const c = { name, tag, motto: cleanMotto(f.motto), col, em: Sim.emblemOk(f.em) ? f.em : Sim.emblemDefault(tag, col), open: !!f.open, created: Date.now(), rating: START, peak: START, games: 0, wins: 0, members: [], invites: [], requests: [] };
    addMember(c, u, 'leader');
    const id = await store.clanCreate(c);
    if (!id) return { error: 'That name or tag is taken.' };
    c.id = id; clans.set(id, c); changed(c);
    return { ok: true, clan: c };
  }
  function join(u, id) {
    const c = clans.get(+id); if (!c) return { error: 'That clan no longer exists.' };
    if (of(u.id)) return { error: 'Leave your clan first.' };
    const invited = c.invites.some(x => x.id === u.id);
    if (!invited && !c.open) {
      if (c.requests.some(x => x.id === u.id)) return { ok: true, asked: true };
      if (c.requests.length >= 50) return { error: 'That clan has too many requests waiting. Try later.' };
      c.requests.push({ id: u.id, name: u.name, t: Date.now() }); save(c);
      return { ok: true, asked: true };
    }
    if (c.members.length >= MAX_MEMBERS) return { error: 'That clan is full.' };
    addMember(c, u); changed(c);
    return { ok: true, clan: c };
  }
  // turn down an invite, or take back a request
  function refuse(u, id) { const c = clans.get(+id); if (!c) return { ok: true }; c.invites = c.invites.filter(x => x.id !== u.id); c.requests = c.requests.filter(x => x.id !== u.id); save(c); return { ok: true }; }
  async function remove(c) { clans.delete(c.id); const ids = c.members.map(m => m.id); index(); await store.clanDelete(c.id).catch(() => {}); if (ctx.onChange) ctx.onChange(ids); }
  async function leave(u) {
    const c = of(u.id); if (!c) return { error: "You aren't in a clan." };
    const was = roleOf(c, u.id);
    c.members = c.members.filter(m => m.id !== u.id);
    if (!c.members.length) { c.members.push({ id: u.id }); await remove(c); return { ok: true, gone: true }; }
    if (was === 'leader') { // the longest-serving officer takes over, or failing that the longest-serving member
      const next = c.members.filter(m => m.role === 'officer').sort((a, b) => a.joined - b.joined)[0] || c.members.slice().sort((a, b) => a.joined - b.joined)[0];
      next.role = 'leader';
    }
    changed(c, c.members.map(m => m.id).concat(u.id));
    return { ok: true };
  }
  function invite(u, target) {
    const c = of(u.id); if (!c || !can(c, u.id, 'officer')) return { error: 'Only the leader and officers can invite.' };
    if (!target) return { error: 'No player with that name.' };
    if (target.career && target.career.ai) return { error: "AI players can't join clans." };
    if (of(target.id)) return { error: `${target.name} is already in a clan.` };
    if (c.members.length >= MAX_MEMBERS) return { error: 'Your clan is full.' };
    if (c.requests.some(x => x.id === target.id)) { addMember(c, target); changed(c); return { ok: true, joined: true }; } // they'd already asked
    if (!c.invites.some(x => x.id === target.id)) { if (c.invites.length >= 50) return { error: 'Too many invites waiting. Cancel some first.' }; c.invites.push({ id: target.id, name: target.name, t: Date.now() }); save(c); }
    return { ok: true };
  }
  function uninvite(u, tid) { const c = of(u.id); if (!c || !can(c, u.id, 'officer')) return { error: 'Only the leader and officers can do that.' }; c.invites = c.invites.filter(x => x.id !== +tid); save(c); return { ok: true }; }
  function answer(u, tid, yes, target) {
    const c = of(u.id); if (!c || !can(c, u.id, 'officer')) return { error: 'Only the leader and officers can do that.' };
    const r = c.requests.find(x => x.id === +tid); if (!r) return { error: 'That request is gone.' };
    c.requests = c.requests.filter(x => x.id !== +tid);
    if (!yes) { save(c); return { ok: true }; }
    if (!target || of(target.id)) { save(c); return { error: 'They have joined another clan.' }; }
    if (c.members.length >= MAX_MEMBERS) { save(c); return { error: 'Your clan is full.' }; }
    addMember(c, target); changed(c);
    return { ok: true };
  }
  function kick(u, tid) {
    const c = of(u.id); if (!c) return { error: "You aren't in a clan." };
    const t = memberOf(c, +tid); if (!t) return { error: "They aren't in your clan." };
    if (t.id === u.id) return { error: 'Use Leave to go yourself.' };
    if ((RANK[roleOf(c, u.id)] || 0) <= RANK[t.role] || !can(c, u.id, 'officer')) return { error: "You can't remove them." };
    c.members = c.members.filter(m => m.id !== t.id); changed(c, c.members.map(m => m.id).concat(t.id));
    return { ok: true };
  }
  // the leader makes officers, takes that back, or hands over the clan
  function setRole(u, tid, role) {
    const c = of(u.id); if (!c || roleOf(c, u.id) !== 'leader') return { error: 'Only the leader can do that.' };
    const t = memberOf(c, +tid); if (!t || t.id === u.id) return { error: "They aren't in your clan." };
    if (!RANK[role]) return { error: 'Bad request.' };
    if (role === 'leader') { memberOf(c, u.id).role = 'officer'; t.role = 'leader'; } else t.role = role;
    save(c); return { ok: true };
  }
  function settings(u, f) {
    const c = of(u.id); if (!c || roleOf(c, u.id) !== 'leader') return { error: 'Only the leader can change the clan.' };
    if ('motto' in f) c.motto = cleanMotto(f.motto);
    if ('open' in f) c.open = !!f.open;
    if ('col' in f && COLOURS.includes(f.col)) c.col = f.col;
    if ('em' in f && Sim.emblemOk(f.em)) c.em = f.em;
    changed(c); return { ok: true };
  }
  async function disband(u) { const c = of(u.id); if (!c || roleOf(c, u.id) !== 'leader') return { error: 'Only the leader can disband the clan.' }; await remove(c); return { ok: true, gone: true }; }
  async function adminDisband(tag) { const c = [...clans.values()].find(x => x.tag === cleanTag(tag)); if (!c) return false; await remove(c); return c.name; }
  // a rated result: the clan's rating against the strength of the team it played
  function record(id, won, opp) {
    const c = clans.get(id); if (!c) return null;
    const exp = 1 / (1 + Math.pow(10, ((opp || START) - c.rating) / 400)), d = Math.round(K * ((won ? 1 : 0) - exp));
    c.rating = Math.max(100, c.rating + d); c.peak = Math.max(c.peak || START, c.rating); c.games = (c.games || 0) + 1; if (won) c.wins = (c.wins || 0) + 1;
    save(c);
    return { id: c.id, tag: c.tag, name: c.name, em: c.em, rating: Math.round(c.rating), d };
  }
  return { init, of, tagOf, colOf, emOf, summary, view, top, invitesFor, create, join, refuse, leave, invite, uninvite, answer, kick, setRole, settings, disband, adminDisband, record, get: id => clans.get(+id) || null, MAX_MEMBERS, START, COLOURS };
};
