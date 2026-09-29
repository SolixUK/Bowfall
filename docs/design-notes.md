# Design notes: fun, the first minute, unlocks and the play loops

Written for 0.29.0. These are working notes, not rules: what the game is trying to be, what 0.29 changed because of it, and the decisions still open.

## What makes Bowfall fun (and what to protect)

1. **Knockouts are the payoff.** A hit that throws someone into a pit is the moment people remember and replay. Anything that makes a big hit *feel* bigger (hit-stop, the edge flash, streaks, the kill cam) is worth more than another stat. Anything that makes knockouts random or unreadable costs more than it looks.
2. **Every death should feel like your fault, and fixable.** You saw the draw and didn't dash; you stood by the pit. That's why draw tells, the dodge step in the tutorial and readable knockback matter. Hidden damage and effects you can't see are the enemy of "one more game".
3. **Skill that shows quickly, depth that shows slowly.** A new player lands a hit in their first minute; a good player is still learning angles, bank shots and baiting dashes a month in. Elements and roles should add *choices*, not just numbers.
4. **Short games, fast restarts.** Rounds are short and "Rematch now" is one click. Every screen between games is a place people quit, so it has to earn its time (the progress panel is quick to read, and it sits on the results screen you're already looking at).
5. **Playing with friends beats everything.** A friend's link that drops you into their game is the best recruitment tool the game has.

## The first minute (the funnel)

The target: **from opening the page to playing in under ten seconds**, with no forms.

| Arrival | What happens now (0.29) |
| --- | --- |
| Friend's invite link | Name screen skipped, random friendly name, joins the room and a team straight away. Controls strip shows in the first games. |
| Opens the game cold | Name screen (one field) → menu with **New? Start here** on the tutorial. Practice vs bots is one click. |
| Tutorial | About three minutes; "Skip to the match" jumps to a real bot fight. It ends by offering Find a match / Custom games. |
| First ranked game | Rating seeded from practice and training, placement for five matches, so the first opponents are roughly the right strength. |

Still worth doing:

- **Measure it.** Log (anonymously) where new players stop: gate → menu → first game → second game → second session. Without numbers, funnel work is guesswork.
- **"Play now" as the biggest button** for someone who has never played: straight into a 1v1 against an Easy bot on Meadow, with the controls strip, and the tutorial offered after the first game rather than before it.
- **Guest → account moment.** Ask people to sign up right after something good happens (first win, first mastery level), not up front. The guest rating already moves across.
- **Mobile/touch:** anyone opening a link on a phone currently gets a game they can't control. At least tell them, and offer "send this link to my computer".

## Starting rating (what was built)

- New accounts start from a **seed** instead of a flat 800. The seed comes from the hardest bot difficulty beaten in practice, a nudge from training grades, and a small drop for someone brand new. Clamped to 650–1200.
- **Placement:** K is 64 for the first rated match, shrinking by 4 each match to the normal 24. So a wrong seed corrects itself within a handful of games.
- Next steps if needed: a hidden uncertainty value (Glicko-style) instead of the fixed K schedule, and matchmaking that pairs placement players with each other where the queue allows.

## Unlocking elements and roles: the options (undecided)

The code already supports locks (premium elements and roles, Crests, the weekly free rotation, founder pack). Locks are off. The open question is where locks should apply.

**Option A: locked in ranked only, everything free in custom, practice and training** (what the code does when `/locks on`).

- For: friends can always play together with anything; people can try a locked element properly before spending on it; custom games stay a sandbox for creators and tournaments.
- For: ranked is where "earning" feels meaningful, and it keeps new players on a smaller, easier set while they learn.
- Against: people can see everything is free a click away, which weakens the pull to unlock.
- Against: a player may practice a kit for weeks in custom and then hit a wall in ranked.

**Option B: locked everywhere.**

- For: the clearest progression; unlocking feels like getting something new.
- Against: it splits friends ("I can't pick that in your game"), and new players see a wall of locks on day one.
- Against: it's less friendly to the creator and tournament side.

**Option C (a middle path worth considering): a starter kit plus earnable unlocks, locked only in ranked, with a free trial.** New accounts get a small, readable starter set (for example Frost/Flame/Storm with Ranger/Sniper/Juggernaut). Everything else unlocks by playing (a mastery milestone or Crests) or rotates free weekly. Custom and practice stay open, and any locked element or role can be played in ranked a few times as a trial. This keeps the learning curve gentle, gives a steady stream of "new thing" moments, and never blocks friends playing together.

Whichever is picked, the rule that matters: **never sell power.** Unlocks are sidegrades you could also earn by playing; money buys time or cosmetics.

## The play loops (why people come back)

- **Inside a game (seconds):** draw → shoot → hit → knockback → knockout, with sound, hit-stop and flash on the big ones.
- **Inside a session (minutes):** best-of rounds, upgrades between rounds, rematch, rating change, the progress panel (XP, mastery, Crests).
- **Across days:** the daily first-win bonus, achievements and tiers, training grades, the weekly free rotation, placement then climbing.
- **Across weeks:** mastery ★ on every element and role, rating peaks, leaderboards, titles and banners.

Ideas for later (none built):

- **Mastery cosmetics:** at ★5 and ★10, an arrow-trail tint or a nameplate emblem for that element or role, and a title such as "Frost Master". Cosmetic only.
- **Daily or weekly challenges** ("win a game as a Trapper", "3 ring-outs") that pay Crests. Keep them to things that happen in normal play, so they don't warp matches.
- **Seasons:** a soft rating reset every few months, with a banner finish for peak rank.
- **Replays to share:** the kill cam already exists; a button to save a clip or share a link would feed the friend-link funnel.

## Graphics: what to do next

- **Readability first:** team colour on everything that can hurt you (arrows, traps, zones). Clear draw tells on every bow. Pit edges that read at a glance on every theme.
- **Impact:** now in: hit-stop, streaks and edge flashes. Next: a short squash-and-stretch on the hit archer, dust puffs when someone slides along a wall, and a splash ring when someone falls into a pit.
- **Life in the arenas:** small ambient motion (grass sway, drifting leaves, water shimmer) that stays away from the play space so it never hides an arrow.
- **Performance:** everything new respects Light effects mode, and Screen shake: Off also turns off hit-stop and slow motion.
