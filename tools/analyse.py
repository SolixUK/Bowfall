# Balance report from recorded games (needs Python 3 with numpy and scikit-learn).
# Usage: python3 tools/analyse.py [data/games.jsonl ...]
import json, sys, glob, math, collections
import numpy as np
from sklearn.linear_model import LogisticRegression

files = sys.argv[1:] or ['data/games.jsonl']
games = []
for f in files:
    for line in open(f):
        line = line.strip()
        if not line: continue
        r = json.loads(line)
        if r.get('type') == 'game': games.append(r)
rows = [dict(p, g=g) for g in games for p in g['p']]
print(f'{len(games)} games, {len(rows)} archer-games, {len(set(g["mid"] for g in games))} matches')

def ci(p, n): return 1.96 * math.sqrt(max(p * (1 - p), 1e-4) / n) if n else 0
def table(title, key, rows, min_n=30):
    grp = collections.defaultdict(list)
    for r in rows:
        k = key(r)
        if k is not None: grp[k].append(r)
    print(f'\n== {title}')
    print(f'{"":24s} {"n":>6s} {"win%":>6s} {"±":>4s} {"KO/g":>6s} {"dmg/g":>6s} {"tak/g":>6s} {"surv":>5s} {"acc":>5s} {"ring/g":>6s} {"emp":>5s}')
    out = []
    for k, L in grp.items():
        n = len(L); w = sum(x['w'] for x in L) / n; sh = sum(x['sh'] for x in L)
        out.append((w, k, n, sum(x['k'] for x in L)/n, sum(x['dmg'] for x in L)/n, sum(x['tk'] for x in L)/n, sum(x['s'] for x in L)/n,
                    (sum(x['hi'] for x in L)/sh) if sh else 0, sum(x['ring'] for x in L)/n, sum(x['e'] for x in L)/n))
    for w, k, n, ko, dmg, tk, s, acc, ring, e in sorted(out, reverse=True):
        if n < min_n: continue
        print(f'{str(k):24s} {n:6d} {w*100:6.1f} {ci(w,n)*100:4.1f} {ko:6.2f} {dmg:6.0f} {tk:6.0f} {s*100:5.0f} {acc*100:5.0f} {ring:6.2f} {e*100:5.1f}')

table('Elements', lambda r: r['el'], rows)
table('Roles', lambda r: r['ro'], rows)
table('Archetypes', lambda r: r['el'] + ' ' + r['ro'], rows, 60)

# team-level logistic regression: red win ~ (red count - blue count) of each feature
feats = sorted({'el:' + r['el'] for r in rows} | {'ro:' + r['ro'] for r in rows} | {'up:' + u for r in rows for u in r['up']})
idx = {f: i for i, f in enumerate(feats)}
X, y = [], []
for g in games:
    if g['win'] not in ('red', 'blue'): continue
    v = np.zeros(len(feats))
    for p in g['p']:
        s = 1 if p['tm'] == 'red' else -1
        v[idx['el:' + p['el']]] += s; v[idx['ro:' + p['ro']]] += s
        for u in p['up']: v[idx['up:' + u]] += s
    X.append(v); y.append(1 if g['win'] == 'red' else 0)
X, y = np.array(X), np.array(y)
m = LogisticRegression(C=0.5, fit_intercept=True, max_iter=2000).fit(X, y)
coef = dict(zip(feats, m.coef_[0]))
# bootstrap for uncertainty
rng = np.random.default_rng(1); boots = []
for _ in range(60):
    ii = rng.integers(0, len(y), len(y))
    boots.append(LogisticRegression(C=0.5, max_iter=2000).fit(X[ii], y[ii]).coef_[0])
sd = dict(zip(feats, np.std(boots, axis=0)))
counts = collections.Counter()
for r in rows:
    counts['el:' + r['el']] += 1; counts['ro:' + r['ro']] += 1
    for u in r['up']: counts['up:' + u] += 1
print(f'\nred side win rate: {y.mean()*100:.1f}% over {len(y)} decided games (intercept {m.intercept_[0]:+.3f})')
def show(prefix, title):
    fs = [f for f in feats if f.startswith(prefix)]
    mean = np.mean([coef[f] for f in fs]) if prefix != 'up:' else 0
    print(f'\n== Regression: {title} (win-chance shift per extra archer, relative to the {"average" if prefix != "up:" else "same archer without it"})')
    for f in sorted(fs, key=lambda f: coef[f] - mean, reverse=True):
        c = coef[f] - mean
        # logistic slope at p=0.5 is 0.25 per unit
        flag = ' <<' if abs(c) > 2 * sd[f] and abs(c) * 25 >= 2 else ''
        print(f'{f[3:]:14s} {c*25:+6.1f}% ± {2*sd[f]*25:4.1f}  (held {counts[f]}){flag}')
show('el:', 'elements'); show('ro:', 'roles'); show('up:', 'upgrades')

# arenas
print('\n== Arenas')
by = collections.defaultdict(list)
for g in games: by[g['map']].append(g)
for k, gs in by.items():
    n = len(gs); causes = collections.Counter(p['how'] for g in gs for p in g['p'] if p['how'])
    tot = sum(causes.values())
    print(f'{k:8s} games {n:5d}  avg {sum(g["dur"] for g in gs)/n:5.1f}s  timeouts {sum(g["to"] for g in gs)/n*100:4.1f}%  red wins {sum(g["win"]=="red" for g in gs)/n*100:4.1f}%  | ' +
          ', '.join(f'{c} {v/tot*100:.0f}%' for c, v in causes.most_common(6)))
allc = collections.Counter(p['how'] for g in games for p in g['p'] if p['how']); tot = sum(allc.values())
print('\n== Ways out overall: ' + ', '.join(f'{c} {v/tot*100:.1f}%' for c, v in allc.most_common(14)))
# empowerment
emp = [r for r in rows if r['e']]
print(f'\n== Empowered in {len(emp)/len(rows)*100:.1f}% of archer-games; by element: ' +
      ', '.join(f"{e} {sum(1 for r in rows if r['el']==e and r['e'])/max(1,sum(1 for r in rows if r['el']==e))*100:.1f}%" for e in sorted({r['el'] for r in rows})))
