// Builds a single-file, offline-only copy of the game (practice vs bots) at dist/bowfall-duels.html.
'use strict';
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf8');
const sim = fs.readFileSync(path.join(__dirname, 'public/sim.js'), 'utf8');
const part = (a, b) => { const i = html.indexOf(a), j = html.indexOf(b); if (i < 0 || j < 0) throw new Error('marker missing: ' + a); return html.slice(i + a.length, j); };

const head = part('<!--HEAD-->', '<!--/HEAD-->');
const body = part('<!--BODY-->', '<!--/BODY-->')
  .replace('<script src="sim.js"></script>', () => '<script>window.BOWFALL_OFFLINE = true; window.__host = window.claude;</script>\n<script>\n' + sim + '\n</script>');

fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dist/bowfall-duels.html'), head.trim() + '\n' + body.trim() + '\n');
console.log('Wrote dist/bowfall-duels.html');
