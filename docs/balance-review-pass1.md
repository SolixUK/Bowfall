# Bowfall balance review, pass 1 (Opus), v0.17.2

Method: Master vs Master bots, random element and role, random maps and sides, bots pick their own cards.
Before: 2,200 matches (20,056 games). After the proposed changes: 2,600 matches. Win rates are games won.
Uncertainty about ±1.5 points (1v1) and ±2 (2v2) per element or role row.

## Top findings
1. Roles are far less even than elements (elements 46–53%). Too strong: Assassin (~61%), Ninja (61% 1v1, 50% 2v2). Too weak: Warden (27.5% 1v1, 41.5% 2v2), Trapper (37% 1v1, 44% 2v2).
2. Parry exploit: during the 3s riposte every shot is instant; a human clicking ~7/s fires 22 full-power arrows in 3s (confirmed with a scripted test).
3. Railshot looks weak partly due to a bot aiming bug (bots lead it as a normal-speed arrow). 42% -> 45% with the aim fixed; still below Volley for bots.
4. Fleet Foot strong even for bots: forced pick 58.4% vs 54.2% for Rangers overall.
5. Blood weakest element (~45–46%). Frenzy good (+7); Hemorrhage neutral; Blood Pact -5; Transfusion -4 in 2v2. Raising lifesteal made no measurable difference: healing doesn't stop ring-outs.
6. Void slightly weak (~45–47%); stronger slow/pull/size didn't help.
7. Bot card picks contribute to Warden/Trapper weakness: CARD_VALUE is stale (Warden always opens Gust; Totem/Wall openers give 36% vs 28.5%); bots take team-only cards in 1v1; Blood cards have no learned value.

## Win rates (before -> after), games won
Element 1v1/2v2/all: Flame 51.8->53.5 / 54.5->54.2 / 52.8->53.8; Shadow 53.2->54.8 / 51.6->53.6 / 52.6->54.3; Storm 52.0->52.8 / 52.7->52.8 / 52.3->52.8; Stone 53.8->51.1 / 49.1->52.2 / 52.0->51.5; Poison 49.7->51.0 / 50.4->49.7 / 50.0->50.5; Frost 47.8->48.4 / 49.2->51.2 / 48.4->49.5; Void 45.5->44.5 / 48.4->45.3 / 46.7->44.8; Blood 46.2->44.7 / 45.1->44.1 / 45.8->44.4.
Role 1v1/2v2/all: Assassin 61.5->56.4 / 59.7->48.6 / 60.7->53.1; Ninja 61.0->57.0 / 50.3->50.2 / 56.2->54.3; Ranger 54.2->56.1 / 56.3->59.8 / 55.1->57.6; Crossbowman 56.8->53.7 / 47.8->51.0 / 52.6->52.6; Sniper 54.2->55.0 / 49.8->50.6 / 52.4->53.4; Trickster 48.9->50.5 / 55.2->54.5 / 51.2->52.2; Juggernaut 49.1->49.6 / 49.2->46.2 / 49.1->48.1; Trapper 37.4->39.8 / 44.3->45.0 / 40.3->41.7; Warden 27.5->31.5 / 41.5->43.8 / 33.5->36.7.
Notable pairs (1v1 before): Shadow+Ninja 78%, Flame+Ninja 67%, Shadow+Assassin 66%; all Warden pairs 26–38%; all Trapper pairs 35–42%.

## Proposed changes (in changes.diff)
1. Parry riposte: only the next shot is instant and +30%; for 3s draws are 2x faster, +20% speed, cooldown halved. (22 shots -> 1.)
2. Assassin: -10 health; Blink cd 6 -> 8s. (60.7 -> 53.1.)
3. Ninja: blink recharge 1.5 -> 1.65s; shuriken gap 0.34 -> 0.36s. (1v1 54–57.)
4. Warden: Mender 3/s after 3s (was 2/s after 4s); no longer 5% slower; +10 health; Rally and Bond cover the Warden; Oath self-penalty 10 -> 5%. (2v2 41.5 -> 43.8; 1v1 27.5 -> 31.5.)
5. Trapper: abilities recharge 40% faster (was 30%); +25% damage vs held targets (was 15%); Harpoon holds 0.9s (was 0.5), 6 dmg (was 4); Bramble roots 2.5s (was 2.2). (40.3 -> 41.7.)
6. Fleet Foot +15% -> +10% speed. (58.4 -> 56.3 forced.)
7. Blood: lifesteal 25 -> 35%; Blood Pact 55% (was 45%), costs 10 hp (was 15); Hemorrhage bleed 8 -> 10. (Not measurable.)
8. Void: rifts slow 40% (was 30%). (Not measurable.)
9. Railshot cd 11 -> 10s; bot aim fix for armed Railshot (shotSpeed/shotDrag).

## Card notes (correlation from baseline records)
Doing well: Quickshot +17, Steady Draw +16, Repeater +14, Petrify +12, Double Crank +9, Static +8, Frenzy +7.
Doing badly: Ballista -19, Point Blank -15, Obsidian -12, Earthshaker -11, Hair Trigger -11, Blood Pact -10, Shadow Dance -10, Scatter Bolts -10.
CARD_VALUE should be re-learned after the patch.

## What bots can't measure
Parry/Hair Trigger reaction; Assassin Backstab (bots always face targets); Shadow likely over-rated by bots (shrouded bots aim worse by rule); Void rifts only open on bullseyes (bots aim almost perfectly, so Void likely weaker for humans); Fleet Foot's turning worth more to humans; traps/Harpoon/Shield Wall/Totem used simply by bots; the very-fast arrow default shrinks dodge and Parry windows.

## Bugs noticed
Parry click-spam (fixed); bots ignore Railshot speed/drag when aiming (fixed; shotTime divides by drag, drag 0 breaks aiming); bots pick team-only cards in 1v1 and Blood cards have no CARD_VALUE; Fleet Foot description understates it.

## Suggested next steps
Warden in 1v1 needs a tool that works alone; Trapper: extra knockback on held targets; Blood: a knockback-related on-hit effect instead of more healing; Void: open rifts on any fully drawn hit; Ranger: trim speed 8 -> 6% or Fleet Foot agility; re-learn card values and measure again.

Work files: work/ (run.js, an.js, fan.js, mdtable.js, parryspam.js, logs).
