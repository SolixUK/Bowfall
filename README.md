# Bowfall

Version 0.13.7. See [CHANGELOG.md](CHANGELOG.md) for what changed in each version.

Top-down knockback archery for teams, with a website, accounts and a forum: Red vs Blue, up to 4 per side, humans and bots mixed however you like, across eight arenas. The main menu has a **How to play** screen (also in the in-game menu) that explains everything below.

## Website, accounts and games list

Run the server and open its address: `/` is the website and `/play` is the game.

- **Website:** a front page with open games and recent forum threads, a **Games** list, a **Leaderboard** (game wins, knockouts, match wins, games played, ring-outs, bullseyes), player **profiles** and a **Forum**.
- **Accounts:** sign up with a name (3-16 letters, numbers, _ or -) and a password. Passwords are stored as salted scrypt hashes; sessions are an HttpOnly cookie that lasts 30 days. Signed-in players always play under their account name, and guests can't use a registered name (they get a `~` added).
- **Google and Discord sign-in:** "Continue with Google" and "Continue with Discord" appear once the server has each service's client ID and secret (see HOSTING.md). First-timers pick a player name; existing players can link either on their profile, add or change a password there, and unlink one as long as another way to sign in remains. The server keeps only the service's user ID, no email address.
- **Stats and achievements:** for signed-in players the server records every online game (games, wins, knockouts, deaths, damage, accuracy, ring-outs, matches, favourite roles and elements) and works out achievements itself from the game's events, so they can't be faked from the browser. Titles are chosen on your profile (or in the game's Achievements screen) and only earned ones can be worn. Guests and practice games keep using the browser's own achievement list, as before.
- **Hosting a game:** in the game, **Play online → Host**: give it a name, choose **Public** (shown in the games list on the site and in the game) or **Private** (join by code only), and optionally a **password**. The host can change all three in the lobby. Joining a game with a password asks for it.
- **Forum:** categories for News (admins only), General, Builds and tactics, Looking for a game, Bugs and Ideas. Signed-in players can start threads and reply; you can delete your own posts. Admins can pin, lock and delete threads and delete any post. The first account created on a server is an admin; add more with the `ADMIN_USERS` setting (comma-separated names).
- **Database:** with `DATABASE_URL` set the server uses Postgres (see HOSTING.md for a free one). Without it, everything is kept in `data/db.json`, which is fine on your own computer but is wiped whenever a free host restarts.

## Lobby

Every match starts in a lobby with a Red column and a Blue column:

- **Everyone:** pick your team. Online, whoever creates the room starts on Red; everyone else arrives in the **Unassigned** section and joins a team from there (or moves back to it).
- **Chat (online):** a chat box in the lobby; in game press **Enter** to type, Enter to send, Esc to cancel. Messages fade out over the arena. Joins, leaves and host changes show up there too.
- **Joining mid-match (online):** you spectate (the whole arena, scores and chat) until the current game ends, then a bar at the bottom lets you join Red or Blue for the next game, with as many upgrade picks as everyone else. A full team lets you in by replacing one of its bots.
- **Choosing upgrades:** the next round starts as soon as every player has picked, or when the timer runs out (anyone who hasn't picked gets one of their three cards at random). The pick screen shows who you're waiting for.
- **Host only:** add or remove bots on either side, choose the arena, bot skill and **custom rules**, then start once both teams have at least one archer.
- **Handicap:** the host can step any archer's handicap down or up with − and + (in the lobby or the in-game menu), in 10% steps from −50% to +100%. It scales that archer's health and arrow damage by the percentage, and their knockback resistance by half as much. Handy for uneven teams like 1v2. Games with a handicap are left out of Balance data unless you choose "Any rules".
- **Custom rules:** archer size (small, medium, large), arrow speed (normal, fast, very fast, blazing), move speed (slow, normal, fast, very fast, blazing), knockback (low, normal, high, chaos), health (low, normal, high), dashes (on or off; off also stops Ninja blinks) and aim assist (none, tiny, small, medium, heavy, extreme: every shot bends toward the enemy it is heading for). The standard rules are large archers, very fast arrows, fast movement, normal knockback and normal health. Every recorded game notes its rules, and Balance data shows standard-rules games only unless you ask for all.
- **After a match:** everyone returns to the lobby, or the host can start a rematch straight away.
- **During a match (Esc):** the menu shows the same team editor. Anyone who joins or switches team mid-round sits out until the next round starts.

## Arenas

Every arena is point-symmetric: each map defines one half, and the other half is generated by mirroring it, so Red and Blue always get identical sides.

| Arena | What's special |
| --- | --- |
| Meadow | The original: sinkholes, lava basins and bogs around two boulders. |
| Spring Hollow | A healing spring in the middle (12 health per second while you stand in it), ringed by boulders. Hurt bots head for it. |
| Ember Rift | A lava river splits the arena, with two bridges. Amber and powerups spawn on the bridges. Dashing jumps the lava. |
| Tide Cove | A sandy beach with tide pools, soft wet sand (slows you like a bog) and barnacled rocks. Normal footing. The tide creeps in from the corners: the corner patches flood at 40 seconds, the top and bottom edges at 70 and the side edges at 95 (4 seconds of warning as the water rises), so the arena shrinks as the game goes on. |
| Gale Cliffs | A clifftop with sheer drops. Every 9 seconds a gale blows the whole arena up, then down the next time: chevrons flash for 1.5 seconds as a warning, then the gust pushes everyone on the ground for 2.5 seconds. Arrows drift with it. Dashing ignores it. |
| Sawmill | A plank yard with two saw blades racing along their tracks. Touching one deals 10 damage and throws you hard (they count as a hazard for kill credit). A deep mill pond and a mud patch. |
| Portal Ruins | Old flagstones and four gates: each leads to its mirror image across the arena, keeping your speed. Arrows go through too, so you can shoot round corners. |
| Mushroom Grove | Giant mushrooms fling anyone who touches them at high speed, and arrows ricochet off their caps. Good for banking shots or launching enemies into the pits. |

To add an arena, add an entry to `MAPS` in `public/sim.js`: hazards, boulders, thorn strips, powerup spots, amber range, an optional `heal` zone, optional `ice` physics, optional `cracks` (hazards that appear `at` a number of seconds into each game), and optional moving parts: `saws`, `bumpers`, `portals` and `wind`. Then give it a colour theme in `THEMES` in `public/index.html`.

## How a match works

A match is made of rounds, and a round is made of games:

- **Game:** there are no respawns. The last team with anyone standing wins the game. A game lasts at most 2 minutes; when time runs out, the team with more archers alive wins, then the team with more total health.
- **Between games:** a summary picks out what happened, one praise at a time, least impressive first, each with a sound that fits, so the best lands last: who's carrying, flawless wins, clutches, close calls, sharpshooters, ring-out specialists, top damage and first blood.
- **Round:** the first team to win 3 games takes the round and scores 1 point.
- **Match:** the first team to 3 points wins, or 5 if the host sets it in the lobby. The end screen stays up until the host starts a rematch or returns to the lobby.
- **Critical hits** aren't random. An arrow whose path runs through the middle of the target (the centre 40% of its body) is a **bullseye** and deals 1.5× damage. A full draw no longer crits on its own; it flies faster, hits harder, and triggers the "fully drawn" upgrades.
- **Bogs:** you can't dash out of a bog (Sure Footing can).
- **Kill credit:** knocking someone into a pit, lava, spikes or a wall counts as your knockout if you hit them in the last 5 seconds.
- **Dash:** always goes toward your cursor, whatever keys you're holding. It still jumps pits and lava.
- **Friendly fire:** arrows, explosions and dash-shoves pass through teammates.

### Archetypes and upgrades

Every archer is one **Element** plus one **Role**, chosen in the lobby. Together they make your archetype, like Frost Sniper, Poison Juggernaut or Storm Trickster. Everyone can see each other's archetype on the team lists and scoreboard.

| Elements | Base effect (active from round 1) | Upgrades |
| --- | --- | --- |
| Frost | Hits slow by 50% for 3s (slowed archers also dash more slowly, over the same distance), and your arrows deal 30% more damage to slowed or frozen targets | Frostbite (3rd hit within 6s freezes for 2s) · Deep Freeze (frozen enemies can't draw for 3s) · Shatter (slowed enemies fly further) · *Permafrost* |
| Flame | Hits burn for 2s (5 damage a second) | Wildfire (burning ground) · Inferno (5s burns at 6 a second) · *Pyre* |
| Storm | Hits arc to a nearby enemy (arcs hurt but don't knock back). With nobody to arc to, the arc hits the target again for 3 extra damage, so storm still works in a 1v1 | Static (locks their dash) · Forked Lightning (arcs 3 times) · Echo Strike (a bullseye storm hit arcs again 0.5s later) · *Overload* |
| Poison | Stacking poison (up to 3); poisoned enemies heal half as fast | Toxic Cloud · Virulent (5 stacks, stronger) · Contagion (spreads to nearby teammates every 1.5s) · *Potent Toxin* |
| Stone *(new)* | Hits **stagger** for 2s: the target loses 40% of their current draw and takes 15% more knockback | Boulder Arrows (full draws +30% knockback) · Aftershock (full-draw hits shove every other enemy nearby away) · Petrify (staggered enemies can't dash) · *Obsidian* |
| Void *(new)* | A moment after a **bullseye** hit, a **rift** opens where the target lands; for 2s it pulls them and every enemy nearby toward its centre and slows them 30% | Event Horizon (30% bigger, stronger, 2.8s) · Collapse (rifts burst outward when they end) · Null Field (no dashing inside your rifts) · *Unstable Rift* |
| Shadow *(new)* | **Bullseye** hits **shroud** the target for 2.5s: darkness closes in on their screen until they can only see 170px around themselves (shrouded bots lose track of anyone further and aim worse) | Blinding Dark (shroud closes to 100px) · Creeping Dark (shrouded enemies 15% slower) · Night Terror (enemies you shroud take 25% more damage from your whole team) · *Lingering Dark* |

Every element shares the capstone **Elemental Burst**, which splashes your element onto every enemy nearby.

Your team's fire, poison clouds and rifts are drawn faint with a dashed ring in your team colour; the enemy's are full strength.

**Premium content:** Stone, Void and Assassin are tagged `premium` in `public/sim.js`. Setting `LOCK_PREMIUM = true` shows them as locked in the lobby and stops them being chosen. It's a hook for unlockables later; everything is free for now, and there is no payment or account system.

Every role also has a built-in **trait**, always on:

| Role | Type | Trait | Upgrades | Capstone |
| --- | --- | --- | --- | --- |
| Sniper | Power | **Marksman:** arrows 10% faster and up to 20% more damage at long range; 10 less health | Railshot (Q/E) · Volley (Q/E: your next shot fires three arrows in quick succession, 65% damage and knockback each) · Recoil Shot *(new)* (Q/E: next shot knocks back 60% harder and throws you backward) · Steady Draw · Heavy Fletching *or* Longbow · Deadeye (more damage at range, after Longbow) · Piercing Shot · Railshot *(new)* (Q/E: next shot flies 80% faster, never slows and pierces every archer in its path) · Pin (also in the Ranger and Juggernaut trees; a full-draw hit that slams an enemy hard (380px/s or faster) into a wall or boulder within 0.45s pins them for 3s; a long slow slide doesn't count; nothing can move them while pinned, and they can't be pinned again for 4s after) · *Glass Cannon* | Ballista |
| Juggernaut | Power | **Heavyweight:** 15 more health, bigger body, 20% less knockback taken, heals 2 health a second after 4s unhurt; dashing into enemies shoves them 50% harder; arrows deal 20% less damage; 7% slower | Iron Stance (50% less knockback) · Vitality · Battering Ram · Riot Shield (head-on hits −35% damage, −30% knockback) · Deflect (Q/E: for 1s, head-on arrows bounce back at the shooter with 60% of their power) · Bull Rush *(new)* (Q/E: half-second charge along your aim, barely moved by hits, bulldozing enemies for 9 damage and a big shove) · Fortify *(new)* (Q/E, 11s: 3s of 70% less knockback and 30% less damage, 40% slower) · *Colossus* | Earthshaker (Q/E) |
| Ranger | Agility | **Light-footed:** 8% faster, dash recharges 20% quicker; 10 less health | Fleet Foot · Quick Dash · Double Dash · Second Wind *(new)* (Q/E: refill your dashes, 40% faster for 4s) · Volley (Q/E: also in the Sniper tree; next shot fires three arrows in quick succession, 65% damage and knockback each) · Spotter's Mark (Q/E: enemy nearest your cursor takes 30% more damage from everyone for 5s) · Seeker Arrow *(new)* (Q/E: next shot curves toward the nearest enemy ahead) · Quickshot · Sure Footing · *Featherweight* | Grapple (Q/E) |
| Trickster | Agility | **Nimble Fingers:** draws 12% faster; arrows knock back 10% less | Ricochet · Split Arrow · Curve Shot · Trick Shot *(new)* (Q/E: next shot bounces off walls and boulders up to 3 times, +25% damage and +10% knockback per bounce) · Boomerang *(new)* (Q/E: next shot goes out through enemies and comes back, hitting them again, with 25% more damage) · Smoke Bomb *(new)* (Q/E: a smoke cloud at your cursor for 5s; anyone inside is hidden from enemies outside it, bots included) · *Scattershot* | Arrow Rain (Q/E) |
| Warden | Utility | **Mender:** you and teammates nearby heal 2 health a second after 4 seconds unhurt; 5% slower | Rally · Bond · Shield Wall (Q/E) *or* Gust (Q/E) · Mending Totem *(new)* (Q/E: a totem at your feet heals you and teammates within 120px 8 health a second for 5s) · *Guardian's Oath* | Revive |
| Trapper | Utility | **Hunter:** abilities recharge 30% faster, +15% damage to rooted, stuck or frozen enemies | Thorned Tips · Harpoon *(new)* (Q/E: a barbed line along your aim, up to 420px, yanks the first enemy hard toward you and sticks them for 0.5s) · Snare Arrow (Q/E, 5s cooldown, roots 1.8s) · Bramble Trap (Q/E, woven at your cursor up to 380px away over half a second while you move at half speed, roots 2.2s) · *Bramble Coat* | Deep Roots |
| Assassin *(new)* | Agility | **Backstab:** arrows that hit an enemy from behind deal 40% more damage and knock back 30% harder | Coup de Grâce *(new)* (Q/E: next shot deals double damage to an enemy below 40% health) · Blink *(new)* (Q/E: reappear up to 220px toward your cursor, over pits and lava; doesn't break stealth) · Stealth (Q/E: vanish for 6s and move 30% faster; enemies see only a faint shimmer up close, and bots lose track of you; shooting, abilities, dashing or being hit by an arrow ends it, but burns, poison and blasts don't) · Ambush (draw 60% faster for 2.5s after stealth) · Shadow Dash (dashing keeps stealth; faster dash recharge while hidden) · Light Step (8% faster, 15% less damage from behind) · *Cloak and Dagger* | Death Mark (first hit after stealth: target takes 30% more damage from everyone for 5s) |
| Ninja *(new)* | Agility | **Shadowstep:** no bow: click to throw a shuriken instantly (hold to keep throwing, a little over 2 a second; 6 damage and light knockback up close, slowing down fast and hurting less the further it flies, about 300px; bullseye shuriken count as fully drawn for upgrades). Dash replaced by a very quick ~150px blink toward your cursor (a brief crouch, then a 0.1s streak with afterimages), 2 charges usable back to back, crosses pits and lava. 10 less health, 10% more knockback taken | Shadow Strike (Q/E: teleport behind the enemy nearest your cursor; next 3 shuriken within 1.5s deal 75% more damage) · Shadow Clone (Q/E: vanish for 1.5s and leave a clone that looks real to enemies and throws shuriken for 4s) · Death Blossom (Q/E: 12 shuriken in a ring) · Shadow Mark (Q/E: leave a mark, use again within 5s to snap back to it, even mid-fall) · Honed Stars (+25% shuriken damage) · Flurry (throw 30% faster) · Execution (any damage that leaves an enemy under 15% health knocks them out) · Swift Shadows · Third Step · Phase Step · *Long Step* | Shadow Dance (knockouts refill blinks and reset ability cooldowns) |
| Crossbowman *(new)* | Power | **Crank and Loose:** a crossbow, not a bow: click to fire a bolt at once (85% of a full draw, counts as fully drawn for upgrades), then 1.15s to reload; bolts drop after 480px. Takes 15% less damage from enemies and 15% less knockback. A faint ring shows your reach when you aim past it | Hair Trigger (Q/E: a 1s guard; block an arrow and go full auto for 2s at 50% damage) · Repeater (Q/E: load a bolt at once, then reload 3× as fast for 3s) · Scatter Bolts (Q/E: next shot is five bolts in a fan, 45% damage each) · Snare Arrow (Q/E, shared with Trapper) · Recoil Shot (Q/E, shared with Sniper) · Windlass (reload 25% faster) · Heavy Bolts (+20% knockback) · Point Blank (+30% damage within 220px) · *Long Stock* (40% more reach, 15% slower reload) | Double Crank (hold two bolts) |

Cards in *italics* are **trade-offs**: something big for a real cost.

**First pick = first ability:** every role has at least three Q/E abilities with no prerequisites. The opening pick before round 1 always offers three of them, so everyone starts with an ability they chose.

| Trade-off | Gain | Cost |
| --- | --- | --- |
| Permafrost | Frost slows by 70% for 4s | Draw 5% slower |
| Pyre | Burns hurt 50% more | Arrows knock back 20% less |
| Overload | Lightning does double damage | Dash recharges 30% slower |
| Potent Toxin | Poison hurts 50% more | Arrows deal 15% less direct damage |
| Glass Cannon | Arrows deal 30% more damage | 10 less health |
| Colossus | A third larger: 30 more health, 35% less knockback; dashes slam 40% harder for +6 damage; bigger arrows (easier to land) | Arrows fly 15% slower, you move 10% slower, much easier to hit |
| Featherweight | 15% faster, quicker build-up | Take 30% more knockback |
| Scattershot | Full draws fire three arrows in a fan | Each deals 40% of the damage and 45% of the knockback |
| Guardian's Oath | Teammates near you take 20% less damage | You take 10% more |
| Bramble Coat | Enemies who touch you are rooted for 1.4s | 5% slower |
| Obsidian | Arrows knock back 30% harder | Arrows fly 8% slower |
| Unstable Rift | Rifts 50% bigger | Arrows deal 8% less damage |
| Long Step | Blinks go 40% further | Take 15% more knockback |
| Lingering Dark | Shrouds last 5s | Arrows knock back 15% less |
| Cloak and Dagger | Stealth lasts 9s | 10 less health |

**Picks:**

- **When:** each player picks 1 of 3 cards drawn from their two trees once before round 1, then again after every round (not after every game). There's 15 seconds to choose (1/2/3 or click). If time runs out you get one of your three cards at random, and the game tells you which.
- **What unlocks:** what you pick decides what can come up next. Capstones appear once you've taken 2 other picks from that tree, and "or" options close each other off.
- **When a tree runs dry:** you're offered boost cards that stack (+15 health, +8% knockback, +8% draw speed, +5% speed).
- **Fairness:** picks are free and everyone gets the same number, so a team that's ahead can't snowball.
- **Abilities:** no path gives more than two, so Q and E never overflow.

### Callouts, streaks and empowerment

- **How you went down:** the death screen and kill feed say who got you and how. For example: "Bot Ada sniped you with a long shot (16 m)", "Bot Rex burnt you alive", "Bot Ada knocked you down a hole", or "You fell down a hole" when nobody knocked you. When you get a knockout, a line at the top says what you did.
- **Streaks:** 3, 5, 7 and 10 knockouts without going down get called out. Knocking out someone on a streak of 3 or more, or anyone empowered, is announced as a shutdown.
- **Clutch:** if you're your team's last archer against 2 or more enemies and your team goes on to win the game, the game summary leads with "Clutch! Tom won a 1v3".
- **Empowered:** 5 knockouts in a row empower you until you're knocked out. Knocking out an empowered enemy counts as 3 toward it. Pips in the bottom-left show your progress. You get a glowing aura in your element's colour and a chip in the bottom-left corner. What it does depends on your element:

| Element | Empowered buff |
| --- | --- |
| Frost | **Winter's Grip:** your 2nd frost hit freezes, even without Frostbite. |
| Flame | **Blaze:** you leave a trail of fire as you move, and every arrow sets the ground alight where it hits or lands, so it works at range too. |
| Storm | **Overcharge:** lightning arcs 2 extra times, and your dash recharges twice as fast. |
| Poison | **Plague:** a poison aura (the dashed circle around you, 110px, bigger for bigger archers) adds a stack to every enemy inside it 4 times a second; stacks keep hurting for 5 seconds after they leave. |
| Stone | **Landslide:** your arrows knock back 35% harder and stagger for twice as long. |
| Void | **Eclipse:** your rifts are 60% bigger and last a second longer. |
| Shadow | **Nightfall:** your bullseyes also shroud every other enemy within 220px of the target. |

**Achievements and titles:** 17 achievements (Blooded, Sharpshooter, Ringmaster, Pinmaster, Clutch, Lone Wolf, Legend, Champion and more), counted from your own games and saved in your browser. Each unlocks a title; pick one on the Achievements screen (main menu or in-game menu) and everyone sees it next to your name in the lobby and on the scoreboard. The list lives in `ACHIEVEMENTS` in `public/sim.js`.

**Kill replays:** when a knockout ends a game, you see it again zoomed in and in slow motion: the winner loosing the shot, the camera riding the arrow in, then the victim going down with a flash. It slows right down as the arrow lands. For hazard, burn or poison finishes it follows the victim. Then the game summary appears. It can't be skipped (Space used to skip it, which was easy to hit by accident while dashing); you can still turn replays off in the in-game menu. Games now pause 10 seconds between them (11.5 after a round) so there's time for both.

**Telling archers apart:** every archer wears their element as a coloured trim and an emblem on their back (snowflake, flame, bolt, drop, hexagon, swirl), and their role as gear: a Sniper's hood, Juggernaut shoulder plates, a Ranger's quiver, a Trickster's jester points, a Warden's shield, a Trapper's bramble coil, an Assassin's dark cowl. The lobby shows a preview of yours.

**Bow sounds:** a rising squeak as you start to draw, small creaks as the draw deepens, a low wooden click at full draw, and an occasional creak while you hold it. Loosing an arrow plays a string snap and pluck, a limb thrum and the arrow's whoosh. When an ability comes off cooldown you hear a bright rising "shing" and its slot flashes.

**Performance:** if frames run slow (often on high-resolution screens), the game quietly lowers its drawing resolution a notch, and raises it again when there's headroom.

**Seeing the shot:** while you draw, the guide line turns red just before a wall or boulder that would stop your arrow, with an X where it would hit. Your own archer has a soft spotlight, a bright ring and a marker above your name, and the screen edge flashes red when you're hit (and pulses when you're low on health).

**Sound:** each element has its own sound. Storm arcs crackle with electricity, frost chimes and cracks when it freezes, flame whooshes, and poison bubbles and hisses. While you're burning, poisoned or frozen, you'll hear it quietly in the background.

**Match stats:** the end screen shows awards for most knockouts, most damage, sharpest aim, most ring-outs and longest hit, plus a rankings table you can sort by any column. Damage is credited to whoever caused it, including hazards, burns and pit falls after your knockback.

**Capture powerups** (big hexagons) appear about every 30–40 seconds: **Deep Winter** freezes every enemy for 4s (bows for the first 2), **Thunderhead** strikes every enemy for 15, **Sanctuary** heals your team by 40. Stand inside for 3 seconds with no enemy inside to capture one. With both teams inside it's contested and nobody makes progress; an enemy standing in it alone first winds your progress back. Bots go for them too.

**Amber** comes from the centre line. Grabbing one gives an instant boost: +8 health, 0.5s off your dash and 1.5s off your abilities. Rerolls are gone. Amber is still counted (pickups 2, knockouts 2, plus 1 if a hazard finished them, round wins 3, surviving a round 1) and shows on the scoreboard and in match stats.

Bots take a role their team doesn't have yet, pick instantly and use their abilities. At the start of each match every bot also picks a **playstyle** and an aggression level:

- **Brawler:** gets in close and dash-bashes; takes Battering Ram, Iron Stance, Riot Shield and similar.
- **Skirmisher:** keeps to mid range; takes trick shots and mobility.
- **Marksman:** hangs back for full-draw long shots; takes Longbow, Deadeye, Ballista.
- **Guardian:** sticks with the team; takes Rally, Shield Wall, snares and traps.

The playstyle follows from the bot's role, with some surprises (an aggressive Ranger might brawl), and shifts as its picks line up: a bot that takes Battering Ram and Iron Stance turns into a brawler. Aggressive bots close in and bash more; cautious ones hang back and retreat when hurt. Bots aim like people: they take a moment to notice a new target (longer if it's behind them) and turn at a limited speed (easy 2.5, normal 3.5, hard 5.5, extreme 8 radians a second), and won't loose an arrow until they're lined up. The scoreboard shows each bot's playstyle.

## Balance data

Every finished game is recorded, with one row per archer: element, role, upgrades and boosts, whether their team won, whether they survived, knockouts, damage dealt and taken, shots and hits, ring-outs, whether they were empowered, and what knocked them out.

- **Practice games** are saved in your browser's storage (or the page's built-in storage, where the host provides one).
- **Online games** are appended to `data/games.jsonl` on your server (one JSON object per line; set `BOWFALL_DATA` to store it elsewhere). The server serves it to the game at `/api/balance`.
- **Simulated games:** `npm run simulate -- 20 2` (matches, team size) plays 20 bot-only 2v2 matches as fast as it can and adds them to the same file, tagged as simulated. Bots don't play like people, so treat this as a first pass.

Open **Balance data** from the main menu, the in-game menu or the end-of-match screen. It has tables for elements, roles, archetypes, upgrades, arenas and ways of being knocked out. You can filter by who played (everyone, people, bots, just you), arena, source and team size, and sort by any column.

- **Win %** comes with a ± margin (95%). Rows with fewer than 20 archer-games are greyed out, because with that little data the number is mostly noise.
- The **upgrades** table compares archers who had a card with archers of the same element or role who could have taken it but didn't.
- **Export CSV** or **Export JSON** saves the filtered rows. **Clear practice data** deletes the saved practice games; online data lives in the server file.

See `docs/balance-report.md` for the results of the 4v4 bot simulations and the changes they led to.

## Run it

You need Node.js 18 or newer.

```
npm install
npm start
```

Open http://localhost:3000 for the website, or http://localhost:3000/play for the game. In the game, **Play online → Host** creates a game; share its 4-letter code or link. People who join go to the smaller team, and anyone can switch in the lobby. If the room is full, a bot gives up its slot.

**Practice vs bots** runs entirely in the browser and doesn't need the server.

**Bot difficulty:** Easy, Normal, Hard and Extreme. In 0.9.0 every level moved down one: the old Easy is now Normal, the old Normal is Hard and the old Hard is Extreme, and there's a new, gentler Easy.

**Controls:** change any key (two per action) under **Controls** on the main screen or in the menu; they're saved in your browser. An Xbox or PlayStation controller works: left stick moves, right stick aims (the crosshair sits out from your archer in the stick's direction), right trigger draws, A or left trigger dashes, LB and RB are your abilities, Start opens the menu, and X, Y, B pick upgrade cards. Moving the mouse hands aiming back to it. Menus themselves still need the mouse.

**Rating:** online games between teams with a winner update an Elo rating for each signed-in player (start 1000, K 32 for the first 20 games then 20). Each side's strength is the average of its archers: accounts use their rating, guests 1000, bots 700/900/1100/1300 for Easy/Normal/Hard/Extreme. Each account also has a rating per role (worked out the same way, using their rating in the role they played), which the role boards rank by once someone has 10 games in the role. The calculation is in `lib/rating.js`.

**Name banners:** in online lobbies each name is a banner with the player's flag, rank badge and achievement count. Each achievement unlocks a border colour, which players pick in the Achievements screen. Accounts can only show borders they've earned on the server; guests' come from their browser, like titles.

**Flags and levels:** online, each player has a flag by their name, taken at first from where they're playing (looked up from their IP address with api.country.is, or the host's `cf-ipcountry` header if it's behind Cloudflare). Signed-in players can pick a different flag, or none, on their profile. Accounts also have a level from their career (10 xp a game, 15 a win, 4 a knockout, 2 a ring-out, 40 a match win; level L needs 40 × (L − 1)² xp) shown as a badge whose colour is the rank: Recruit, Bronze (5+), Silver (10+), Gold (15+), Platinum (20+), Diamond (30+), Master (45+). Flag pictures come from flagcdn.com, so they don't show in the offline copy.

**Version:** the game's version is on the main screen, in the menu and in the website footer, and every recorded game stores it. The Balance data screen can show only games from the current version.

## Playing with friends

See **HOSTING.md** for step-by-step instructions: a free tunnel from your own computer (quickest), a permanent free site on Render (`render.yaml` is included for one-click setup), or the same Wi-Fi.


- **Same Wi-Fi:** friends open `http://<your computer's local IP>:3000`. On Windows, `ipconfig` shows the IP. On a Mac, check System Settings > Network.
- **Over the internet:** deploy the folder to any Node host that supports WebSockets (Render, Railway, Fly.io and similar). Use `npm install` as the build command and `npm start` as the start command. The server reads the `PORT` environment variable. You can also forward port 3000 on your router.

Friends can join straight from a link, for example `https://your-host/play?room=ABCD`, or find public games in the games list.

## Files

| File | What it does |
| --- | --- |
| `public/sim.js` | The whole game: movement, arrows, hazards, teams, rounds, amber, archetypes, upgrade picks, bot AI. Shared by the server and browser. |
| `server.js` | Serves the website and game, the JSON API (accounts, profiles, leaderboard, games list, forum), and runs each room at 60 ticks per second with 30 snapshots per second. |
| `lib/db.js` | Storage: Postgres when `DATABASE_URL` is set, otherwise `data/db.json`. Users, sessions, forum. |
| `lib/auth.js` | Password hashing (scrypt), session tokens, name rules and rate limits. |
| `lib/oauth.js` | Google and Discord sign-in (OAuth 2.0 authorisation code flow). |
| `lib/level.js` | Account xp and level from a player's career. |
| `lib/rating.js` | Elo ratings, overall and per role, after each online game. |
| `lib/geo.js` | Rough country from an IP address, for the starting flag (cached; set `GEO_OFF=1` to turn it off). |
| `public/site.html` | The website: front page, games list, leaderboard, profiles, forum, sign in. |
| `public/index.html` | Client: menus, rendering, sound, HUD, pick screen. Online it smooths other players with 100 ms interpolation. |
| `build-offline.js` | `npm run build:offline` builds a single-file offline copy at `dist/bowfall-duels.html`: double-click it to play practice games with no server. |

## Tuning

Everything lives near the top of `public/sim.js`:

| Setting | What it controls |
| --- | --- |
| `MOVE` | movement feel |
| `ELEMENTS`, `ROLES`, `TREE`, `HONES` | archetypes, upgrades and boost cards |
| `AMBER_BOOST`, `CAP_PICKS`, `OFFER_SIZE` | what an amber pickup gives, picks needed before a capstone, cards per pick |
| `OPTIONS` | custom rules and their values (the first value of each is the default) |
| `STYLES`, `ROLE_STYLE` | bot playstyles |
| `AMBER` | amber rewards |
| `EMPOWER_AT`, `EMPOWER_BONUS`, `EMPOWER` | streak needed to empower, what an empowered knockout is worth, and each element's buff |
| `ROLES[...].trait` and `applyStats()` | role traits and trade-off numbers |
| `CRACK_WARN`, `MAPS.beach.cracks` | tide warning time, and when each patch of Tide Cove floods |
| `TIMES` | countdown, game length, pause lengths, pick timer |
| `pointsToWin`, `gamesToWin` in `createWorld()` | match and round length |
| `DIFF` | bot skill |
| `MAPS` | arena layouts (you define one half; the other is mirrored automatically) |


## Known limits

- The server has final say on every hit. Your own archer is drawn from the newest server state and not predicted locally, so movement feels best under about 80 ms ping.
- Rooms live in memory, so restarting the server ends every match.

**Bots (latest):** bots now see you with a reaction-time lag (about 0.17s on hard, 0.24s normal, 0.32s easy): they aim at where you *appeared* to be and to be heading, so a well-timed dash throws them off. Stealthed bots circle round to strike from behind, picking the side that throws you into the nearest pit, lava or wall. Bramble traps (and traps being woven) are now visible to everyone.
