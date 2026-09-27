# Bowfall balance review, pass 2 (v0.17.2)

This pass checked the first pass's changes, worked its open items with measured experiments, re-learned the bots' card values under the final rules, and re-measured everything. All numbers come from Master bots playing Master bots (random element and role, random maps and sides, bots picking their own cards) on a separate copy of the game. Nothing in the project was touched. The final change set is `changes2.diff` (a diff of `public/sim.js` against the live file).

How to read the numbers: "win rate" is the share of games (battles) a player with that element or role won; 50% is even. Each experiment below is 500 matches (about 4,500 games) with one side's bot forced to the thing under test; uncertainty on those is about ±1 point, so differences under 2 points are noise. The final tables are 2,000 matches (1,500 1v1 + 500 2v2; 18,643 games); uncertainty about ±1.2 points per row in 1v1, ±1.5 in 2v2.

## Top findings

1. **Warden is weak for a structural reason bots can't fix by picking better cards.** Its opener made almost no difference (Gust 36.7%, Totem 36.9%, Shield Wall 37.9%), and in the same games its arrows land 12% of the time against the opponent's 20%: bots step or dash out of its shots and nothing in its kit stops them (cards that lock dashes, Static and Petrify, lift its hit rate to 18%). Knockback resistance alone did nothing (+0.2). What worked was a real close-range tool: a reworked Gust (wider, 35% harder shove, blows enemy arrows out of the air, 8s cooldown) and the bot using it defensively: +3 alone, +7 together with the knockback resistance (36.7% -> 43.6% forced 1v1). In the final random run the Warden is 38.8% in 1v1 (live: 27.5%) and 51.7% in 2v2 (live: 41.5%).
2. **Knockback beats healing.** As pass 1 found, more lifesteal did nothing for Blood. Making Blood arrows knock back harder the more health the archer has lost (up to +25% near death) gives +3. A speed burst after healing hits gave +1.7 (dropped).
3. **Void rifts on any fully drawn hit** (not only bullseyes): +3.3 even for bots, whose aim is near-perfect; humans bullseye far less and should gain more. Void is now 50% for bots.
4. **Trapper: knockback on held targets** (+30%), as pass 1 suggested: +5 in the forced test; 44.9% / 44.5% in the final run.
5. **Ranger trimmed** from 8% to 5% faster: 56.1% -> 52.0% (1v1), 59.8% -> 53.7% (2v2).
6. **Bots no longer take team-only cards when alone** (Guardian's Oath, Revive, Transfusion, Contagion). This alone moved the forced-1v1 Warden from ~31.5% to 36.7%.
7. **Card values re-learned** from 11,108 games of random picks under the final rules (was 7,800 under the old rules), now measured against the player's role *and* element (so Blood cards aren't all "bad" just because Blood is weak); Blood cards now have values. Examples of stale values: Mending Totem was +0 (now measured -3 points), Rally 0 (now -3), Shield Wall -2 (now +1).
8. **New watch item: Frost** slipped to 45% (was 48%) in the final run, now the weakest element; Ninja fell to 42.5% in 2v2 (was 50%). Neither was changed in this pass; both are most likely knock-on effects of the new card values changing what bots pick, plus noise. Worth measuring first thing next pass.

## Warden experiments (forced Warden, 1v1, 500 matches each)

| Variant | Warden game win rate |
|---|---|
| Pass-1 rules + bot team-only fix (this pass's baseline) | 36.7% ±1.1 |
| ... forced to open Totem instead of Gust | 36.9% ±1.2 |
| ... forced to open Shield Wall | 37.9% ±1.2 |
| + 17% less knockback (mass 1.2) | 36.9% ±0.9 |
| + Gust rework (wider, +35% shove, blows arrows away, 8s cd; bot also uses it on incoming arrows) | 39.8% ±0.9 |
| + both (shipped) | 43.6% ±1.0 |

## Other experiments (forced, 1v1, 500 matches each; "before" is pass 1's random-run figure)

| Change | Before | After |
|---|---|---|
| Trapper: hits on rooted/stuck/frozen enemies knock back 30% harder | 39.8% | 44.8% ±0.9 |
| Void: rifts open on any fully drawn hit | 44.5% | 47.8% ±0.9 |
| Blood: arrows knock back up to 25% harder as you lose health | 44.7% | 47.7% ±1.0 |
| Blood: 1s of +20% speed after every healing hit (not shipped) | 44.7% | 46.4% ±1.0 |
| Ranger: 8% -> 5% faster | 56.1% | 54.0% ±0.9 |

## Final tables: live game -> after pass 1 -> after pass 2 (games won, %)

Elements (1v1 / 2v2 / all):

| Element | Live 1v1 | P1 1v1 | **P2 1v1** | Live 2v2 | P1 2v2 | **P2 2v2** | Live all | P1 all | **P2 all** |
|---|---|---|---|---|---|---|---|---|---|
| Shadow | 53.2 | 54.8 | **53.9** | 51.6 | 53.6 | **50.2** | 52.6 | 54.3 | **52.5** |
| Stone | 53.8 | 51.1 | **52.6** | 49.1 | 52.2 | **50.9** | 52.0 | 51.5 | **51.9** |
| Storm | 52.0 | 52.8 | **53.1** | 52.7 | 52.8 | **50.0** | 52.3 | 52.8 | **51.9** |
| Flame | 51.8 | 53.5 | **48.9** | 54.5 | 54.2 | **53.5** | 52.8 | 53.8 | **50.9** |
| Poison | 49.7 | 51.0 | **48.9** | 50.4 | 49.7 | **52.1** | 50.0 | 50.5 | **50.3** |
| Void | 45.5 | 44.5 | **50.3** | 48.4 | 45.3 | **50.2** | 46.7 | 44.8 | **50.3** |
| Blood | 46.2 | 44.7 | **47.5** | 45.1 | 44.1 | **46.9** | 45.8 | 44.4 | **47.2** |
| Frost | 47.8 | 48.4 | **44.9** | 49.2 | 51.2 | **45.7** | 48.4 | 49.5 | **45.2** |

Roles:

| Role | Live 1v1 | P1 1v1 | **P2 1v1** | Live 2v2 | P1 2v2 | **P2 2v2** | Live all | P1 all | **P2 all** |
|---|---|---|---|---|---|---|---|---|---|
| Sniper | 54.2 | 55.0 | **57.3** | 49.8 | 50.6 | **55.4** | 52.4 | 53.4 | **56.5** |
| Assassin | 61.5 | 56.4 | **55.2** | 59.7 | 48.6 | **50.7** | 60.7 | 53.1 | **53.6** |
| Ranger | 54.2 | 56.1 | **52.0** | 56.3 | 59.8 | **53.7** | 55.1 | 57.6 | **52.6** |
| Trickster | 48.9 | 50.5 | **48.7** | 55.2 | 54.5 | **59.2** | 51.2 | 52.2 | **52.6** |
| Crossbowman | 56.8 | 53.7 | **56.1** | 47.8 | 51.0 | **46.6** | 52.6 | 52.6 | **52.4** |
| Ninja | 61.0 | 57.0 | **52.1** | 50.3 | 50.2 | **42.5** | 56.2 | 54.3 | **48.0** |
| Juggernaut | 49.1 | 49.6 | **46.2** | 49.2 | 46.2 | **46.0** | 49.1 | 48.1 | **46.2** |
| Trapper | 37.4 | 39.8 | **44.9** | 44.3 | 45.0 | **44.5** | 40.3 | 41.7 | **44.7** |
| Warden | 27.5 | 31.5 | **38.8** | 41.5 | 43.8 | **51.7** | 33.5 | 36.7 | **44.3** |

Spread of roles: live 27.5–61.5 (34 points); after pass 2, 38.8–57.3 in 1v1 and 42.5–59.2 in 2v2. Elements: live 45.5–53.8; now 44.9–53.9 in 1v1, 45.7–53.5 in 2v2. Sniper (57%) is now the top role and a candidate for a small trim next pass; Frost and Ninja-in-2v2 are the new low ends to check.

## Every change in changes2.diff, with reason and measured effect

Kept from pass 1 (justified by its measurements):
1. Parry riposte: only the next shot is instant and +30%; then 3s of double-speed draws, +20% speed, half the cooldown back. Fixes the click-spam exploit (22 full shots in 3s -> 1).
2. Assassin: 10 less health, Blink cooldown 6 -> 8s (60.7% -> ~53–54%).
3. Ninja: blink recharge 1.5 -> 1.65s, shuriken gap 0.34 -> 0.36s.
4. Warden: Mender 3/s after 3s (was 2/s after 4s), no longer 5% slower, +10 health, Rally and Bond also cover the Warden, Oath self-penalty 10% -> 5%.
5. Trapper: abilities recharge 40% faster (was 30%), +25% damage on held targets (was 15%), Harpoon holds 0.9s / 6 damage (was 0.5s / 4), Bramble Trap roots 2.5s (was 2.2).
6. Fleet Foot: 15% -> 10% faster.
7. Railshot cooldown 11 -> 10s, and the bot aim fix for an armed Railshot (bots led it as a normal arrow).
8. Blood Pact costs 10 health instead of 15 (cheap fix for a trade card that measured -10).

Dropped from pass 1:
- Blood lifesteal 25% -> 35%, Blood Pact 45% -> 55%, Hemorrhage 8 -> 10 damage. Pass 1 itself measured no effect from more healing; the knockback hook below does the job, so this unmeasured number churn was removed (descriptions restored).
- Void rift slow 30% -> 40%. Pass 1 measured no effect from stronger slow/pull/size; reverted and the full-draw trigger added instead. A 40% slow inside a pull would also be harsher on humans than on bots.

New in pass 2:
9. Warden: about 17% less knockback from everything (mass 1.2; the Juggernaut is 1.25). Alone: +0.2 (noise). With the Gust rework the pair measured +7.
10. Gust: cone half-angle 0.62 -> 0.7 rad, reach 230 -> 250px, shove 35% harder, cooldown 9 -> 8s, and it blows enemy arrows in the cone out of the air (shown with the existing "blocked" effect). Bots also use it to blow away an arrow about to hit them. Alone: +3.
11. Trapper trait: hits on held targets also knock back 30% harder. +5.
12. Blood Arrows: knockback grows with health lost, up to +25% near death. +3.
13. Void Arrows: a rift opens on any fully drawn hit, not only bullseyes. +3.3.
14. Ranger: 8% -> 5% faster. -2 (forced), -4 in the final run.
15. Bots: with no teammate, team-only cards (Guardian's Oath, Revive, Transfusion, Contagion) score below everything else in `botPickIndex` (it now takes the world as a second argument; the three call sites were updated). Humans are still offered them; hiding them from the offer in 1v1 would be a rules change for players and was left alone.
16. `CARD_VALUE` re-learned: 111 cards, 11,108 games (5,377 in 1v1), baseline per role+element, shrunk toward 0 for cards with little data (minimum 45 samples). The comment above it says so.

Descriptions updated in `sim.js`: Ranger, Warden and Trapper traits, Blood Arrows, Hemorrhage, Blood Pact, Void Arrows, Gust, Rally, Bond, Guardian's Oath, Fleet Foot, Parry, Blink, Railshot, Bramble Trap, Backstab. Not updated (outside sim.js): the role table in `README.md` (still says Mender 2/s after 4s, 5% slower), and the Gust cone drawn by `index.html` (drawn at the old 0.62 half-angle; cosmetic).

## What bots can't measure

- The Warden's low hit rate is bot-vs-bot: Master bots dodge its plain arrows because nothing in its kit stops them dashing. Human opponents dodge far less, so a human Warden with 110 hp, knockback resistance and an arrow-blowing Gust should sit closer to even than the 39% the bots show. The new Gust (a 250px arrow shield on an 8s cooldown) is a reaction tool humans will use far better than the bot's simple trigger.
- Void's full-draw rifts: bots bullseye most of the time, so +3 is a floor; humans should gain more. Watch for Void going over 50% with good players.
- Blood's wounded knockback: bots don't play around health totals; a human who knows their arrows throw harder at low health may take fights bots would not.
- Parry, Hair Trigger and Gust-vs-arrows are reaction tools; Assassin backstabs, stealth and Shadow's blinding are all bot-rated, as in pass 1.
- Card values are bot values (e.g. Fleet Foot's sharp turning is worth more to humans than its +0.049).

## Bugs and oddities found

- Bots picked team-only cards in 1v1 (fixed).
- The Warden bot lands ~40% fewer shots than other bow roles in the same matchups. Not a stats bug (in Warden-vs-Warden mirrors both sit at 12%), and not the opener; a structural bot-play weakness I could not pin to one line in the time available. Worth a look in the bot's positioning/charge code later.
- The client shows "Full auto: hold to fire" for any `parried` event with `au: 1`; the new Gust therefore emits `blocked` instead.
- Frost fell to 45% and Ninja to 42.5% in 2v2 in the final run without any rule change to either; likely bot-pick knock-on from the new card values plus noise, but unverified.

## Unit tests

Run against the copy with pass 1's adjusted test file (`work2/uptest3.js`; pass 1 had already updated the Mender, Rally and Totem expectations for its Warden changes; I restored the Blood 25% lifesteal check since that change was dropped). 198 checks. Failures: "Arrow speed options shifted up" and "Shuriken: full damage up close, much less at range", both of which also fail on the live, unmodified file; and one flaky random-bot check ("Crossbow bots shoot and play without errors", 5 shots vs >5 needed) that passed in the other run of the same code (32 shots). The known-flaky "Parry pressed ... after a hit" checks passed. An earlier run with the unmodified original test file showed the two expected Warden differences (Rally now also speeds up the Warden; Totem heals 11/s with the faster Mender), which pass 1's adjusted file accounts for.

## Work files

`the review workspace (`work2/`)`: `mkvar.js` (builds rule variants), `exps*.sh` (experiment batches and logs), `run.js` / `fan.js` / `an.js` / `diag.js` (runner and analysis, from pass 1), `learn2.js` (card learning; output `cardval.json`, `cardn.json`, `learn.log`, raw games `learn*_?.json`), `setcv.js` (writes the values into sim.js), `final_*.jsonl` (final measurement), `uptest2.js` / `uptest3.js` and their `_out.txt` (unit tests against the copy), `exp_*.jsonl` (experiment logs).
