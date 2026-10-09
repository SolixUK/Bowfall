// Accounts, sessions, player records and the forum.
// With DATABASE_URL set it uses Postgres (e.g. a free Neon database); without it, a JSON file in data/,
// which is fine for playing on your own computer but is wiped whenever a free host restarts.
'use strict';
const fs = require('fs');
const path = require('path');

const CATEGORIES = [
  { slug: 'news', name: 'News', descr: 'Updates and patch notes.', adminOnly: true },
  { slug: 'general', name: 'General', descr: 'Anything Bowfall.' },
  { slug: 'builds', name: 'Builds and tactics', descr: 'Archetypes, upgrade paths and how to beat them.' },
  { slug: 'lfg', name: 'Looking for a game', descr: 'Find people to play with.' },
  { slug: 'bugs', name: 'Bugs', descr: 'Something broken? Tell us what happened.' },
  { slug: 'ideas', name: 'Ideas', descr: 'Suggestions for new roles, arenas and features.' },
];
// the numbers a leaderboard can be sorted by
const BOARD_KEYS = ['elo', 'eloT', 'wins', 'kills', 'games', 'matches', 'matchWins', 'ring', 'bulls'];
const DM_KEEP = 300; // messages kept per conversation between two friends

// ---------------- Postgres ----------------
function pgStore(url, pgModule) {
  const { Pool } = pgModule || require('pg');
  const pool = new Pool(typeof url === 'string'
    ? { connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }, max: 5 }
    : url);
  const q = (text, params) => pool.query(text, params).then(r => r.rows);
  const one = async (text, params) => (await q(text, params))[0] || null;
  const user = r => r && { id: r.id, name: r.name, passHash: r.pass_hash, admin: !!r.is_admin, title: r.title || null, ach: r.ach || {}, career: r.career || {}, country: r.country || null, social: r.social || {}, created: +new Date(r.created_at) };
  return {
    kind: 'postgres',
    async init() {
      await q(`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, pass_hash TEXT NOT NULL,
        is_admin BOOLEAN NOT NULL DEFAULT FALSE, title TEXT, ach JSONB NOT NULL DEFAULT '{}', career JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
      await q('ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT');
      await q("ALTER TABLE users ADD COLUMN IF NOT EXISTS social JSONB NOT NULL DEFAULT '{}'"); // friends and friend requests
      // guests' ratings and stats, kept against a random id their browser holds, until they make an account
      await q(`CREATE TABLE IF NOT EXISTS guests (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
      await q(`CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TIMESTAMPTZ NOT NULL)`);
      await q(`CREATE TABLE IF NOT EXISTS forum_categories (id SERIAL PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, descr TEXT NOT NULL, admin_only BOOLEAN NOT NULL DEFAULT FALSE, sort INTEGER NOT NULL DEFAULT 0)`);
      await q(`CREATE TABLE IF NOT EXISTS forum_threads (id SERIAL PRIMARY KEY, cat_id INTEGER NOT NULL, user_id INTEGER NOT NULL, title TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_post_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), post_count INTEGER NOT NULL DEFAULT 0,
        locked BOOLEAN NOT NULL DEFAULT FALSE, pinned BOOLEAN NOT NULL DEFAULT FALSE, deleted BOOLEAN NOT NULL DEFAULT FALSE)`);
      await q(`CREATE TABLE IF NOT EXISTS user_logins (provider TEXT NOT NULL, provider_id TEXT NOT NULL, user_id INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (provider, provider_id))`);
      await q(`CREATE TABLE IF NOT EXISTS forum_posts (id SERIAL PRIMARY KEY, thread_id INTEGER NOT NULL, user_id INTEGER NOT NULL, body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted BOOLEAN NOT NULL DEFAULT FALSE)`);
      // player-made arenas, and a few server-wide settings (the owner's switches)
      await q(`CREATE TABLE IF NOT EXISTS arenas (id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, name TEXT NOT NULL, def JSONB NOT NULL,
        pub BOOLEAN NOT NULL DEFAULT FALSE, featured BOOLEAN NOT NULL DEFAULT FALSE, ranked BOOLEAN NOT NULL DEFAULT FALSE, votes INTEGER NOT NULL DEFAULT 0,
        voters JSONB NOT NULL DEFAULT '[]', plays INTEGER NOT NULL DEFAULT 0, deleted BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
      await q(`CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v JSONB NOT NULL)`);
      // clans: the tag and name are unique (compared without case); everything else (members, rating, settings) is in data
      // messages between friends: lo/hi are the two user ids (smaller first), so a conversation is one index lookup
      await q(`CREATE TABLE IF NOT EXISTS dms (id BIGSERIAL PRIMARY KEY, lo INTEGER NOT NULL, hi INTEGER NOT NULL, sender INTEGER NOT NULL, body TEXT NOT NULL, at BIGINT NOT NULL)`);
      await q('CREATE INDEX IF NOT EXISTS dms_pair ON dms (lo, hi, id)');
      // each player's featured kill cam (one each): the replay's frames, gzipped (base64), shown on their profile
      await q(`CREATE TABLE IF NOT EXISTS clips (user_id INTEGER PRIMARY KEY, id TEXT NOT NULL UNIQUE, data TEXT NOT NULL, meta JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
      await q(`CREATE TABLE IF NOT EXISTS clans (id SERIAL PRIMARY KEY, tag_key TEXT NOT NULL UNIQUE, name_key TEXT NOT NULL UNIQUE, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
      for (let i = 0; i < CATEGORIES.length; i++) {
        const c = CATEGORIES[i];
        if (!(await one('SELECT id FROM forum_categories WHERE slug = $1', [c.slug])))
          await q('INSERT INTO forum_categories (slug, name, descr, admin_only, sort) VALUES ($1, $2, $3, $4, $5)', [c.slug, c.name, c.descr, !!c.adminOnly, i]);
      }
    },
    async userCount() { return +(await one('SELECT COUNT(*) AS n FROM users')).n; },
    async setOnlyAdmin(nameKey) { await q('UPDATE users SET is_admin = (name_key = $1) WHERE is_admin <> (name_key = $1)', [nameKey]); },
    // sign-ins through Google, Discord and so on, linked to an account
    async userForLogin(provider, pid) { const r = await one('SELECT user_id FROM user_logins WHERE provider = $1 AND provider_id = $2', [provider, String(pid)]); return r ? this.userById(r.user_id) : null; },
    async addLogin(provider, pid, userId) { await q('INSERT INTO user_logins (provider, provider_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [provider, String(pid), userId]); },
    async loginsOf(userId) { return (await q('SELECT provider FROM user_logins WHERE user_id = $1 ORDER BY provider', [userId])).map(r => r.provider); },
    async removeLogin(provider, userId) { await q('DELETE FROM user_logins WHERE provider = $1 AND user_id = $2', [provider, userId]); },
    async setPassword(userId, passHash) { await q('UPDATE users SET pass_hash = $2 WHERE id = $1', [userId, passHash]); },
    // a deleted account: everything personal is wiped and the name freed; the row stays so old forum posts still have an author
    async anonymiseUser(id) { await q("UPDATE users SET name = $2, name_key = $2, pass_hash = '', is_admin = FALSE, title = NULL, ach = '{}', career = '{}', country = NULL, social = $3 WHERE id = $1", [id, 'deleted-' + id, JSON.stringify({ deleted: Date.now() })]); },
    async createUser(name, passHash, admin) {
      if (await one('SELECT id FROM users WHERE name_key = $1', [name.toLowerCase()])) return null;
      return user(await one('INSERT INTO users (name, name_key, pass_hash, is_admin) VALUES ($1, $2, $3, $4) RETURNING *', [name, name.toLowerCase(), passHash, !!admin]));
    },
    async userByName(name) { return user(await one('SELECT * FROM users WHERE name_key = $1', [String(name).toLowerCase()])); },
    // the account's email and a password reset live in its private social data (never sent to other players)
    async userByEmail(email) { return user(await one("SELECT * FROM users WHERE LOWER(social->>'email') = $1 LIMIT 1", [String(email).toLowerCase()])); },
    async userByReset(hash) { return user(await one("SELECT * FROM users WHERE social->'reset'->>'h' = $1 LIMIT 1", [String(hash)])); },
    async userById(id) { return user(await one('SELECT * FROM users WHERE id = $1', [id])); },
    async saveUser(u) { await q('UPDATE users SET title = $2, ach = $3, career = $4, is_admin = $5, country = $6, social = $7 WHERE id = $1', [u.id, u.title, JSON.stringify(u.ach || {}), JSON.stringify(u.career || {}), !!u.admin, u.country || null, JSON.stringify(u.social || {})]); },
    async usersByIds(ids) { if (!ids.length) return []; return (await q('SELECT * FROM users WHERE id = ANY($1::int[])', [ids])).map(user); },
    async guestGet(id) { const r = await one('SELECT data FROM guests WHERE id = $1', [id]); return r ? r.data : null; },
    async guestSave(id, data) {
      if (!data) return void await q('DELETE FROM guests WHERE id = $1', [id]);
      await q('INSERT INTO guests (id, data, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET data = $2, updated_at = NOW()', [id, JSON.stringify(data)]);
    },
    async createSession(tokenHash, userId, expires) { await q('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tokenHash, userId, new Date(expires)]); },
    async sessionUser(tokenHash) {
      const s = await one('SELECT user_id, expires_at FROM sessions WHERE token_hash = $1', [tokenHash]);
      if (!s) return null;
      if (+new Date(s.expires_at) < Date.now()) { await q('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]); return null; }
      return this.userById(s.user_id);
    },
    async deleteSession(tokenHash) { await q('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]); },
    async deleteSessionsOf(userId) { await q('DELETE FROM sessions WHERE user_id = $1', [userId]); },
    async leaderboard(by, limit) {
      if (!BOARD_KEYS.includes(by)) by = 'wins';
      const rows = await q('SELECT * FROM users');
      return rows.map(user).sort((a, b) => (b.career[by] || 0) - (a.career[by] || 0)).slice(0, limit);
    },
    async categories() {
      const cats = await q('SELECT * FROM forum_categories ORDER BY sort');
      const out = [];
      for (const c of cats) {
        const n = await one('SELECT COUNT(*) AS n, MAX(last_post_at) AS last FROM forum_threads WHERE cat_id = $1 AND deleted = FALSE', [c.id]);
        out.push({ id: c.id, slug: c.slug, name: c.name, descr: c.descr, adminOnly: !!c.admin_only, threads: +n.n, last: n.last ? +new Date(n.last) : null });
      }
      return out;
    },
    async category(idOrSlug) {
      const c = await one('SELECT * FROM forum_categories WHERE slug = $1 OR CAST(id AS TEXT) = $1', [String(idOrSlug)]);
      return c && { id: c.id, slug: c.slug, name: c.name, descr: c.descr, adminOnly: !!c.admin_only };
    },
    async threads(catId, limit, offset) {
      const rows = await q(`SELECT t.*, u.name AS author FROM forum_threads t JOIN users u ON u.id = t.user_id
        WHERE t.cat_id = $1 AND t.deleted = FALSE ORDER BY t.pinned DESC, t.last_post_at DESC LIMIT $2 OFFSET $3`, [catId, limit, offset]);
      return rows.map(threadRow);
    },
    async recentThreads(limit) {
      const rows = await q(`SELECT t.*, u.name AS author, c.slug AS cat_slug, c.name AS cat_name FROM forum_threads t JOIN users u ON u.id = t.user_id
        JOIN forum_categories c ON c.id = t.cat_id WHERE t.deleted = FALSE ORDER BY t.last_post_at DESC LIMIT $1`, [limit]);
      return rows.map(threadRow);
    },
    async thread(id) {
      const t = await one(`SELECT t.*, u.name AS author FROM forum_threads t JOIN users u ON u.id = t.user_id WHERE t.id = $1 AND t.deleted = FALSE`, [id]);
      return t && threadRow(t);
    },
    async posts(threadId) {
      const rows = await q(`SELECT p.*, u.name AS author, u.title AS author_title, u.is_admin AS author_admin, u.country AS author_country, u.career AS author_career FROM forum_posts p JOIN users u ON u.id = p.user_id
        WHERE p.thread_id = $1 ORDER BY p.id`, [threadId]);
      return rows.map(r => ({ id: r.id, threadId: r.thread_id, userId: r.user_id, author: r.author, authorTitle: r.author_title || null, authorAdmin: !!r.author_admin, authorCountry: r.author_country || null, authorCareer: r.author_career || {},
        body: r.deleted ? '' : r.body, deleted: !!r.deleted, created: +new Date(r.created_at) }));
    },
    async createThread(catId, userId, title, body) {
      const t = await one('INSERT INTO forum_threads (cat_id, user_id, title, post_count) VALUES ($1, $2, $3, 1) RETURNING id', [catId, userId, title]);
      await q('INSERT INTO forum_posts (thread_id, user_id, body) VALUES ($1, $2, $3)', [t.id, userId, body]);
      return t.id;
    },
    async createPost(threadId, userId, body) {
      const r = await one('INSERT INTO forum_posts (thread_id, user_id, body) VALUES ($1, $2, $3) RETURNING id', [threadId, userId, body]);
      await q('UPDATE forum_threads SET post_count = post_count + 1, last_post_at = NOW() WHERE id = $1', [threadId]);
      return r.id;
    },
    async post(id) { const r = await one('SELECT * FROM forum_posts WHERE id = $1', [id]); return r && { id: r.id, threadId: r.thread_id, userId: r.user_id, deleted: !!r.deleted }; },
    async deletePost(id) { await q('UPDATE forum_posts SET deleted = TRUE WHERE id = $1', [id]); },
    async setThread(id, f) {
      if ('locked' in f) await q('UPDATE forum_threads SET locked = $2 WHERE id = $1', [id, !!f.locked]);
      if ('pinned' in f) await q('UPDATE forum_threads SET pinned = $2 WHERE id = $1', [id, !!f.pinned]);
      if ('deleted' in f) await q('UPDATE forum_threads SET deleted = $2 WHERE id = $1', [id, !!f.deleted]);
    },
    // ---- arenas
    async arenaCreate(userId, name, def, pub) { const r = await one('INSERT INTO arenas (user_id, name, def, pub) VALUES ($1, $2, $3, $4) RETURNING id', [userId, name, JSON.stringify(def), !!pub]); return r.id; },
    async arenaGet(id) { const r = await one('SELECT a.*, u.name AS author FROM arenas a JOIN users u ON u.id = a.user_id WHERE a.id = $1 AND a.deleted = FALSE', [id]); return r && arenaRow(r); },
    async arenasOf(userId) { return (await q('SELECT a.*, u.name AS author FROM arenas a JOIN users u ON u.id = a.user_id WHERE a.user_id = $1 AND a.deleted = FALSE ORDER BY a.updated_at DESC', [userId])).map(arenaRow); },
    async arenasWhere(f) { // f: 'pub' | 'featured' | 'ranked'
      const col = { pub: 'a.pub', featured: 'a.featured', ranked: 'a.ranked' }[f] || 'a.pub';
      return (await q(`SELECT a.*, u.name AS author FROM arenas a JOIN users u ON u.id = a.user_id WHERE ${col} = TRUE AND a.deleted = FALSE ORDER BY a.votes DESC, a.updated_at DESC LIMIT 500`)).map(arenaRow);
    },
    async arenaUpdate(id, f) {
      const cols = { name: 'name', def: 'def', pub: 'pub', featured: 'featured', ranked: 'ranked', votes: 'votes', voters: 'voters', plays: 'plays', deleted: 'deleted' };
      const set = [], vals = [id];
      for (const [k, c] of Object.entries(cols)) if (k in f) { vals.push(k === 'def' || k === 'voters' ? JSON.stringify(f[k]) : f[k]); set.push(`${c} = $${vals.length}`); }
      if ('def' in f || 'name' in f) set.push('updated_at = NOW()');
      if (set.length) await q(`UPDATE arenas SET ${set.join(', ')} WHERE id = $1`, vals);
    },
    // ---- clans
    async clanList() { return (await q('SELECT id, data FROM clans ORDER BY id')).map(r => Object.assign({}, r.data, { id: r.id })); },
    async clanCreate(c) { // null if the tag or name is taken
      const r = await one('INSERT INTO clans (tag_key, name_key, data) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING RETURNING id', [c.tag.toLowerCase(), c.name.toLowerCase(), JSON.stringify(c)]);
      return r ? r.id : null;
    },
    async clanSave(c) { await q('UPDATE clans SET data = $2 WHERE id = $1', [c.id, JSON.stringify(c)]); },
    async clanDelete(id) { await q('DELETE FROM clans WHERE id = $1', [id]); },
    // ---- messages between friends (the newest DM_KEEP per conversation are kept)
    async dmAdd(from, to, body) {
      const lo = Math.min(from, to), hi = Math.max(from, to), at = Date.now();
      const r = await one('INSERT INTO dms (lo, hi, sender, body, at) VALUES ($1, $2, $3, $4, $5) RETURNING id', [lo, hi, from, body, at]);
      if (r.id % 25 === 0) await q('DELETE FROM dms WHERE lo = $1 AND hi = $2 AND id < (SELECT MIN(id) FROM (SELECT id FROM dms WHERE lo = $1 AND hi = $2 ORDER BY id DESC LIMIT $3) t)', [lo, hi, DM_KEEP]);
      return { id: +r.id, from, to, body, at };
    },
    async dmHistory(a, b, before, n) {
      const lo = Math.min(a, b), hi = Math.max(a, b);
      const rows = await q('SELECT id, sender, body, at FROM dms WHERE lo = $1 AND hi = $2 AND id < $3 ORDER BY id DESC LIMIT $4', [lo, hi, before || Number.MAX_SAFE_INTEGER, n]);
      return rows.reverse().map(r => ({ id: +r.id, from: r.sender, to: r.sender === lo ? hi : lo, body: r.body, at: +r.at }));
    },
    async dmForget(id) { await q('DELETE FROM dms WHERE lo = $1 OR hi = $1', [id]); await q('DELETE FROM clips WHERE user_id = $1', [id]); },
    async clipSet(userId, id, data, meta) { await q('INSERT INTO clips (user_id, id, data, meta) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO UPDATE SET id = $2, data = $3, meta = $4, created_at = NOW()', [userId, id, data, JSON.stringify(meta)]); },
    async clipGet(id) { const r = await one('SELECT user_id, id, data, meta FROM clips WHERE id = $1', [String(id)]); return r ? { userId: r.user_id, id: r.id, data: r.data, meta: r.meta } : null; },
    async clipDrop(userId) { await q('DELETE FROM clips WHERE user_id = $1', [userId]); },
    // ---- settings
    async getSetting(k) { const r = await one('SELECT v FROM settings WHERE k = $1', [k]); return r ? r.v : null; },
    async setSetting(k, v) { await q('INSERT INTO settings (k, v) VALUES ($1, $2) ON CONFLICT (k) DO UPDATE SET v = $2', [k, JSON.stringify(v)]); },
    close() { return pool.end(); },
  };
}
function arenaRow(r) {
  return { id: r.id, userId: r.user_id, author: r.author, name: r.name, def: r.def, pub: !!r.pub, featured: !!r.featured, ranked: !!r.ranked, votes: r.votes, voters: r.voters || [], plays: r.plays || 0,
    created: +new Date(r.created_at), updated: +new Date(r.updated_at) };
}
function threadRow(t) {
  return { id: t.id, catId: t.cat_id, userId: t.user_id, author: t.author, title: t.title, created: +new Date(t.created_at), last: +new Date(t.last_post_at),
    posts: t.post_count, locked: !!t.locked, pinned: !!t.pinned, catSlug: t.cat_slug, catName: t.cat_name };
}

// ---------------- JSON file ----------------
function fileStore(file) {
  let d = null, timer = null;
  const save = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      const tmp = file + '.tmp';
      fs.writeFile(tmp, JSON.stringify(d), err => { if (!err) fs.rename(tmp, file, () => {}); else console.error('Could not save the database:', err.message); });
    }, 250);
  };
  const clone = o => o && JSON.parse(JSON.stringify(o));
  const userOut = u => u && Object.assign(clone(u), { passHash: u.passHash });
  const authorOf = id => (d.users.find(u => u.id === id) || { name: '?' });
  const tOut = t => { const c = d.cats.find(c => c.id === t.catId); return Object.assign(clone(t), { author: authorOf(t.userId).name, catSlug: c && c.slug, catName: c && c.name }); };
  return {
    kind: 'file',
    async init() {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      try { d = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { d = null; }
      d = Object.assign({ seq: 1, users: [], sessions: {}, cats: [], threads: [], posts: [], logins: [], guests: {}, arenas: [], settings: {}, clans: [], dms: [], clips: {} }, d || {});
      CATEGORIES.forEach((c, i) => { if (!d.cats.some(x => x.slug === c.slug)) d.cats.push({ id: d.seq++, slug: c.slug, name: c.name, descr: c.descr, adminOnly: !!c.adminOnly, sort: i }); });
      save();
    },
    async userCount() { return d.users.length; },
    async setOnlyAdmin(nameKey) { let ch = false; for (const u of d.users) { const a = u.name.toLowerCase() === nameKey; if (!!u.admin !== a) { u.admin = a; ch = true; } } if (ch) save(); },
    async userForLogin(provider, pid) { const l = d.logins.find(l => l.provider === provider && l.pid === String(pid)); return l ? this.userById(l.userId) : null; },
    async addLogin(provider, pid, userId) { if (!d.logins.some(l => l.provider === provider && l.pid === String(pid))) { d.logins.push({ provider, pid: String(pid), userId, created: Date.now() }); save(); } },
    async loginsOf(userId) { return d.logins.filter(l => l.userId === userId).map(l => l.provider).sort(); },
    async removeLogin(provider, userId) { d.logins = d.logins.filter(l => !(l.provider === provider && l.userId === userId)); save(); },
    async setPassword(userId, passHash) { const u = d.users.find(u => u.id === userId); if (u) { u.passHash = passHash; save(); } },
    async anonymiseUser(id) { const u = d.users.find(x => x.id === id); if (!u) return; Object.assign(u, { name: 'deleted-' + id, passHash: '', admin: false, title: null, ach: {}, career: {}, country: null, social: { deleted: Date.now() } }); save(); },
    async createUser(name, passHash, admin) {
      if (d.users.some(u => u.name.toLowerCase() === name.toLowerCase())) return null;
      const u = { id: d.seq++, name, passHash, admin: !!admin, title: null, ach: {}, career: {}, social: {}, created: Date.now() };
      d.users.push(u); save(); return userOut(u);
    },
    async userByName(name) { return userOut(d.users.find(u => u.name.toLowerCase() === String(name).toLowerCase())); },
    async userByEmail(email) { const e = String(email).toLowerCase(); return userOut(d.users.find(u => u.social && String(u.social.email || '').toLowerCase() === e)); },
    async userByReset(hash) { return userOut(d.users.find(u => u.social && u.social.reset && u.social.reset.h === String(hash))); },
    async userById(id) { return userOut(d.users.find(u => u.id === id)); },
    async saveUser(u) { const x = d.users.find(v => v.id === u.id); if (!x) return; Object.assign(x, { title: u.title, ach: clone(u.ach || {}), career: clone(u.career || {}), admin: !!u.admin, country: u.country || null, social: clone(u.social || {}) }); save(); },
    async usersByIds(ids) { return d.users.filter(u => ids.includes(u.id)).map(userOut); },
    async guestGet(id) { return clone(d.guests[id]) || null; },
    async guestSave(id, data) { if (data) d.guests[id] = clone(data); else delete d.guests[id]; save(); },
    async createSession(tokenHash, userId, expires) { d.sessions[tokenHash] = { userId, expires }; save(); },
    async sessionUser(tokenHash) {
      const s = d.sessions[tokenHash];
      if (!s) return null;
      if (s.expires < Date.now()) { delete d.sessions[tokenHash]; save(); return null; }
      return this.userById(s.userId);
    },
    async deleteSession(tokenHash) { delete d.sessions[tokenHash]; save(); },
    async deleteSessionsOf(userId) { for (const k of Object.keys(d.sessions)) if (d.sessions[k].userId === userId) delete d.sessions[k]; save(); },
    async leaderboard(by, limit) {
      if (!BOARD_KEYS.includes(by)) by = 'wins';
      return d.users.map(userOut).sort((a, b) => (b.career[by] || 0) - (a.career[by] || 0)).slice(0, limit);
    },
    async categories() {
      return d.cats.slice().sort((a, b) => a.sort - b.sort).map(c => {
        const ts = d.threads.filter(t => t.catId === c.id && !t.deleted);
        return { id: c.id, slug: c.slug, name: c.name, descr: c.descr, adminOnly: c.adminOnly, threads: ts.length, last: ts.length ? Math.max(...ts.map(t => t.last)) : null };
      });
    },
    async category(idOrSlug) { const c = d.cats.find(c => c.slug === String(idOrSlug) || String(c.id) === String(idOrSlug)); return clone(c) || null; },
    async threads(catId, limit, offset) {
      return d.threads.filter(t => t.catId === catId && !t.deleted).sort((a, b) => (b.pinned - a.pinned) || (b.last - a.last)).slice(offset, offset + limit).map(tOut);
    },
    async recentThreads(limit) { return d.threads.filter(t => !t.deleted).sort((a, b) => b.last - a.last).slice(0, limit).map(tOut); },
    async thread(id) { const t = d.threads.find(t => t.id === id && !t.deleted); return t ? tOut(t) : null; },
    async posts(threadId) {
      return d.posts.filter(p => p.threadId === threadId).sort((a, b) => a.id - b.id).map(p => {
        const u = authorOf(p.userId);
        return { id: p.id, threadId: p.threadId, userId: p.userId, author: u.name, authorTitle: u.title || null, authorAdmin: !!u.admin, authorCountry: u.country || null, authorCareer: clone(u.career || {}), body: p.deleted ? '' : p.body, deleted: !!p.deleted, created: p.created };
      });
    },
    async createThread(catId, userId, title, body) {
      const now = Date.now(), t = { id: d.seq++, catId, userId, title, created: now, last: now, posts: 1, locked: false, pinned: false, deleted: false };
      d.threads.push(t); d.posts.push({ id: d.seq++, threadId: t.id, userId, body, created: now, deleted: false }); save();
      return t.id;
    },
    async createPost(threadId, userId, body) {
      const t = d.threads.find(t => t.id === threadId), p = { id: d.seq++, threadId, userId, body, created: Date.now(), deleted: false };
      d.posts.push(p); if (t) { t.posts++; t.last = p.created; } save();
      return p.id;
    },
    async post(id) { const p = d.posts.find(p => p.id === id); return p ? { id: p.id, threadId: p.threadId, userId: p.userId, deleted: !!p.deleted } : null; },
    async deletePost(id) { const p = d.posts.find(p => p.id === id); if (p) { p.deleted = true; save(); } },
    async setThread(id, f) { const t = d.threads.find(t => t.id === id); if (!t) return; for (const k of ['locked', 'pinned', 'deleted']) if (k in f) t[k] = !!f[k]; save(); },
    // ---- arenas
    async arenaCreate(userId, name, def, pub) { const now = Date.now(), a = { id: d.seq++, userId, name, def: clone(def), pub: !!pub, featured: false, ranked: false, votes: 0, voters: [], plays: 0, deleted: false, created: now, updated: now }; d.arenas.push(a); save(); return a.id; },
    async arenaGet(id) { const a = d.arenas.find(a => a.id === id && !a.deleted); return a ? Object.assign(clone(a), { author: authorOf(a.userId).name }) : null; },
    async arenasOf(userId) { return d.arenas.filter(a => a.userId === userId && !a.deleted).sort((a, b) => b.updated - a.updated).map(a => Object.assign(clone(a), { author: authorOf(a.userId).name })); },
    async arenasWhere(f) { return d.arenas.filter(a => a[f] && !a.deleted).sort((a, b) => (b.votes - a.votes) || (b.updated - a.updated)).slice(0, 500).map(a => Object.assign(clone(a), { author: authorOf(a.userId).name })); },
    async arenaUpdate(id, f) { const a = d.arenas.find(a => a.id === id); if (!a) return; for (const k of ['name', 'def', 'pub', 'featured', 'ranked', 'votes', 'voters', 'plays', 'deleted']) if (k in f) a[k] = clone(f[k]); if ('def' in f || 'name' in f) a.updated = Date.now(); save(); },
    // ---- clans
    async clanList() { return d.clans.map(clone); },
    async clanCreate(c) {
      if (d.clans.some(x => x.tag.toLowerCase() === c.tag.toLowerCase() || x.name.toLowerCase() === c.name.toLowerCase())) return null;
      const x = Object.assign(clone(c), { id: d.seq++ }); d.clans.push(x); save(); return x.id;
    },
    async clanSave(c) { const i = d.clans.findIndex(x => x.id === c.id); if (i >= 0) { d.clans[i] = clone(c); save(); } },
    async clanDelete(id) { d.clans = d.clans.filter(x => x.id !== id); save(); },
    // ---- messages between friends
    async dmAdd(from, to, body) {
      const m = { id: d.seq++, from, to, body, at: Date.now() }; d.dms.push(m);
      const pair = x => (x.from === from && x.to === to) || (x.from === to && x.to === from);
      const mine = d.dms.filter(pair);
      if (mine.length > DM_KEEP) { const drop = new Set(mine.slice(0, mine.length - DM_KEEP)); d.dms = d.dms.filter(x => !drop.has(x)); }
      save(); return clone(m);
    },
    async dmHistory(a, b, before, n) { return d.dms.filter(x => ((x.from === a && x.to === b) || (x.from === b && x.to === a)) && (!before || x.id < before)).slice(-n).map(clone); },
    async dmForget(id) { d.dms = d.dms.filter(x => x.from !== id && x.to !== id); delete d.clips[id]; save(); },
    async clipSet(userId, id, data, meta) { d.clips[userId] = { userId, id, data, meta: clone(meta) }; save(); },
    async clipGet(id) { const c = Object.values(d.clips).find(x => x.id === String(id)); return c ? clone(c) : null; },
    async clipDrop(userId) { delete d.clips[userId]; save(); },
    // ---- settings
    async getSetting(k) { return k in d.settings ? clone(d.settings[k]) : null; },
    async setSetting(k, v) { d.settings[k] = clone(v); save(); },
    close() {},
  };
}

function createStore(opts = {}) {
  const url = opts.url !== undefined ? opts.url : process.env.DATABASE_URL;
  if (url || opts.pool) return pgStore(opts.pool || url, opts.pg);
  return fileStore(opts.file || process.env.BOWFALL_DB || path.join(__dirname, '..', 'data', 'db.json'));
}
module.exports = { DM_KEEP, createStore, CATEGORIES, BOARD_KEYS };
