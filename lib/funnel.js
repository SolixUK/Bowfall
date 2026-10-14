// The new-player funnel: how far each visitor gets, so we can see where people stop. Anonymous: a visitor is a hash of
// the random id their browser already holds for guest play (no names, emails, IPs or outside analytics). Each visitor
// keeps the day they first came, where they came from, the steps they've reached and the days they came back.
// The admin reads it at /api/funnel?html=1 (or JSON).
'use strict';
const STEPS = [
  ['open', 'Opened the game'], ['start', 'Started a game'], ['game1', 'Finished a game'], ['game3', 'Finished 3 games'],
  ['prompt', 'Asked to save progress'], ['signup', 'Made an account'], ['d1', 'Came back another day'], ['d7', 'Still playing a week on'], ['buy', 'Bought something'],
];
const KEYS = STEPS.map(s => s[0]);
const SOURCES = /^[a-z0-9_-]{1,24}$/;
const dayOf = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);
const dayNum = d => Math.floor(Date.parse(d + 'T00:00:00Z') / 86400000);

module.exports = function funnel(store) {
  const cache = new Map(), dirty = new Set();
  async function get(id) {
    let r = cache.get(id);
    if (!r) { r = (await store.funnelGet(id).catch(() => null)) || null; if (r) { cache.set(id, r); if (cache.size > 20000) cache.delete(cache.keys().next().value); } }
    return r;
  }
  // a visitor reached a step (only the first time counts); 'open' also notes the day, which makes d1 and d7
  async function record(id, step, src) {
    if (!id || !KEYS.includes(step)) return;
    const today = dayOf();
    let r = await get(id);
    if (!r) { if (step !== 'open' && step !== 'signup') return; r = { d: today, src: SOURCES.test(src || '') ? src : 'direct', s: {}, days: [] }; cache.set(id, r); }
    let changed = false;
    if (!(step in r.s)) { r.s[step] = dayNum(today) - dayNum(r.d); changed = true; }
    if (step === 'open' && !r.days.includes(today)) {
      r.days.push(today); if (r.days.length > 12) r.days.splice(1, 1); changed = true;
      const gap = dayNum(today) - dayNum(r.d);
      if (gap >= 1 && !('d1' in r.s)) r.s.d1 = gap;
      if (gap >= 7 && !('d7' in r.s)) r.s.d7 = gap;
    }
    if (changed) dirty.add(id);
  }
  async function flush() {
    const ids = [...dirty]; dirty.clear();
    for (const id of ids) { const r = cache.get(id); if (r) await store.funnelSave(id, r.d, r).catch(e => console.error('Funnel save:', e.message)); }
  }
  setInterval(() => flush().catch(() => {}), 10000).unref();
  // everyone who first came in the last `days` days, by first day and by source: how many reached each step
  async function report(days = 28, src = null) {
    await flush();
    const since = dayOf(Date.now() - (days - 1) * 86400000);
    const rows = (await store.funnelSince(since).catch(() => [])).filter(r => !src || r.src === src);
    const blank = () => Object.fromEntries(KEYS.map(k => [k, 0]));
    const byDay = {}, bySrc = {}, all = blank();
    for (const r of rows) {
      const d = byDay[r.d] || (byDay[r.d] = blank()), s = bySrc[r.src] || (bySrc[r.src] = blank());
      for (const k of KEYS) if (k in (r.s || {})) { d[k]++; s[k]++; all[k]++; }
    }
    return { since, days, src, steps: STEPS, all, byDay, bySrc, visitors: rows.length };
  }
  function html(R) {
    const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '–';
    const esc = x => String(x).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
    const head = '<tr><th></th>' + R.steps.map(([, l]) => `<th>${l}</th>`).join('') + '</tr>';
    const line = (name, c) => `<tr><th>${name}</th>` + KEYS.map((k, i) => `<td>${c[k]}${i ? `<small>${pct(c[k], c.open)}</small>` : ''}</td>`).join('') + '</tr>';
    // the funnel: one bar per step, as a share of everyone who opened the game (one series, one hue; hover for numbers)
    const W = 720, rowH = 30, lab = 190, bw = W - lab - 120;
    const funnelSvg = `<svg class="chart" viewBox="0 0 ${W} ${KEYS.length * rowH + 10}" role="img" aria-label="The funnel: how many reached each step">` + R.steps.map(([k, l], i) => {
      const n = R.all[k], f = R.all.open ? n / R.all.open : 0, w = Math.max(n ? 4 : 0, Math.round(bw * f)), y = 5 + i * rowH;
      return `<g><title>${esc(l)}: ${n} (${pct(n, R.all.open)} of everyone who opened it)${i ? `, ${pct(n, R.all[KEYS[i - 1]])} of the step before` : ''}</title><text x="${lab - 10}" y="${y + 19}" text-anchor="end" class="lab">${esc(l)}</text><rect x="${lab}" y="${y}" width="${bw}" height="${rowH - 8}" class="track"/>${w ? `<rect x="${lab}" y="${y}" width="${w}" height="${rowH - 8}" rx="4" class="bar"/>` : ''}<text x="${lab + w + 8}" y="${y + 17}" class="val">${n} · ${pct(n, R.all.open)}</text></g>`;
    }).join('') + '</svg>';
    // per day: a column chart of one measure (two separate charts, never two scales on one)
    const days = []; for (let t = Date.parse(R.since + 'T00:00:00Z'); t <= Date.now(); t += 86400000) days.push(new Date(t).toISOString().slice(0, 10));
    const daily = (k, title) => {
      const H = 150, top = 14, bot = 26, CW = 720, left = 36, n = days.length, step = (CW - left - 8) / n, vals = days.map(d => (R.byDay[d] || {})[k] || 0), max = Math.max(1, ...vals);
      const nice = Math.max(1, Math.ceil(max / 4)), ticks = [0, 1, 2, 3, 4].map(t => t * nice).filter(v => v <= Math.max(max, nice * 4));
      const yOf = v => top + (H - top - bot) * (1 - v / (nice * 4));
      return `<h3>${esc(title)}</h3><svg class="chart" viewBox="0 0 ${CW} ${H}" role="img" aria-label="${esc(title)} per day">` +
        ticks.map(v => `<line x1="${left}" x2="${CW - 4}" y1="${yOf(v)}" y2="${yOf(v)}" class="grid"/><text x="${left - 6}" y="${yOf(v) + 4}" text-anchor="end" class="ax">${v}</text>`).join('') +
        vals.map((v, i) => { const x = left + i * step + 1, h = yOf(0) - yOf(v), bwid = Math.max(2, step - 2); return `<g><title>${days[i]}: ${v}</title><rect x="${x}" y="${top}" width="${bwid}" height="${H - top - bot}" class="hit"/>${v ? `<rect x="${x}" y="${yOf(v)}" width="${bwid}" height="${h}" rx="${Math.min(4, bwid / 2)}" class="bar"/>` : ''}</g>`; }).join('') +
        days.map((d, i) => (i % Math.ceil(n / 7) === 0 || i === n - 1) ? `<text x="${left + i * step + step / 2}" y="${H - 8}" text-anchor="middle" class="ax">${d.slice(5)}</text>` : '').join('') + '</svg>';
    };
    return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bowfall funnel</title><style>
:root{--surface:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--grid:#e6e5e0;--series:#2a78d6;--track:#f0efea}
@media (prefers-color-scheme:dark){:root{--surface:#1a1a19;--ink:#f0efec;--ink2:#c3c2b7;--grid:#34332f;--series:#3987e5;--track:#262624}}
body{font:14px system-ui,sans-serif;margin:20px;color:var(--ink);background:var(--surface);max-width:1100px}a{color:var(--series)}
table{border-collapse:collapse;margin:8px 0 22px}td,th{padding:4px 10px;border-bottom:1px solid var(--grid);text-align:right;white-space:nowrap}th:first-child{text-align:left}td small{display:block;color:var(--ink2);font-size:11px}
h2{margin:22px 0 4px}h3{margin:14px 0 2px;font-size:14px;color:var(--ink2);font-weight:600}.wrap{overflow-x:auto}
.chart{width:100%;max-width:720px;height:auto;display:block}.chart .bar{fill:var(--series)}.chart .track{fill:var(--track)}.chart .hit{fill:transparent}.chart g:hover .bar{opacity:.8}
.chart .lab{fill:var(--ink);font-size:13px}.chart .val{fill:var(--ink2);font-size:12px}.chart .ax{fill:var(--ink2);font-size:11px}.chart .grid{stroke:var(--grid);stroke-width:1}
.pick a{margin-right:10px}</style>
<h1>New players, last ${R.days} days${R.src ? ` (from ${esc(R.src)})` : ''}</h1>
<p class="pick">Show: ${[7, 28, 90].map(d => `<a href="?html=1&days=${d}${R.src ? `&src=${encodeURIComponent(R.src)}` : ''}">${d} days</a>`).join('')}${R.src ? ` <a href="?html=1&days=${R.days}">all sources</a>` : ''}</p>
<p>${R.visitors} visitors first came since ${R.since}. Steps count once per visitor. "Came back another day" and "a week on" are still filling up for the newest days. Hover a bar for its numbers.</p>
<h2>The funnel</h2>${funnelSvg}
<h2>Per day</h2>${daily('open', 'New visitors')}${daily('game1', 'Finished their first game')}${daily('signup', 'Made an account')}
<h2>By where they came from</h2><div class="wrap"><table>${head}${Object.entries(R.bySrc).sort((a, b) => b[1].open - a[1].open).map(([s2, c]) => line(`<a href="?html=1&days=${R.days}&src=${encodeURIComponent(s2)}">${esc(s2)}</a>`, c)).join('')}</table></div>
<h2>By the day they first came</h2><div class="wrap"><table>${head}${line('Everyone', R.all)}${Object.entries(R.byDay).sort((a, b) => b[0].localeCompare(a[0])).map(([d, c]) => line(d, c)).join('')}</table></div>`;
  }
  return { STEPS, KEYS, record, report, html, flush };
};
