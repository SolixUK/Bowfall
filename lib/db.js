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
const BOARD_KEYS = ['wins', 'kills', 'games', 'matchWins', 'ring', 'bull'];

// ---------------- Postgres ----------------
function pgStore(url, pgModule) {
  const { Pool } = pgModule || require('pg');
  const pool = new Pool(typeof url === 'string'
    ? { connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false }, max: 5 }
    : url);
  const q = (text, params) => pool.query(text, params).then(r => r.rows);
  const one = async (text, params) => (await q(text, params))[0] || null;
  const user = r => r && { id: r.id, name: r.name, passHash: r.pass_hash, admin: !!r.is_admin, title: r.title || null, ach: r.ach || {}, career: r.career || {}, created: +new Date(r.created_at) };
  return {
    kind: 'postgres',
    async init() {
      await q(`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, pass_hash TEXT NOT NULL,
        is_admin BOOLEAN NOT NULL DEFAULT FALSE, title TEXT, ach JSONB NOT NULL DEFAULT '{}', career JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
      await q(`CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires_at TIMESTAMPTZ NOT NULL)`);
      await q(`CREATE TABLE IF NOT EXISTS forum_categories (id SERIAL PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, descr TEXT NOT NULL, admin_only BOOLEAN NOT NULL DEFAULT FALSE, sort INTEGER NOT NULL DEFAULT 0)`);
      await q(`CREATE TABLE IF NOT EXISTS forum_threads (id SERIAL PRIMARY KEY, cat_id INTEGER NOT NULL, user_id INTEGER NOT NULL, title TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_post_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), post_count INTEGER NOT NULL DEFAULT 0,
        locked BOOLEAN NOT NULL DEFAULT FALSE, pinned BOOLEAN NOT NULL DEFAULT FALSE, deleted BOOLEAN NOT NULL DEFAULT FALSE)`);
      await q(`CREATE TABLE IF NOT EXISTS user_logins (provider TEXT NOT NULL, provider_id TEXT NOT NULL, user_id INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (provider, provider_id))`);
      await q(`CREATE TABLE IF NOT EXISTS forum_posts (id SERIAL PRIMARY KEY, thread_id INTEGER NOT NULL, user_id INTEGER NOT NULL, body TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), deleted BOOLEAN NOT NULL DEFAULT FALSE)`);
      for (let i = 0; i < CATEGORIES.length; i++) {
        const c = CATEGORIES[i];
        if (!(await one('SELECT id FROM forum_categories WHERE slug = $1', [c.slug])))
          await q('INSERT INTO forum_categories (slug, name, descr, admin_only, sort) VALUES ($1, $2, $3, $4, $5)', [c.slug, c.name, c.descr, !!c.adminOnly, i]);
      }
    },
    async userCount() { return +(await one('SELECT COUNT(*) AS n FROM users')).n; },
    // sign-ins through Google, Discord and so on, linked to an account
    async userForLogin(provider, pid) { const r = await one('SELECT user_id FROM user_logins WHERE provider = $1 AND provider_id = $2', [provider, String(pid)]); return r ? this.userById(r.user_id) : null; },
    async addLogin(provider, pid, userId) { await q('INSERT INTO user_logins (provider, provider_id, user_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [provider, String(pid), userId]); },
    async loginsOf(userId) { return (await q('SELECT provider FROM user_logins WHERE user_id = $1 ORDER BY provider', [userId])).map(r => r.provider); },
    async removeLogin(provider, userId) { await q('DELETE FROM user_logins WHERE provider = $1 AND user_id = $2', [provider, userId]); },
    async setPassword(userId, passHash) { await q('UPDATE users SET pass_hash = $2 WHERE id = $1', [userId, passHash]); },
    async createUser(name, passHash, admin) {
      if (await one('SELECT id FROM users WHERE name_key = $1', [name.toLowerCase()])) return null;
      return user(await one('INSERT INTO users (name, name_key, pass_hash, is_admin) VALUES ($1, $2, $3, $4) RETURNING *', [name, name.toLowerCase(), passHash, !!admin]));
    },
    async userByName(name) { return user(await one('SELECT * FROM users WHERE name_key = $1', [String(name).toLowerCase()])); },
    async userById(id) { return user(await one('SELECT * FROM users WHERE id = $1', [id])); },
    async saveUser(u) { await q('UPDATE users SET title = $2, ach = $3, career = $4, is_admin = $5 WHERE id = $1', [u.id, u.title, JSON.stringify(u.ach || {}), JSON.stringify(u.career || {}), !!u.admin]); },
    async createSession(tokenHash, userId, expires) { await q('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [tokenHash, userId, new Date(expires)]); },
    async sessionUser(tokenHash) {
      const s = await one('SELECT user_id, expires_at FROM sessions WHERE token_hash = $1', [tokenHash]);
      if (!s) return null;
      if (+new Date(s.expires_at) < Date.now()) { await q('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]); return null; }
      return this.userById(s.user_id);
    },
    async deleteSession(tokenHash) { await q('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]); },
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
      const rows = await q(`SELECT p.*, u.name AS author, u.title AS author_title, u.is_admin AS author_admin FROM forum_posts p JOIN users u ON u.id = p.user_id
        WHERE p.thread_id = $1 ORDER BY p.id`, [threadId]);
      return rows.map(r => ({ id: r.id, threadId: r.thread_id, userId: r.user_id, author: r.author, authorTitle: r.author_title || null, authorAdmin: !!r.author_admin,
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
    close() { return pool.end(); },
  };
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
      d = Object.assign({ seq: 1, users: [], sessions: {}, cats: [], threads: [], posts: [], logins: [] }, d || {});
      CATEGORIES.forEach((c, i) => { if (!d.cats.some(x => x.slug === c.slug)) d.cats.push({ id: d.seq++, slug: c.slug, name: c.name, descr: c.descr, adminOnly: !!c.adminOnly, sort: i }); });
      save();
    },
    async userCount() { return d.users.length; },
    async userForLogin(provider, pid) { const l = d.logins.find(l => l.provider === provider && l.pid === String(pid)); return l ? this.userById(l.userId) : null; },
    async addLogin(provider, pid, userId) { if (!d.logins.some(l => l.provider === provider && l.pid === String(pid))) { d.logins.push({ provider, pid: String(pid), userId, created: Date.now() }); save(); } },
    async loginsOf(userId) { return d.logins.filter(l => l.userId === userId).map(l => l.provider).sort(); },
    async removeLogin(provider, userId) { d.logins = d.logins.filter(l => !(l.provider === provider && l.userId === userId)); save(); },
    async setPassword(userId, passHash) { const u = d.users.find(u => u.id === userId); if (u) { u.passHash = passHash; save(); } },
    async createUser(name, passHash, admin) {
      if (d.users.some(u => u.name.toLowerCase() === name.toLowerCase())) return null;
      const u = { id: d.seq++, name, passHash, admin: !!admin, title: null, ach: {}, career: {}, created: Date.now() };
      d.users.push(u); save(); return userOut(u);
    },
    async userByName(name) { return userOut(d.users.find(u => u.name.toLowerCase() === String(name).toLowerCase())); },
    async userById(id) { return userOut(d.users.find(u => u.id === id)); },
    async saveUser(u) { const x = d.users.find(v => v.id === u.id); if (!x) return; Object.assign(x, { title: u.title, ach: clone(u.ach || {}), career: clone(u.career || {}), admin: !!u.admin }); save(); },
    async createSession(tokenHash, userId, expires) { d.sessions[tokenHash] = { userId, expires }; save(); },
    async sessionUser(tokenHash) {
      const s = d.sessions[tokenHash];
      if (!s) return null;
      if (s.expires < Date.now()) { delete d.sessions[tokenHash]; save(); return null; }
      return this.userById(s.userId);
    },
    async deleteSession(tokenHash) { delete d.sessions[tokenHash]; save(); },
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
        return { id: p.id, threadId: p.threadId, userId: p.userId, author: u.name, authorTitle: u.title || null, authorAdmin: !!u.admin, body: p.deleted ? '' : p.body, deleted: !!p.deleted, created: p.created };
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
    close() {},
  };
}

function createStore(opts = {}) {
  const url = opts.url !== undefined ? opts.url : process.env.DATABASE_URL;
  if (url || opts.pool) return pgStore(opts.pool || url, opts.pg);
  return fileStore(opts.file || process.env.BOWFALL_DB || path.join(__dirname, '..', 'data', 'db.json'));
}
module.exports = { createStore, CATEGORIES, BOARD_KEYS };
