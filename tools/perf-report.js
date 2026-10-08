#!/usr/bin/env node
// Reads a recording saved with F9 in the game (bowfall-perf-*.json) and prints where the time goes:
//   node tools/perf-report.js bowfall-perf-2026-10-08-20-15.json
'use strict';
const fs = require('fs');
const d = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const cols = d.meta.columns, F = d.frames, col = k => cols.indexOf(k);
const q = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0; };
const avg = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const f1 = x => (Math.round(x * 100) / 100).toFixed(2);
console.log(`Bowfall ${d.meta.version} · ${d.meta.seconds}s · ${F.length} frames · ${d.meta.screen.join('x')} @${d.meta.dpr}x · effects ${d.meta.opts.fx}${d.meta.lightFx ? ' (light)' : ''} · ${d.meta.cores || '?'} cores`);
console.log(d.meta.ua);
const fm = F.map(r => r[1]);
console.log(`\nFrame time: median ${f1(q(fm, 0.5))}ms · 95% ${f1(q(fm, 0.95))} · 99% ${f1(q(fm, 0.99))} · worst ${f1(Math.max(...fm))} · frames over 33ms: ${fm.filter(x => x > 33).length}`);
const segs = ['sim', 'view', 'fx', 'arena', 'players', 'shots', 'particles', 'overlay', 'hud', 'msgMs'];
console.log('\nSection        avg ms   95%    99%    max   share of work');
const tot = avg(F.map(r => segs.reduce((s, k) => s + r[col(k)], 0)));
for (const k of segs) { const v = F.map(r => r[col(k)]); console.log(`${k.padEnd(12)} ${f1(avg(v)).padStart(7)} ${f1(q(v, 0.95)).padStart(6)} ${f1(q(v, 0.99)).padStart(6)} ${f1(Math.max(...v)).padStart(6)}   ${Math.round(avg(v) / Math.max(1e-9, tot) * 100)}%`); }
// what's different about the slowest frames
const slow = F.filter(r => r[1] > q(fm, 0.99)), norm = F.filter(r => r[1] <= q(fm, 0.5));
console.log('\nSlowest 1% of frames vs typical frames (averages):');
for (const k of segs.concat(['msgs', 'nPlayers', 'nArrows', 'nParticles', 'nZones'])) {
  const i = col(k); if (i < 0) continue;
  console.log(`  ${k.padEnd(10)} ${f1(avg(slow.map(r => r[i]))).padStart(8)}  vs ${f1(avg(norm.map(r => r[i])))}`);
}
const unexplained = slow.map(r => r[1] - segs.reduce((s, k) => s + r[col(k)], 0));
console.log(`  outside the game's own code (browser, GC, compositing): ${f1(avg(unexplained))}ms in slow frames`);
if (d.longTasks.length) console.log(`\nLong tasks (>50ms, Chrome): ${d.longTasks.length}, longest ${Math.max(...d.longTasks.map(x => x[1]))}ms`);
const heap = d.secs.map(s => s.heap).filter(x => x != null);
if (heap.length) console.log(`Memory: ${Math.min(...heap)}-${Math.max(...heap)}MB`);
const sv = d.secs.map(s => s.server).filter(Boolean);
if (sv.length) console.log(`Server: CPU avg ${Math.round(avg(sv.map(s => s.cpu)))}% (max ${Math.max(...sv.map(s => s.cpu))}), held back ${sv.reduce((a, s) => a + (s.thr || 0), 0)}ms total, tick lag max ${Math.max(...sv.map(s => s.lag || 0))}ms, step avg ${f1(avg(sv.map(s => s.step || 0)))}ms max ${Math.max(...sv.map(s => s.stepMax || 0))}ms`);
const ping = d.secs.map(s => s.ping).filter(x => x != null);
if (ping.length) console.log(`Ping: median ${q(ping, 0.5)}ms, worst ${Math.max(...ping)}ms`);
console.log(`FPS by second: ${d.secs.map(s => s.fps).join(' ')}`);
