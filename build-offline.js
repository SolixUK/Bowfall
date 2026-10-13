// Builds a single-file, offline-only copy of the game (practice vs bots) at dist/bowfall-duels.html.
'use strict';
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
const sim = fs.readFileSync(path.join(__dirname, 'public/sim.js'), 'utf8');
// the shipped sound mix (from the sound desk), if there is one
let mixJs = '';
try { const m = JSON.parse(fs.readFileSync(path.join(__dirname, 'public/sfx/mix.json'), 'utf8')); if (m && (Object.keys(m.ch || {}).length || Object.keys(m.takes || {}).length || m.master)) mixJs = ' window.BOWFALL_MIX = ' + JSON.stringify(m).replace(/</g, '\\u003c') + ';'; } catch (e) {}
// the ranked AI players' roster, for the clip farm (offline there's no server to ask)
let aiJs = '';
try { const { levelOf } = require('./lib/level'); const L = JSON.parse(fs.readFileSync(path.join(__dirname, 'lib/ai-players.json'), 'utf8'));
  const roster = L.map(a => ({ name: a.name, cc: a.country, lv: levelOf(a.career || {}).lv, elo: Math.round((a.career || {}).elo || 800), eloT: Math.round((a.career || {}).eloT || (a.career || {}).elo || 800), skill: (a.ai || {}).skill, loadouts: (a.ai || {}).loadouts || [], look: { av: (a.ach || {}).avatar || null, bd: (a.ach || {}).border || null, ti: a.title || null } })).sort((x, y) => y.elo - x.elo);
  aiJs = ' window.BOWFALL_AI = ' + JSON.stringify(roster).replace(/</g, '\\u003c') + ';'; } catch (e) { console.warn('No AI roster for the clip farm:', e.message); }
const part = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b); if (i < 0 || j < 0) throw new Error('marker missing: ' + a); return html.slice(i + a.length, j); };

const head = part('<!--HEAD-->', '<!--/HEAD-->').replace(/<link rel="(manifest|apple-touch-icon)"[^>]*>\n?/g, '').replace(/<link rel="icon"[^>]*>\n?/g, '').replace('</title>', '</title>\n<link rel="icon" type="image/png" href="data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'public/icons/archer-32.png')).toString('base64') + '">'); // no installable app offline
const body = part('<!--BODY-->', '<!--/BODY-->')
  .replace(/<script src="sim.js(\?v=[0-9.]+)?"><\/script>/, () => '<script>window.BOWFALL_OFFLINE = true; window.__host = window.claude;' + mixJs + aiJs + '</script>\n<script>\n' + sim + '\n</script>');

fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/bowfall-duels.html'), head.trim() + '\n' + body.trim() + '\n');
console.log('Wrote dist/bowfall-duels.html');
