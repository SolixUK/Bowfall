// The owner's /profile command: records what the server's CPU is spent on for a while (V8's sampling profiler), with
// garbage collection and Render's throttling second by second, then sums it up: the busiest functions overall, and
// what was running in the seconds the server was held back. The full profile can be downloaded and opened in Chrome's
// DevTools (Performance tab → Load profile) for the complete picture.
'use strict';
const inspector = require('inspector');
const { PerformanceObserver } = require('perf_hooks');

module.exports = function createProfiler() {
  const P = { running: false, result: null, raw: null, secs: [], gcs: [], session: null, obs: null };
  const nowUs = () => Number(process.hrtime.bigint() / 1000n);
  // called once a second by the server with that second's numbers (throttled ms, CPU %, game step times)
  P.second = s => { if (P.running) P.secs.push(Object.assign({ at: nowUs() }, s)); };
  P.start = (seconds, done) => {
    if (P.running) return false;
    P.running = true; P.secs = []; P.gcs = []; P.startedAt = Date.now(); P.seconds = seconds;
    const s = P.session = new inspector.Session(); s.connect();
    try { P.obs = new PerformanceObserver(l => { for (const e of l.getEntries()) P.gcs.push([Math.round((performance.timeOrigin + e.startTime) * 1000), e.duration, e.detail ? e.detail.kind : e.kind]); }); P.obs.observe({ entryTypes: ['gc'] }); } catch (e) { P.obs = null; }
    s.post('Profiler.enable', () => s.post('Profiler.setSamplingInterval', { interval: 1000 }, () => s.post('Profiler.start', () => {
      setTimeout(() => s.post('Profiler.stop', (err, r) => {
        P.running = false; try { P.obs && P.obs.disconnect(); } catch (e) {} try { s.disconnect(); } catch (e) {}
        if (err || !r) { P.result = { error: String(err && err.message || 'no profile') }; return done && done(P.result); }
        P.raw = r.profile; P.result = summarise(r.profile, P.secs, P.gcs, P.startedAt, seconds);
        done && done(P.result);
      }), seconds * 1000).unref();
    })));
    return true;
  };
  return P;
};

function summarise(prof, secs, gcs, startedAt, seconds) {
  const byId = new Map(prof.nodes.map(n => [n.id, n])), parent = new Map();
  for (const n of prof.nodes) for (const c of n.children || []) parent.set(c, n.id);
  const name = n => { const f = n.callFrame, file = (f.url || '').split('/').pop(); return `${f.functionName || '(anonymous)'}${file ? ` ${file}:${f.lineNumber + 1}` : ''}`; };
  const times = []; let t = prof.startTime;
  prof.samples.forEach((id, i) => { t += prof.timeDeltas[i]; times.push(t); });
  const tally = (from, to) => {
    const self = new Map(), incl = new Map(); let n = 0;
    prof.samples.forEach((id, i) => {
      const at = times[i]; if (at < from || at > to) return;
      const node = byId.get(id), k = name(node); if (k.startsWith('(idle)') || k.startsWith('(program)')) return;
      n++; self.set(k, (self.get(k) || 0) + 1);
      const seen = new Set(); for (let x = id; x != null; x = parent.get(x)) { const kk = name(byId.get(x)); if (!seen.has(kk)) { seen.add(kk); incl.set(kk, (incl.get(kk) || 0) + 1); } }
    });
    const top = (m, k) => [...m].filter(([kk]) => !/^\(root\)|^\(anonymous\)$/.test(kk)).sort((a, b) => b[1] - a[1]).slice(0, k).map(([kk, v]) => ({ fn: kk, ms: v, pct: Math.round(v / Math.max(1, n) * 1000) / 10 }));
    return { busyMs: n, self: top(self, 25), incl: top(incl, 25) };
  };
  const all = tally(-Infinity, Infinity);
  const gcMs = gcs.reduce((s, g) => s + g[1], 0);
  // the seconds Render held the server back, and what it was doing in them
  const hot = secs.filter(s => (s.thr || 0) > 0).map(s => Object.assign({ second: Math.round((s.at - prof.startTime) / 1e6), thr: s.thr, cpu: s.cpu, stepMax: s.stepMax, send: s.send },
    { gcMs: Math.round(gcs.filter(g => g[0] >= s.at - 1e6 && g[0] <= s.at).reduce((a, g) => a + g[1], 0)) }, { top: tally(s.at - 1e6, s.at).self.slice(0, 8) }));
  return { started: new Date(startedAt).toISOString(), seconds, busyMs: all.busyMs, gc: { count: gcs.length, ms: Math.round(gcMs), longest: Math.round(Math.max(0, ...gcs.map(g => g[1]))) },
    heldBackMs: secs.reduce((s, x) => s + (x.thr || 0), 0), self: all.self, incl: all.incl, hotSeconds: hot };
}
