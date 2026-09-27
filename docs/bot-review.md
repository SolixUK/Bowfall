# Bowfall bots: how human they feel, and whether the difficulty levels are honest

Read-only review of the bot code in `public/sim.js` (DIFF, skillParams, botThink, botPlan, botAbilities, botPickIndex, pickStyle/STYLES) and of matchmaking's AI players (`lib/social.js`, `lib/ai-chat.js`, `lib/ai-players.json`), plus two small headless experiments (about 60 short 1v1 matches). Nothing in the game folder was changed.

## The short version

- The bots are **competent but mechanical**. Every level uses the same brain with the numbers turned up or down: the same movement loop, the same ability rules, the same card picks, the same perfect hazard avoidance. What changes between Easy and Extreme is mostly reflexes (aim scatter, reaction delay, turn speed, dodge-dash chance) and, oddly, walking speed. Master adds a genuinely smarter positioning brain.
- The biggest "it's a bot" tells are: everyone (Easy included) **sidesteps arrows with perfect timing**; movement is a **constant full-speed orbit with metronome direction flips**; aim **turns at a fixed speed and never overshoots**; **abilities fire the instant a rule is true**; **cards are chosen the instant the pick screen opens**; and bots **never fall for clones, never panic, never tilt**.
- **Easy is both too hard and too silly.** It moves at 75% speed and misses a standing target 79% of the time (a drunk shooter), yet it dodges arrows, avoids pits and uses abilities as well as Extreme. New players lose to *how* it plays and are then confused by *how badly* it aims. Humans miss because of leading and panic, not because their hands shake.
- **Master is too good in the wrong way.** Its aim scatter is under 1 degree (a standing target is unmissable at any range), and it fires the moment the aim falls inside a cone that guarantees a hit. Top humans win with positioning, baiting and patience, which Master partly has (botPlan), not with machine aim.
- **Matchmaking AI players lose their personality before the match starts.** `seatAI` sets their aggression and playstyle, then `resetMatch` calls `pickStyle` on every bot and rolls a fresh random mood, throwing the personality away. Beyond that, skill only changes reflexes, so a "cautious 1500 marksman" and an "aggressive 900 brawler" differ only in how well they aim.
- A handful of bugs (below), the most important being the personality overwrite and the skill cliff at 0.78 where the "smart brain" snaps on.

## What the experiments showed

Mirror matches (level vs same level, 1v1, random maps, 30 games per level), then each level vs a "training dummy" bot that barely moves and can't aim (9 games per level, Meadow):

| Level | Accuracy vs same level | Accuracy vs standing dummy | Shots per minute | Deaths to hazards per game (mirror) | Game length (mirror) |
|---|---|---|---|---|---|
| Easy | 22% | **21%** | 39 | 30% | 24 s |
| Normal | 33% | 36% | 40 | 30% | 16 s |
| Hard | 35% | 53% | 45 | 33% | 15 s |
| Extreme | 32% | 71% | 45 | 40% | 14 s |
| Master | 17% | 71% | 53 | **10%** | 28 s |

And against Master: Easy hit 3% of its shots and lost every game in about 8 seconds; Normal 6%, every game lost; Hard 15%, won 20%; Extreme 18%, won 27%.

What this says:

1. **Easy can't hit a stationary target.** 21% against a target that doesn't move is far worse than any new human player with a mouse. The error model (a flat random angle of up to 16 degrees) is the wrong shape. Real beginners hit still targets and miss moving ones.
2. **Hazard deaths don't drop with skill until Master.** Easy through Extreme die to pits and lava at the same 30-40% rate, because their hazard *walking* avoidance is identical and perfect, but their *knockback* awareness is identically absent (only Master's botPlan thinks about where a hit would shove it). Humans learn "don't stand with your back to a pit" long before they learn to snipe. That skill should arrive around Normal/Hard, not Master.
3. **Everyone shoots fast.** Easy fires 39 shots a minute, a shot every 1.5 s, almost as often as Master. Beginners draw slowly, hold too long and shoot maybe half as often.
4. **Games are very short** (14-28 s at the top). Fine for bots, but it means every mistake a bot makes is one hit from fatal, which makes lower bots' good dodging matter more than their bad aim.

## 1. How human do the bots feel? The tells, from the code

Ordered roughly by how quickly a player would notice.

1. **Perfect arrow sidestep at every level.** In `botThink` the "dodge incoming enemy arrows" loop (the `else for (const a of w.arrows)` branch for iq < 0.5) runs for Easy, Normal, Hard and Extreme alike. Any arrow due to hit within 0.4 s makes the bot step sideways at full force, instantly, with no reaction delay and no chance of stepping the wrong way. The `dodge` number in DIFF only gates the *dash*, not the step. So a new player lines up a shot on an Easy bot and watches it slide out of the way, every time, unless the arrow is fast enough that 0.4 s isn't enough.
2. **Constant-speed orbiting.** `botSteer` normalises the movement vector, so a bot is always either standing still or moving at exactly full speed. In the default (non-Master) branch the bot strafes in a circle around its target (`gx = -uy * ai.strafe`) and flips direction on a timer (`ai.strafeT = rand(0.9, 2.4)`). No pauses, no bursts, no hesitation, no overshooting a stop, no walking somewhere for no reason. Humans stutter-step, stop to aim, and drift.
3. **Robot aim.** `ai.aimA` turns toward the desired angle at a fixed rate (`D.turn`) and stops dead on it, never overshooting or wobbling. The aim scatter (`ai.err`) is a fixed offset re-rolled every 0.3-0.6 s, the same whether the bot is standing still, sprinting, dashing, being knocked back or on fire. Real aim gets worse while moving and after being hit, and better the longer you hold a draw.
4. **Release timing is a formula.** A bot releases the moment `p.charge >= ai.want && onTarget`. Master's `onTarget` cone is `atan2(T.r * 0.9, dT)`, i.e. "will this hit?", so it never fires a shot it doesn't believe will land, and never holds a full draw for a second waiting for a better moment (baiting a dodge). Humans release early under pressure, over-hold, and occasionally fire when they meant to dash.
5. **Slower walking as a difficulty knob.** `p.speed *= botD(p).speed` gives Easy 75% and Normal 85% movement speed. Players see an archer that is visibly slower than them, which reads as "handicapped bot", not "weaker player". Weaker humans move at full speed; they just move to worse places.
6. **Abilities on hair triggers, identical at every level.** `botAbilities` takes no difficulty input. Spotter fires the instant a target is within 700 px and off cooldown; Fortify at exactly 50% HP; Execute the instant the target drops under 45%; Deflect and Shield Wall the moment an arrow is due; Bull Rush only when four sample points along the path are safe. Easy uses Parry as well as Master. Humans forget abilities, waste them, and use them late.
7. **Instant, identical card picks.** `startPick` makes bots pick in the same frame the pick screen opens, so a human sees "Bot Fletch has picked" before the cards are even readable. Easy through Extreme pick with the same style-driven heuristic (capstones first, then actives, then style cards); only Master uses the learned values. Two Easy bots of the same role and style will build the same way.
8. **Never fooled.** `foes` is built from `w.players` only, so bots never target a Shadow Clone, and they lose a stealthed target instantly (it vanishes from `foes` beyond 110 px) and walk toward the arena centre rather than keeping their aim where the enemy was last seen or guessing where it's going.
9. **Sees everything, equally.** Bots track every enemy on the map with the same lag (`see`), read the exact `charge` of an enemy's draw (fair, it's visible) and react to arrows from any direction, including from a second enemy behind them, exactly as well as to the one they're fighting. Humans tunnel on their target; flank shots land on people.
10. **Reaction delay only on target change.** `ai.reactT` is set only when `T.id` changes. A target that dashes, changes direction or comes out of stealth in front of the bot gets tracked with only the `see` lag (60 ms for Master). Humans need 200-300 ms to react to a direction change, at any level.
11. **No memory, no mood.** Nothing persists between games: no tilt after a bad death, no overconfidence after a kill, no "this player keeps sniping me from the left, I'll rush them", no fatigue late in a long match, no early-game caution. `ai.aggr` is rolled once per match and never moves.
12. **Chat is disconnected from play.** AI players "type" 0.7-2.9 s after a kill while still fighting at full efficiency. They only speak on start, kill, death, game end, match end and to greetings/gg. Nothing when they nearly fall into lava, when a teammate saves them, after a long stalemate, when someone camps, or when addressed by name. And their only reply trigger is the regex `gg|gl|hf|hi|hey|hello|yo|wp|glhf`.
13. **Ninja and Crossbow bots click at machine rate.** For ninjas `inp.draw = want && !inp.draw` toggles every frame, so shuriken go out as fast as the throw cooldown allows at every level; there is no `react` in that path. Crossbow bolt cadence does include `D.react * 0.5`, but Easy still empties its magazine in about a second.
14. **Hazard avoidance is flawless and identical.** `botSteer` pushes away from every hazard with a 60 px margin, and every dash (dodge or bash) first checks `lethalDist` at the landing point. No level ever *walks* into a pit, mis-dashes into lava or gets caught by a saw through carelessness. Yet those are the most common beginner deaths.

## 2. Do the levels match their names?

**Now:** the levels form a clean ladder (each beats the one below 66-78%, Master beats Extreme 82%), so they are *ordered* correctly. But they are ordered along one axis, reflexes, and the qualitative skills a human has at each stage are missing or given to everyone.

What each level should and shouldn't do (proposed):

| Skill | Easy (new player) | Normal (average) | Hard (good) | Extreme (very good) | Master (top human) |
|---|---|---|---|---|---|
| Hit a standing target at mid range | mostly yes (~70%) | yes | yes | yes | yes |
| Lead a moving target | no (aims at where they are) | a bit, often wrong | yes, small errors | yes | yes, allows for knockback slide |
| Sidestep an arrow | rarely, late, sometimes wrong way | sometimes | usually | almost always | reads two arrows ahead |
| Dash-dodge | almost never; sometimes dashes into danger | occasionally | yes | yes | only when a step won't do |
| Knockback awareness (don't stand with a pit behind you) | none | starts (retreats from edges when enemy is drawing) | yes | yes | plans spots (botPlan) |
| Shoot to knock enemies into hazards | accidental | notices when they're right at an edge | yes | yes | positions for it |
| Draw discipline | random charges, over-holds, panic releases | some quick shots wasted | good | good | full draws only when safe; feints |
| Ability use | forgets them, uses them late or pointlessly | uses them, often early | timely | timely + defensive reads | baits with them |
| Card choice | shiny/random | style-driven | style-driven | learned values with style bias | learned values |
| Movement | full speed, jerky, stops to aim, wanders | mostly sensible | good spacing | good spacing | positional play |
| Attention | only the target; blind to flankers | flankers noticed late | most threats | all threats | all threats |
| Mistakes | walks into pits occasionally, dashes into lava, wastes dashes | occasional edge death | rare | very rare | almost none |

Concretely, about the current numbers:

- **Easy**: `aimErr 0.28` is too much scatter and `dodge 0.04` is not the problem (the free sidestep is). Fix the shape, not the number: aim error of roughly 4-6 degrees Gaussian at a standing target, plus a *lead* error (aim at the old position, `lead 0`, and add the `see` lag error), plus a movement penalty. Remove the sidestep (or give it a 40% chance with a 0.3 s delay and a 20% chance of going the wrong way). Speed back to 1.0. Shoot half as often (`ai.reload` 0.8-1.5 s). No abilities in the first 5 s of a game and only ~50% of the time a rule fires. Occasionally (say 5% of dashes) skip the `lethalDist` safety check.
- **Normal**: aim as Easy but with a real lead attempt (`lead 0.5-0.7` with a random multiplier per shot, so it over- and under-leads). Sidestep 60% of the time with a 0.2 s delay. Begin knockback awareness: a cheap version of `pushRisk` on its own position, once a second, that makes it back away from an edge when an enemy is drawing at it.
- **Hard**: today's Extreme reflexes with today's Hard aim scatter; full sidestep; reliable abilities; knockback awareness always on. This is where "plays properly, occasionally misses" belongs.
- **Extreme**: today's Master numbers minus botPlan's hazard-pushing and minus the guaranteed-hit release cone. Very good, still honest aim error (~1.5 degrees).
- **Master**: keep botPlan. Add what top humans do that it doesn't: hold a full draw at a safe spot and release when the target commits to a movement (feint/bait), fake a retreat to draw a brawler onto a hazard edge, save the dash for the shot that would kill, change target to the one with a pit behind them (partially there via `pushRisk` in targeting). Give it a small, honest aim error that grows with its own movement so it isn't a turret.

One more structural point: the "smart brain" is a switch, not a dial. `iq >= 0.5` gates botPlan, intercept aim and smart dodging. `skillParams` snaps iq from 0 to 0.5 at skill 0.78 (see Bugs). Making those features degrade gracefully (e.g. botPlan at iq 0.3 re-plans every 0.4 s instead of 0.12 s and ignores pickups; intercept aim with a lead multiplier that wanders between 0.7 and 1.2) would make Hard and Extreme feel like less polished versions of Master rather than a different species.

## 3. Matchmaking's AI players

**Do they play like their sheet says?** Mostly no.

- `seatAI` correctly sets `b.dparams = Sim.skillParams(a.skill)` and `b.ai.aggr = a.aggr` (and style if the JSON has one; only 13 of 60 do). But `resetMatch` runs `pickStyle(p)` for every bot ("a fresh mood each match") which rerolls `ai.aggr = rand(0.2, 1)` and the style from the role. The 900-rated "aggressive brawler" turns into a random-mood skirmisher the moment the match starts. Fix: skip `pickStyle` when `p.dparams` or `p.aiUser` is set, or store the personality in `p.persona` and have `pickStyle` read from it.
- Skill only changes reflexes (`skillParams` interpolates DIFF). Card picking, ability rules, risk-taking and movement are the same for skill 0.03 as for 0.77. Only from 0.78 upward do the learned card values and botPlan appear.
- Personality (`tone`) only affects chat lines; `aggr` affects preferred distance and dash-bash frequency; `chat` affects frequency. `style` is unset for most.

**How skill 0..1 should map to behaviour beyond reflexes** (all as blends inside `skillParams`, so the AI players get them for free):

- **Card picks** (`botPickIndex`): weight of `CARD_VALUE` = skill (not iq); randomness `1.5 - skill`; a "shiny" bias for actives and capstones that shrinks with skill; team-only cards only when there are teammates. Low-skill players also *hesitate*: pick after 4-12 s, high-skill after 1-3 s.
- **Playstyle discipline**: low skill drifts between styles mid-game (re-roll `ai.style` after a death with probability `1 - skill`); high skill holds theirs.
- **Risk**: probability of chasing a target across a hazard field, of standing in the capture zone under fire (`wantChan` threshold), of committing a dash-bash without the `lethalDist` check, all scale with `(1 - skill) * aggr`.
- **Mistakes**: a per-second chance of a "brain fade" (freeze 0.3-0.8 s, or walk 2-3 steps the wrong way) of `0.15 * (1 - skill)`; chance to over-draw (hold full charge 0.5-1.5 s) `0.4 * (1 - skill)`; chance to mis-lead (multiply lead by 0.5 or 1.5) `0.5 * (1 - skill)`.
- **Attention**: the incoming-arrow scan only considers arrows from within ±60 degrees of the current target for skill < 0.4, ±120 degrees to 0.7, everything above.
- **Ability timing**: add `react * 2` delay before an ability rule is acted on, and a `1 - skill` chance to ignore a rule the first time it fires.

**How personality could show in play, not just chat:**

- `aggr` already sets range and bash frequency; extend it to draw choice (aggressive: more quick shots and pushes; cautious: full draws from range), to capture-zone contesting, and to chasing a low-HP enemy vs. backing off when low yourself.
- Tone: `cocky` takes more risks after a kill (aggr +0.2 for 10 s) and taunts; `salty` tilts (aim error +50% and aggr +0.3 for 8 s after a death by ring-out); `tryhard` never tilts, always picks by `CARD_VALUE`; `chill` moves less, holds range, fewer dashes; `jokester` wastes a dash or an ability sometimes for fun; `quiet` never chats but plays steadily; `wholesome`/`friendly` don't camp the heal pool and won't chase into a pit fight.
- Chat moments to add to `aiEvents`: own near-death on a hazard ("that was close"), teammate save/revive, long stalemate (30 s no hits), a human's ring-out of a teammate, being addressed by name, and "afk?" if a human hasn't moved for 10 s. Chat should happen when the AI is dead or between games; if it must talk mid-fight, freeze its input for 1-2 s ("typing").

## 4. Bugs and oddities in the bot code

1. **Personality overwrite (matchmaking).** `resetMatch` → `pickStyle(p)` rerolls `ai.aggr` and `ai.style` for AI players seated by `seatAI`. Their aggression and playstyle from `ai-players.json` never reach the match. Also `addBot` runs `pickStyle` before `seatAI` calls `setLoadout`, so the pre-match style is based on a random role (moot once the first bug is fixed, but the fix should re-run style selection after `setLoadout`).
2. **Skill cliff at 0.78.** `skillParams`: `out.iq` is 0 below skill ~0.78 and jumps to 0.5 there (then ramps to 1 at 0.92). Every `iq >= 0.5` check in `botThink` flips at once, so a skill-0.77 player (SaltyDog44, 1486 rating) and a 0.79 player (tired_archer, 1606) play like different species, and a 0.92 player is identical in brain to a 1.0 one.
3. **Railshot speed/drag not used in aiming** (found in the first pass; the fix is in `/tmp/claude-0/balance/changes.diff` but the live `shotSpeed`/`shotDrag` in `public/sim.js` still lack `railArmed`). Also the low-iq lead at `const spd = (380 + 920 * ...)` ignores Longbow (+20%), Sniper (+10%), Obsidian and Colossus, so Hard/Extreme snipers with Longbow systematically over-lead.
4. **Team-only cards in 1v1** (first pass): `botPickIndex` gives Guardian-style cards (Totem, Rally, Bond, Oath, Revive, Wall) no penalty when the bot has no teammates; `STYLES.guardian.mates` is only used for movement.
5. **Inconsistent random tiebreak in `botPickIndex`.** `score()` calls `Math.random()` inside, and the loop compares `score(id) > score(p.offer[best])`, re-rolling both each time. Harmless-ish but means the "randomness" is not a fair per-card roll; compute scores once into an array.
6. **Dodge only gated for the dash.** DIFF `dodge` is documented as dodging skill but the sidestep is unconditional at all levels (see tell 1). Either rename or gate the step too.
7. **Ninja throw cadence ignores `react`** (`inp.draw = want && !inp.draw`), so Easy ninjas throw at the mechanical maximum.
8. **Dodge-dash can hijack a shot.** When a dodge dash and a release happen in the same frame, `inp.aim = ai.dashAim` is applied after `inp.draw = false`, so the arrow flies in the dash direction. Rare; guard by not releasing on a frame with `p.wantDash`.
9. **`incoming()` and the low-iq loop ignore `a.pierce`/`a.seek`/`a.boom`** behaviour: a seeking arrow's future path isn't straight, so bots step into it; a boomerang's return isn't anticipated. Minor, but Master "reading arrows" should at least treat seekers as unavoidable-by-step.
10. **Stealth handling.** A stealthed target drops out of `foes` and the bot walks to the arena centre (`gx = (AW/2 - p.x)/300`). A human would hold position and watch the last known spot. Suggest remembering `ai.lastSeen` for 3 s and aiming there.
11. **Dead code / no-ops.** `mates.length >= 0 &&` in the revive check is always true; `const _unused_ = 0`; `GENE.retreat` is defined but never read.
12. **Bots and clones.** Shadow Clone zones are never considered as targets, so the card is worth less against bots than humans (also noted as a measurement caveat in the first pass); `CARD_VALUE.clone` is learned from bot-vs-bot games and so under-values it.
13. **Match-start style reroll also hits custom-game bots** whose host set a per-bot skill via `setBotSkill`: that survives (it only changes `p.diff`), but any per-bot style a future feature might set won't.

## 5. Prioritised suggestions

### Quick wins (an hour or two each)

1. **Stop `resetMatch` from rerolling AI players' personality.** Why: it's the single reason "aggressive brawler at 900" and "cautious marksman at 1500" play the same. How: in `resetMatch`, `if (p.bot && !p.aiUser) pickStyle(p)`; in `seatAI`, call style selection after `setLoadout` so the style fits the real role, then apply `a.aggr`/`a.style`.
2. **Gate the arrow sidestep by level.** Why: it's the most visible tell and the main reason Easy is hard to hit. How: in `botThink`'s low-iq dodge loop, act only with probability `D.dodge * 3` (clamped) per incoming arrow, after a delay of `D.react` (store `ai.dodgeAt = w.t + D.react` when first noticed), and with probability `0.3 * (1 - D.dodge)` pick the wrong side. Easy ends up dodging ~12% of shots, Normal ~35%, Hard ~100%.
3. **Put Easy and Normal back to full walking speed** (`speed: 1` in DIFF) and take the difficulty out of decisions instead: longer `react` (Easy 0.9, Normal 0.6), slower `reload` (Easy `rand(0.6, 1.4)`, Normal `rand(0.3, 0.8)`), lower `turn`. Why: a slow-walking archer looks handicapped, not inexperienced.
4. **Fix the shape of aim error.** Why: Easy misses standing targets 79% of the time; no human does. How: replace uniform `ai.err = rand(-1,1) * aimErr` with Gaussian (sum of three `rand(-1,1)` / 1.73) scaled to a smaller `aimErr` (Easy 0.09, Normal 0.06, Hard 0.035, Extreme 0.02, Master 0.012), and add a separate *lead* error: multiply the lead time by `rand(1 - leadErr, 1 + leadErr)` per shot (Easy 0.8, Normal 0.5, Hard 0.3, Extreme 0.15, Master 0.05). Add a movement penalty: `err *= 1 + 0.6 * (speed_now / baseSpeed) + (p.knock > 0 ? 1 : 0)`. Net effect: Easy hits still targets ~70% and moving ones ~20%; Master stays accurate but a little less turret-like.
5. **Delay card picks and abilities.** Why: instant picks and hair-trigger abilities scream "bot". How: in `startPick`, set `p.pickAt = w.t + rand(2, 4) + (1 - skill) * rand(3, 8)` and take the card in `step` when `M.ph === 'pick'` and `w.t >= p.pickAt` (also lets the pick timer show something human-looking). In `botAbilities`, when a rule first becomes true set `ai.abAt[i] = w.t + D.react * rand(1, 3)` and only fire after; add a `Math.random() < D.iq * 0.5 + 0.5` chance to act on the first trigger.
6. **Penalise team-only cards in 1v1 and fix `botPickIndex`'s randomness.** How: compute `score` once per card into an array; subtract 3 when `TREE[id]` is a team card (Totem, Rally, Bond, Oath, Revive, Wall, Harpoon-on-mates) and `mates.length === 0`.
7. **Apply the Railshot/Longbow/Sniper speeds in the low-iq lead** by using `shotSpeed(p, c)` instead of the inline formula at `const spd = ...`, and land the `railArmed` fix from `changes.diff` in `shotSpeed`/`shotDrag`.
8. **Smooth the skill cliff.** In `skillParams`, make `iq = clamp((s - 0.5) / 0.45, 0, 1)` and in `botThink` replace `iq >= 0.5` gates with graded behaviour: botPlan on when `iq > 0.3` with `planDt = 0.12 + (1 - iq) * 0.4`; intercept aim on when `iq > 0.2`; smart dodge horizon `0.3 + 0.25 * iq`.

### Medium (a day each)

9. **Human movement texture.** In `botSteer`/`botThink`: scale the movement vector by an "intent" between 0.4 and 1 (not always full speed); add a per-bot stutter (`ai.pauseT`: stop moving for 0.15-0.4 s roughly every 2-5 s, more often for low skill, and always briefly when releasing a full draw); randomise the strafe flip (`rand(0.5, 3.5)` and sometimes don't flip); occasionally overshoot a stop (keep moving 0.1-0.2 s past the goal).
10. **Aim with overshoot and settle.** Replace the fixed-rate turn with a spring: aim velocity accelerates toward the target angle, overshoots by 5-15% and settles over 0.15-0.3 s; jitter of ±0.5-1 degree while holding. Draw discipline: a "hold" behaviour where the bot reaches full charge and waits `rand(0.2, 1.2)` for the target to commit before releasing (high skill), or releases too early when an enemy arrow is incoming (low skill, "panic release").
11. **Knockback awareness for Normal/Hard without the full planner.** A cheap "edge check" each 0.5 s: if any enemy within 500 px is drawing at me and `pushRisk(me, direction away from them, kbTravel(their charge)) > 0.5`, add a strong steer perpendicular to the shot line or toward the enemy. Turn on at Normal with 50% reliability, Hard 100%. This is the skill that separates a beginner from an average player in this game and it's currently Master-only.
12. **Attention model.** Give each bot an attention cone around its target (Easy ±60 degrees, growing with skill); arrows and abilities from outside the cone are noticed with an extra `rand(0.2, 0.5)` delay. Also make `perceived()` lag apply to movement/plan decisions, not just aim, so lower bots react to a dash a beat late.
13. **Mistake budget for low levels.** Per-second chance (Easy 0.12, Normal 0.05, Hard 0.01) of one of: freeze 0.3-0.8 s; walk the wrong way for 0.5 s; dash without the `lethalDist` check; over-draw; drop the target for 1 s. This produces the pit deaths and wasted dashes new players actually see from each other.
14. **Memory of stealthed/vanished targets.** Keep `ai.lastSeen = {x, y, vx, vy, t}` for the current target; when it disappears (stealth, smoke), keep facing/aiming at the extrapolated spot for 2-3 s and drop the target only after; low skill keeps facing the *old* spot, high skill extrapolates. Also consider clone zones as candidate targets for skill < 0.6 (with a 50% chance of being fooled for 1.5 s).

### Bigger ideas

15. **Mood and tilt.** Add `ai.mood` (−1 to +1) nudged by events: a kill +0.3, a death −0.3, a ring-out death −0.5, a lost game −0.2, decays to 0 over 15 s. Mood > 0.3 raises `aggr` and quick-shot chance; mood < −0.3 raises aim error 30% and either raises aggr (salty/cocky tones) or lowers it (chill/quiet). This gives streaks and comebacks and lets tone show in play.
16. **Master's higher game.** Feint: hold full draw at a safe spot and release when the target's dodge dash is on cooldown or they start a draw (`T.drawing && T.charge > 0.5` means they're committed). Bait: when the target is a brawler (close-range style, high aggr observed from their behaviour), retreat toward a spot where the target's approach path crosses a hazard edge, then turn. Dash economy: never dodge-dash when the incoming shot is under 0.4 charge (a sidestep or just taking it is fine); save dashes for the killing bash. Read the opponent: track how often the human sidesteps left vs right and bias `interceptAim` toward their habit.
17. **Skill as a personality profile, not a number.** For matchmaking, give each AI player a small vector: aim, movement, awareness, discipline, greed. Generate `dparams` from those so a 1200 player can be a great shot with bad positioning, or a careful mover with poor aim. Humans at the same rating are not the same player; two AI players at the same skill currently are.
18. **Chat tied to the game state.** Move chat decisions into `aiEvents` with a "can I type now?" check (dead, between games, or no enemy within 400 px), add the situational moments listed in section 3, and have the bot stand still and stop drawing for 1-2 s when it "types" mid-game. Make `aiReply` respond to its own name and to questions ("?" in text) with tone-appropriate short lines.
19. **Per-level learned card values.** `CARD_VALUE` is learned from Master vs Master; what wins for a bot that can't aim is different (Fleet Foot, Fortify, Vital matter more; Railshot, Deadeye less). Run the same learning loop at Normal to get a second table and blend by skill.

## What I'd measure to confirm

The experiment scripts are in `/tmp/claude-0/-home-claude/.../scratchpad/levels.js` and `dummy.js` (they only use `bench.js`). After any change: re-run the mirror table above (accuracy, shots/min, hazard deaths per game, game length), the dummy accuracy per level (target: Easy ~70%, Normal ~80%, Hard ~90%, Extreme/Master ~95% standing; Easy ~20% moving), and the ladder (`ladder.js`) to keep each level winning 65-75% against the one below. A useful new metric is "first hit time" and "dash-dodge success rate" per level, both easy to log from `w.events`.
