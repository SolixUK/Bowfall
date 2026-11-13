#!/usr/bin/env node
// release: the same steps every time, so none get missed.
//   node tools/release.js 0.99.29
// 1. checks CHANGELOG.md already has a "## 0.99.29" section (write it first: what changed, in players' words)
// 2. sets the version everywhere it lives: package.json, VERSION in public/sim.js, PAGE_VERSION and the sim.js?v= cache
//    key in public/index.html (a stale cache key means players keep the old sim)
// 3. syntax-checks every server and tool script, and the scripts inside public/index.html
// 4. plays two short bot matches with the sim, so a broken sim can't ship
// 5. builds the offline file (node build-offline.js)
// 6. checks no secrets ended up in tracked files (they live only in Render's settings)
// Stops at the first problem and says what it was.
'use strict';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8'), wr = (f, s) => fs.writeFileSync(path.join(ROOT, f), s);
const fail = m => { console.error('✗ ' + m); process.exit(1); }, ok = m => console.log('✓ ' + m);
const V = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(V || '')) fail('usage: node tools/release.js <version>, e.g. 0.99.29');

// 1. changelog
if (!new RegExp('^## ' + V.replace(/\./g, '\\.') + '\\s*$', 'm').test(rd('CHANGELOG.md'))) fail(`CHANGELOG.md has no "## ${V}" section: write what changed first`);
ok('changelog has ' + V);

// 2. version everywhere
const pkg = JSON.parse(rd('package.json')), was = pkg.version; pkg.version = V; wr('package.json', JSON.stringify(pkg, null, 2) + '\n');
let sim = rd('public/sim.js'); if (!/const VERSION = '[^']*';/.test(sim)) fail('no VERSION line in public/sim.js'); sim = sim.replace(/const VERSION = '[^']*';/, `const VERSION = '${V}';`); wr('public/sim.js', sim);
let page = rd('public/index.html'); const n1 = (page.match(/sim\.js\?v=[\d.]+/g) || []).length, n2 = (page.match(/PAGE_VERSION = '[^']*'/g) || []).length;
if (!n1 || !n2) fail('public/index.html: sim.js?v= or PAGE_VERSION not found');
page = page.replace(/sim\.js\?v=[\d.]+/g, 'sim.js?v=' + V).replace(/PAGE_VERSION = '[^']*'/g, `PAGE_VERSION = '${V}'`); wr('public/index.html', page);
ok(`version ${was} → ${V} (package.json, sim.js, index.html ×${n1 + n2})`);

// 3. syntax
const js = ['server.js', 'build-offline.js', ...fs.readdirSync(path.join(ROOT, 'lib')).filter(f => f.endsWith('.js')).map(f => 'lib/' + f), ...fs.readdirSync(path.join(ROOT, 'tools')).filter(f => f.endsWith('.js')).map(f => 'tools/' + f), ...fs.readdirSync(path.join(ROOT, 'public')).filter(f => f.endsWith('.js')).map(f => 'public/' + f)];
for (const f of js) { try { execFileSync(process.execPath, ['--check', path.join(ROOT, f)], { stdio: 'pipe' }); } catch (e) { fail(`${f}: ${String(e.stderr || e.message).split('\n').slice(0, 4).join(' ')}`); } }
const blocks = [...page.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.trim());
for (const [i, b] of blocks.entries()) { try { new Function(b.replace(/^\s*import\s.*$/gm, '')); } catch (e) { fail(`public/index.html script ${i + 1}: ${e.message}`); } }
ok(`syntax: ${js.length} scripts and ${blocks.length} page scripts`);

// 4. the sim plays
delete require.cache[require.resolve(path.join(ROOT, 'public/sim.js'))];
const S = require(path.join(ROOT, 'public/sim.js'));
for (const [ra, rb] of [['ranger', 'sniper'], ['ninja', 'juggernaut']]) {
  const w = S.createWorld({ map: S.rankedPool()[0], opt: { effect: 'none' } }); w.cfg.pointsToWin = 1; w.cfg.gamesToWin = 1;
  const a = S.addBot(w, 'red'), b = S.addBot(w, 'blue'); S.setLoadout(w, a.id, 'frost', ra); S.setLoadout(w, b.id, 'flame', rb);
  S.startMatch(w); let n = 0; for (; n < 60 * 60 * 6 && w.match.ph !== 'over'; n++) { S.step(w, 1 / 60); w.events.length = 0; }
  if (w.match.ph !== 'over') fail(`a ${ra} vs ${rb} bot match didn't finish in 6 minutes of game time`);
}
ok('sim: two bot matches played to the end');

// 5. offline build
try { execFileSync(process.execPath, [path.join(ROOT, 'build-offline.js')], { cwd: ROOT, stdio: 'pipe' }); } catch (e) { fail('build-offline.js: ' + String(e.stderr || e.message).slice(0, 300)); }
ok('offline build');

// 6. secrets
const SECRET = [/postgres(ql)?:\/\/[^\s'"]*:[^\s'"]*@/i, /\bsk_live_[0-9a-zA-Z]{10,}/, /\bre_[0-9a-zA-Z]{20,}/, /GOCSPX-[0-9A-Za-z_-]{10,}/];
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.name === 'node_modules' || e.name === 'data' || e.name === '.git' || e.name === 'fit-out') ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const f of walk(ROOT)) { if (!/\.(js|json|html|md|yml|yaml|env|txt)$/.test(f) && !/\.env/.test(f)) continue; const t = fs.readFileSync(f, 'utf8'); for (const r of SECRET) { const m = t.match(r); if (m && !/user:pass(word)?@|USER:PASS|<[^>]+>:<[^>]+>@/i.test(m[0])) fail(`${path.relative(ROOT, f)} looks like it holds a secret (${r}): secrets belong in Render's environment settings only`); } } // (an example like user:password@ in the docs is fine)
ok('no secrets in the files');
console.log(`\nReady: ${V}. Commit and push to deploy.`);
