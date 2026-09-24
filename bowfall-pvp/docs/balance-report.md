# Balance report: 4v4 bot simulations

Hard bots, 4v4, rotating through all four arenas, 600 matches per run (about 9,000 games and 75,000 archer-games each). Bots take a role their team lacks and a random element, and pick upgrades by their usual rules.

**How to read it.** "Effect" comes from a team-level logistic regression: the change in a team's chance of winning a game from one more archer with that element, role or card, with everything else on both teams held equal. Elements and roles are relative to the average; cards are relative to the same archer without the card. "±" is the 95% range from bootstrapping. Anything within about ±2% is close enough to call balanced for bots.

**Caveat.** Bots are not people. Cards that need timing or positioning (Battering Ram, Bramble Coat, Featherweight, Fleet Foot) are probably undervalued here. Cards that reward perfect tracking (Curve Shot, Split Arrow) are probably overvalued, because bots aim and track perfectly. Treat these as a first pass and confirm with the Balance data from real games.

## Elements

| Element | Win % before | Win % after | Effect before | Effect after |
| --- | --- | --- | --- | --- |
| Flame | 55.6% | 52.5% | +5.8% ± 1.0 | +2.4% ± 1.1 |
| Poison | 50.4% | 51.8% | -0.2% ± 1.0 | +1.8% ± 0.9 |
| Storm | 48.5% | 49.0% | -1.8% ± 1.1 | -1.8% ± 0.9 |
| Frost | 45.1% | 47.1% | -3.7% ± 1.1 | -2.4% ± 0.9 |

## Roles

| Role | Win % before | Win % after | Effect before | Effect after |
| --- | --- | --- | --- | --- |
| Juggernaut | 50.5% | 50.3% | +3.1% ± 2.1 | +2.3% ± 2.1 |
| Warden | 49.9% | 49.7% | +1.9% ± 2.6 | -0.0% ± 2.2 |
| Ranger | 49.5% | 49.7% | +0.2% ± 2.0 | +1.0% ± 1.7 |
| Sniper | 48.9% | 49.6% | -0.7% ± 2.1 | -0.8% ± 2.1 |
| Trickster | 52.9% | 51.5% | -1.1% ± 1.8 | -1.8% ± 2.3 |
| Trapper | 48.4% | 49.2% | -3.4% ± 2.9 | -0.6% ± 2.7 |

## Upgrades that moved (or still stand out)

| Card | Effect before | Effect after |
| --- | --- | --- |
| Split Arrow | +11.0% ± 1.9 | +7.0% ± 2.1 |
| Scattershot | +8.6% ± 2.1 | +2.9% ± 2.3 |
| Curve Shot | +6.5% ± 2.5 | +4.9% ± 2.0 |
| Ricochet | +5.3% ± 2.4 | +3.8% ± 2.3 |
| Inferno | +4.1% ± 2.1 | +3.7% ± 1.8 |
| Contagion | +4.5% ± 2.4 | +1.8% ± 1.8 |
| Earthshaker | -4.9% ± 3.9 | -2.8% ± 3.0 |
| Battering Ram | -3.7% ± 2.2 | -1.5% ± 2.2 |
| Glass Cannon | -5.5% ± 2.5 | +0.7% ± 2.8 |
| Potent Toxin | -3.0% ± 1.9 | +0.4% ± 1.9 |
| Bramble Coat | -3.8% ± 2.1 | +0.4% ± 2.7 |
| Permafrost | -2.2% ± 2.1 | -0.5% ± 1.8 |
| Guardian's Oath | -2.5% ± 2.4 | -4.4% ± 2.2 |
| Featherweight | -2.4% ± 2.3 | -4.7% ± 2.1 |
| Deep Freeze | -1.6% ± 4.8 | -5.6% ± 4.0 |

## Changes made

| Area | Change | Why |
| --- | --- | --- |
| Flame | Burn 4s at 6/s → 2.5s at 5/s; Inferno 6s at 8/s → 5s at 6/s | Burning was the most common way out and flame won most |
| Frost | Slow lasts 3s (was 2.5s); frost arrows deal 30% more to slowed or frozen targets | Fewest knockouts and lowest win rate |
| Permafrost | Slow 70% (was 65%); draw penalty 5% (was 12%) | Cost outweighed the gain |
| Contagion | Spreads every 1.5s (was 1s) | Strong in crowded 4v4 fights |
| Potent Toxin | Poison +50% (was +40%); arrow damage −15% (was −30%) | Cost outweighed the gain |
| Split Arrow | Pieces deal 40% damage, 45% knockback (was 60% and 60%) | Strongest card by far |
| Scattershot | Arrows deal 40% damage, 45% knockback (was 60% and 60%) | Second strongest card |
| Curve Shot | Bends at 1.1 rad/s (was 1.7) | Strong, and bots used it as homing |
| Juggernaut | +20 health (was +30); 13% less knockback taken (was 20%) | Strongest role |
| Trapper | No health penalty (was −10); abilities recharge 30% faster (was 20%) | Weakest role |
| Earthshaker | 10 damage (was 6), 200px reach (was 175) | Weak capstone |
| Battering Ram | Dash-shove does 14 damage (was 10) | Weak |
| Glass Cannon | −10 health (was −25) | Cost outweighed the gain |
| Guardian's Oath | You take 10% more (was 15%) | Cost outweighed the gain |
| Bramble Coat | Roots 1.4s (was 1s); 5% slower (was 10%) | Weak |

## Still worth watching

- Flame is still a little ahead and frost a little behind. That's close enough that real games should decide the next step.
- Split Arrow and Curve Shot still come out strong. They reward perfect tracking, which bots have, so check them against human data before cutting further.
- Featherweight, Deep Freeze and Guardian's Oath came out weak in the last run, but their ranges are wide. Deep Freeze was held rarely, because it needs Frostbite first.
- Games between hard bots are short (about 18–21 seconds for 4v4) and none went to time. Human games will run longer, which favours healing, poison and area control more than these numbers show.
- Arenas are fair: the red side wins 48–52% on all four.

Re-run with `npm run simulate -- 300 4`, then open Balance data and filter to Simulated, or run `python3 tools/analyse.py` for this full report (it needs numpy and scikit-learn).

## Second pass: Juggernaut rework and bot playstyles

Changes tested: the Juggernaut trait now regenerates (2 health a second after 4 seconds unhurt), deals 20% less arrow damage and knocks back 20% harder. There are two new Juggernaut cards, Riot Shield and Deflect. Frost now shortens dashes, and clouds from hits land where the target ends up. Plague is bigger, and amber gives an instant boost instead of paying for rerolls. Bots now have playstyles. Deflect was first tested at 1.5s with a 9s cooldown and full-power returns (+9.2%, too strong); it's now 1s, 12s and 70%. Curve Shot bends 0.9 rad/s for 0.9s, and Frostbite's window is 6s.

| | Effect (600 matches, 4v4) |
| --- | --- |
| Flame | +2.0% ± 0.8 |
| Poison | +0.5% ± 0.7 |
| Storm | -0.7% ± 0.7 |
| Frost | -1.8% ± 0.8 |
| Juggernaut | +2.2% ± 3.3 |
| Ranger | +1.6% ± 2.9 |
| Sniper | +0.3% ± 2.7 |
| Warden | -1.3% ± 2.6 |
| Trickster | -1.3% ± 2.9 |
| Trapper | -1.5% ± 2.5 |
| Riot | +4.0% ± 1.9 |
| Deflect | +4.7% ± 2.8 |
| Curve | +6.0% ± 2.1 |
| Split | +5.3% ± 2.2 |
| Scatter | +6.3% ± 2.4 |
| Ram | -2.3% ± 2.3 |

Every element and role is now within its margin. Riot Shield and Deflect come out a little strong (+4–5%), and the Trickster cards are still strong for bots, which track perfectly with Curve Shot. Watch all of these in real games.

## Third pass: Stone, Void, Assassin and capture powerups

New content tested in 4v4 bot matches (1,800 matches over three runs, final run shown). Tuning along the way:

- Void rifts: radius 110 (was 95), 1.8s (was 1.5s), stronger pull, and 30% slow inside.
- Flame base burn: 2s (was 2.5s).
- Poison: 1.8 damage per stack per second (was 2).
- Assassin: no health penalty, and 15% faster while stealthed.
- Death Mark: 30% for 5s (was 25% for 4s).
- Cloak and Dagger: costs 10 health (was 20).
- After the final run: Unstable Rift and Obsidian penalties halved to 8%. This last change hasn't been simulated.

| | Effect (final run, 600 matches) |
| --- | --- |
| Poison | +3.2% ± 0.9 |
| Flame | +2.6% ± 0.9 |
| Storm | -0.7% ± 0.9 |
| Frost | -1.0% ± 1.0 |
| Stone | -1.2% ± 1.0 |
| Void | -2.9% ± 0.8 |
| Juggernaut | +3.0% ± 2.6 |
| Sniper | +2.5% ± 3.0 |
| Trapper | +0.1% ± 2.5 |
| Warden | -0.0% ± 3.1 |
| Ranger | -1.0% ± 2.6 |
| Assassin | -1.7% ± 3.2 |
| Trickster | -2.9% ± 2.5 |
| Stealth | -1.8% ± 3.1 |
| Deathmark | -0.9% ± 2.9 |
| Cloak | -4.1% ± 2.5 |
| Collapse | +4.6% ± 4.0 |
| Unstable | -6.5% ± 3.0 |
| Obsidian | -4.8% ± 3.8 |

With six elements the spread is about ±3%, roughly 47–53% win rates. Poison and Flame sit at the top and Void at the bottom; watch those three in real games. Bots don't get full value from stealth or from positioning rifts, so human Assassin and Void players may do better than these numbers.

## Fourth pass: Ninja, Shadow and the new abilities

Four runs of 600 4v4 hard-bot matches (about 9,600 games each). Second-pick abilities were removed before the first run.

Changes along the way:

- **Ninja:** shuriken 7 damage (was 4.5), 400 knockback (was 300), thrown every 0.36s (was 0.45s); 10 less health (was 15) and 10% more knockback taken (was 15%). Shadow Strike: +75% damage on the next 3 shuriken (was double).
- **Juggernaut:** 15 more health (was 20), 7% less knockback taken (was 13%). Colossus: +30 health (was 40), 35% less knockback (was 40%), dashes 40% harder for +6 (was 60% / +8). Deflect: cooldown 14s (was 12s), reflects 60% (was 70%). Bull Rush: 9 damage and a smaller shove.
- **Elements:** Void rifts 120px (was 110), 2s (was 1.8s), stronger pull. Flame burn 4.5/s (was 5). Poison 1.6 per stack per second (was 1.8).
- **Night Terror:** now "enemies you shroud take 25% more damage from your whole team", because shrouds only come from bullseyes.
- **Weaker cards buffed:** Second Wind (40% faster for 4s, 11s cooldown), Recoil Shot (+60% knockback), Switcheroo (9s, target stuck 0.6s), Boomerang (6s, +25% damage), Harpoon (9s, stronger yank), Fortify (11s), Rally (15%).
- **Stronger cards trimmed:** Seeker Arrow (gentler curve, 12s), Spotter's Mark (5s).

| | Final run win rate | Regression |
| --- | --- | --- |
| Flame | 52.0% | +2.5% ± 1.0 |
| Poison | 50.8% | |
| Storm | 49.9% | |
| Shadow | 49.8% | |
| Stone | 49.4% | |
| Frost | 49.1% | |
| Void | 48.8% | |
| Juggernaut | 52.7% | +4.0% ± 3.6 |
| Ninja | 49.4% (was 46.6%) | −5.5% ± 3.4 (its abilities add back about +3%) |
| Others | 49.1–50.3% | within margin |

Every element and role is now between 48.8% and 52.7%. Still worth watching: Colossus (about +6% in every run), Flame (+2.5%), and Juggernaut overall. Several of the new ability cards swing by ±4% between runs, which is noise at this sample size; bots also play Switcheroo, Boomerang and Shadow Clone less cleverly than people will.
