# Bowfall

Version 0.14.1. See [CHANGELOG.md](CHANGELOG.md) for what changed in each version.

Top-down knockback archery for teams, with a website, accounts and a forum: Red vs Blue, up to 4 per side, humans and bots mixed however you like, across eight arenas. The main menu has a **How to play** screen (also in the in-game menu) that explains everything below.

## Website, accounts and games list

Run the server and open its address: `/` is the website and `/play` is the game.

- **Website:** a front page with open games and recent forum threads, a **Games** list, a **Leaderboard** (game wins, knockouts, match wins, games played, ring-outs, bullseyes), player **profiles** and a **Forum**.
- **Accounts:** sign up with a name (3-16 letters, numbers, _ or -), an email and a password. The email is private and only used for **Forgot your password?**, which emails a one-use link that lasts an hour (sent through Resend; see HOSTING.md). Older accounts can add an email on their profile. Passwords are stored as salted scrypt hashes; sessions are an HttpOnly cookie that lasts 30 days. Signed-in players always play under their account name, and guests can't use a registered name (they get a `~` added).
- **Google and Discord sign-in:** "Continue with Google" and "Continue with Discord" appear once the server has each service's client ID and secret (see HOSTING.md). First-timers pick a player name; existing players can link either on their profile, add or change a password there, and unlink one as long as another way to sign in remains. The server keeps only the service's user ID, no email address.
- **Profiles:** each player's page shows their 1v1 and team ratings and career totals, plus:
  - **Playstyle:** how they play compared with everyone with 10 or more games, as "top X%" bars. The measures are damage per game, accuracy, games survived, damage taken (evasive), knockouts, assists, share of knockouts into hazards and share of their team's damage (carry). Their strongest two traits make their headline style.
  - **Recent ranked matches:** the last 10, with mode, result, score, K / D / A, archetype, rating change and when.
  - **Achievements:** each with its tier and how rare it is.

  The server records all of this itself from the games, so none of it can be faked from the browser.
- **Hosting a game:** in the game, **Play online → Host**: give it a name, choose **Public** (shown in the games list on the site and in the game) or **Private** (join by code only), and optionally a **password**. The host can change all three in the lobby. Joining a game with a password asks for it.
- **Forum:** categories for News (admins only), General, Builds and tactics, Looking for a game, Bugs and Ideas. Signed-in players can start threads and reply; you can delete your own posts. Admins can pin, lock and delete threads and delete any post. There is one admin: the account named **Tom** (change it with the `ADMIN_NAME` setting). Every other account loses admin when the server starts.
- **Database:** with `DATABASE_URL` set the server uses Postgres (see HOSTING.md for a free one). Without it, everything is kept in `data/db.json`, which is fine on your own computer but is wiped whenever a free host restarts.

## Lobby

Every match starts in a lobby with a Red column and a Blue column:

- **Everyone:** pick your team. Online, whoever creates the room starts on Red; everyone else arrives in the **Unassigned** section and joins a team from there (or moves back to it).
- **Chat (online):** a chat box in the lobby; in game press **Enter** to type, Enter to send, Esc to cancel. Messages fade out over the arena. Joins, leaves and host changes show up there too.
- **Joining mid-match (online):** you spectate (the whole arena, scores and chat) until the current game ends, then a bar at the bottom lets you join Red or Blue for the next game, with as many upgrade picks as everyone else. A full team lets you in by replacing one of its bots.
- **Choosing upgrades:** the next round starts as soon as every player has picked, or when the timer runs out (anyone who hasn't picked gets one of their three cards at random). The pick screen shows who you're waiting for.
- **Host only:** add or remove bots on either side, choose the arena, bot skill and **custom rules**, then start once both teams have at least one archer.
- **Handicap:** the host can step any archer's handicap down or up with − and + (in the lobby or the in-game menu), in 10% steps from −50% to +100%. It scales that archer's health and arrow damage by the percentage, and their knockback resistance by half as much. Handy for uneven teams like 1v2. Games with a handicap are left out of Balance data unless you choose "Any rules".
- **Map effects:** each match can roll one, shown in the lobby (and the ranked draft) before anyone picks, and as a chip under the round in play: **Warden's Vigil** (every archer heals 2.5 health a second), **Gale Winds** (everyone moves and shoots 20% faster), **Juggernaut's Hide** (30% less damage from arrows) and **Bounty Hunt** (power-ups about twice as often, up to three at once, all over the arena). About one match in five has none. The host can pick one, or none, under Custom rules (Map effect). Tutorial, training and Strongholds never have one. They're `MUTATORS` in `public/sim.js`.
- **Custom rules:** archer size (small, medium, large); **sliders** for arrow speed (70–130%), move speed (50–150%), knockback (40–160%), health (50–150%) and arrow damage (50–200%), each a percentage of the standard with 100% in the middle (a Standard button puts one back); dashes (on or off; off also stops Ninja blinks) arrow homing (none, tiny, small, medium, heavy, extreme: every shot bends toward the enemy it is heading for), movement feel (snappy, the standard; glide, an air-hockey feel; drifty; direct, with no glide at all: top speed is the same in all four, only how quickly you get going, turn and stop changes) and upgrades (on, or off: no picks between rounds). The host can also take any elements and roles out of a custom game (Alt+click one on the pickers, or Y on a controller); bots avoid them too. The standard rules are large archers and 100% on every slider, with the snappy feel. (To change the standard pace, change a slider's `base` in `OPTIONS`: 100% always means the standard. Since 0.39.0 the standard move speed is what used to be "slow" and knockback is about 13% lower than before.) Ranked matches always use the standard rules: they have no host, so nothing can be changed. Every recorded game notes its rules, and Balance data shows standard-rules games only unless you ask for all.
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
| The Pitch | A football pitch. The only hazards are the two goals, which are drops: get knocked into one and you are out. A ball sits in the centre: shoot it or run into it to send it flying, and it deals damage and a big shove to anyone it hits (harder the faster it goes), bouncing off walls, boulders and archers. A ball that goes in a goal comes back to the centre after a moment. |
| Sawmill | A plank yard with two saw blades racing along their tracks. Touching one deals 10 damage and throws you hard (they count as a hazard for kill credit). A deep mill pond and a mud patch. |
| Sideline Sawmill | One huge boulder in the middle to fight round, and saw blades racing along both sidelines: get knocked wide and you meet a blade. A mill pond and a mud patch on each side. |
| Harvest Field | A farm field at harvest time. Round hay bales give cover in lanes, an old well on each side and the duck ponds are deep, and the mud in the middle slows you right down. |
| Highland Reach | At dusk, lit by campfires and lanterns. Cover sits by the outer walls, leaving the middle open for long shots. Bigger than the others (1500 × 960) and built for long shots: a canyon splits the middle, crossed only in the centre, with drops along the top and bottom edges and a pool in front of each side's crossing. |

Mushroom Grove, Portal Ruins and Frozen Lake are out of the rotation for now (`retired` in `public/sim.js`); player-made arenas can still use their looks and gates.

To add an arena, add an entry to `MAPS` in `public/sim.js`: hazards, boulders, thorn strips, powerup spots, amber range, an optional `heal` zone, optional `ice` physics, optional `cracks` (hazards that appear `at` a number of seconds into each game), and optional moving parts: `saws`, `bumpers`, `portals`, `wind` and a `ball`. Then give it a colour theme in `THEMES` in `public/index.html`. Arenas marked `hidden` (the two training grounds) are left out of the map lists.

## How a match works

A match is made of rounds, and a round is made of games:

- **Game:** there are no respawns. The last team with anyone standing wins the game. A game lasts at most 2 minutes; when time runs out, the team with more archers alive wins, then the team with more total health.
- **Between games:** a summary picks out what happened, one praise at a time, least impressive first, each with a sound that fits, so the best lands last: who's carrying, flawless wins, clutches, close calls, sharpshooters, ring-out specialists, top damage and first blood.
- **Round:** best of three games: the first team to win 2 takes the round and scores 1 point.
- **Match:** the first team to 3 points wins, or 5 if the host sets it in the lobby. The end screen stays up until the host starts a rematch or returns to the lobby.
- **Drawing:** an arrow needs at least a quarter draw to leave the bow, and after each shot the bow takes 0.3 seconds to nock the next arrow (0.45 for a Sniper), so tapping out quick arrows is no longer worthwhile: their damage and knockback also grow more steeply with the draw. Ninjas (shuriken) and Crossbowmen (bolts) aren't affected. A spark and a click mark the moment your draw is full.
- **Critical hits** aren't random. An arrow whose path runs through the middle of the target (the centre 40% of its body) is a **bullseye** and deals 1.5× damage. A full draw no longer crits on its own; it flies faster, hits harder, and triggers the "fully drawn" upgrades.
- **Bogs:** you can't dash out of a bog (Sure Footing can).
- **Kill credit:** knocking someone into a pit, lava, spikes or a wall counts as your knockout if you hit them in the last 5 seconds.
- **Dash:** goes the way you're moving, or where you're aiming if you pick that under Controls (standing still, it always goes where you aim). It jumps pits and lava.
- **Friendly fire:** arrows, explosions and dash-shoves pass through teammates.

### Archetypes and upgrades

Every archer is one **Element** plus one **Role**, chosen in the lobby. Together they make your archetype, like Frost Sniper, Poison Juggernaut or Storm Trickster. Everyone can see each other's archetype on the team lists and scoreboard.

| Elements | Base effect (active from round 1) | Upgrades |
| --- | --- | --- |
| Frost | Hits slow by 50% for 3s (slowed archers also dash more slowly, over the same distance), and your arrows deal 30% more damage to slowed or frozen targets | Frostbite (3rd hit within 6s freezes for 2s) · Deep Freeze (frozen enemies can't draw for 3s) · Shatter (slowed enemies fly further) · *Permafrost* |
| Flame | Hits burn for 2s (5 damage a second) | Wildfire (burning ground) · Flashpoint (a hit on a burning enemy bursts into flame: 4 damage to everyone within 110px, setting them alight) · Kindling (burning enemies take 50% more knockback from you) |
| Storm | Hits arc to a nearby enemy (arcs hurt but don't knock back). With nobody to arc to, the arc hits the target again for 3 extra damage, so storm still works in a 1v1 | Static (locks their dash) · Forked Lightning (arcs chain on up to 4 times and reach 220px) · Echo Strike (a bullseye storm hit arcs again 0.5s later) · *Overload* |
| Poison | Stacking poison (up to 3); poisoned enemies heal half as fast | Toxic Cloud · Virulent (5 stacks, stronger) · Contagion (spreads to nearby teammates every 1.5s) · *Potent Toxin* |
| Stone *(new)* | Hits **stagger** for 2s: the target loses 40% of their current draw and takes 15% more knockback | Boulder Arrows (full draws +30% knockback) · Aftershock (full-draw hits shove every other enemy nearby away) · Petrify (staggered enemies can't dash) · *Obsidian* |
| Void *(new)* | A moment after a **fully drawn hit** (or any bullseye), a **rift** opens where the target lands; for 2s it pulls them and every enemy nearby toward its centre and slows them 30% | Event Horizon (30% bigger, stronger, 2.8s) · Collapse (rifts burst outward when they end) · Null Field (no dashing inside your rifts) · *Unstable Rift* |
| Blood *(new)* | Every bit of damage you deal **heals you for 25%** of it, and the more health you've lost the harder your arrows knock back (up to +25% near death) | Hemorrhage (full-draw hits make the target bleed 2/s for 4s, which heals you too) · Frenzy (double healing below half health, and up to 60% faster draws the more health you've lost) · Transfusion (healing past full goes to your most hurt teammate within 300px) · *Blood Pact* (45% lifesteal, 10 less max health) |
| Shadow *(new)* | Every hit adds a **shade** (up to 5) and restarts a 3s fuse (shades clear each game); when it runs out the shade bursts for 2, 6, 12, 20 or 31 damage by stack, and the target darkens as they stack | Eclipse (Q/E, 14s: darkness on the spot under your cursor for 4s; enemies inside can only see 140px around themselves) · Creeping Dark (6% slower per shade, and bursts slow 50% for 2s) · Night Terror (bursts throw the target away from you, harder with more shades) · *Deep Shade* |

Your team's fire, poison clouds and rifts are drawn faint with a dashed ring in your team colour; the enemy's are full strength.

**Premium content and the Store:** Stone, Void, Shadow and Blood (elements) and Assassin, Ninja and Crossbowman (roles) are tagged `premium` in `public/sim.js`; everything else is free for everyone. Accounts earn **Crests** in ranked games and in custom games without bots (8 a game, 16 for a win; 25 a match, 50 for a win; 100 extra for the first match win each day), 40 for every achievement tier, and 50/100/200 the first time they reach B/A/S in each training drill. A premium element or role costs 12,000 Crests (around fifteen hours of play: meant to be a grind, so an unlock means something) or £2.49. Each week one premium element or role is free for everyone, an element one week and a role the next (the owner can pin others). **Locks apply in online games (ranked and custom), and only while the owner has them switched on** (`/locks on`); practice against bots and training always have everything, for trying things out. Until then everything is free, and anything unlocked stays unlocked. The rules are in `lib/economy.js`.

**Supporters, Founders and Patrons** (all cosmetic; no advantage in ranked): **Supporter** is a monthly membership (£4): an emblem by your name in lobbies, games, chat, leaderboards and on the website, bronze to silver (3 months), gold (6) and diamond (12) as the months add up (they keep counting across breaks); the animated **Aurora** banner finish; 1,000 Crests each paid month and 25% more Crests from games. The **Founder pack** (£15, once, while the owner keeps it on sale) unlocks every element and role for good, with a Founder emblem that is never sold again, the **Founder** banner finish and 2,000 Crests. A **donation** of any amount (£1 to £200) gives the Patron heart and the **Patron rose** finish. Payments go through Stripe Checkout (`lib/pay.js`); see HOSTING.md to switch them on. The main screen's **Store** shows Crests, unlocks and the three offers.

**Strongholds (preview)** (in Custom games): a big map with four NPC-held castles to capture, a following camera with zoom, a minimap and a shared camera for players on one screen. Practice only for now; see `docs/strongholds.md`.

**Arena builder** (in Custom games): draw the left half of an arena and the right half copies it, turned round. Place sinkholes and water (round or square), lava, bogs, boulders, mushrooms, gates and thorn strips along the edge, pick a look (any arena's theme) and whether there's a football. Drag to move, scroll or use the sliders to resize, Delete to remove, Ctrl+Z to undo. Every change is checked (`Sim.cleanArena`): at most 12 hazards, 8 boulders, 4 mushrooms, 4 thorn strips and 2 gates a side; sizes capped; the spawn points kept clear; under 40% pits and lava; and both teams able to walk to each other with no cut-off areas. **Test vs bots** plays it in the browser. Saved arenas get a share code (like `A1F`): free accounts keep 3, supporters and founders 25; without an account (or offline) 3 are kept in the browser. The host of a custom game can type a code under **Player arena** in the lobby. Supporters can publish arenas to the **Community** tab, where anyone can open them by code, like them and play them. The owner can feature an arena (`/feature A1F`) or put it in the ranked map pool (`/feature A1F ranked`). Arenas are stored in the database (`arenas` table) and registered with the simulation as `a<id>`.

Every role also has a built-in **trait**, always on:

| Role | Type | Trait | Upgrades | Capstone |
| --- | --- | --- | --- | --- |
| Sniper | Power | **Marksman:** arrows 25% faster and up to 25% more damage at long range; a longer pause between shots; 10 less health | Railshot (Q/E, 11s: next shot flies 80% faster, never slows, pierces everyone and deals 35% more damage and 30% more knockback) · Volley (Q/E: your next shot fires three arrows in quick succession, 65% damage and knockback each) · Recoil Shot *(new)* (Q/E: next shot knocks back 60% harder and throws you backward) · Steady Draw · Heavy Fletching *or* Longbow · Deadeye (more damage at range, after Longbow) · Piercing Shot · Railshot *(new)* (Q/E: next shot flies 80% faster, never slows and pierces every archer in its path) · Hold the Line (hits on enemies within 250px knock back 50% harder) · Pin (also in the Ranger and Juggernaut trees; a full-draw hit that slams an enemy hard (380px/s or faster) into a wall or boulder within 0.45s pins them for 3s; a long slow slide doesn't count; nothing can move them while pinned, and they can't be pinned again for 4s after) · *Glass Cannon* | Ballista |
| Juggernaut | Power | **Heavyweight:** 15 more health, bigger body, 20% less knockback taken, heals 2 health a second after 4s unhurt; dashing into enemies shoves them 50% harder; arrows deal 20% less damage; 7% slower | Iron Stance (50% less knockback) · Vitality · Battering Ram · Riot Shield (head-on hits −35% damage, −30% knockback) · Deflect (Q/E: for 1s, head-on arrows bounce back at the shooter with 60% of their power) · Bull Rush *(new)* (Q/E: half-second charge along your aim, barely moved by hits, bulldozing enemies for 9 damage and a big shove) · Fortify *(new)* (Q/E, 11s: 3s of 70% less knockback and 30% less damage, 40% slower) · *Colossus* · Firework *(new, also Trickster and Crossbowman)* (Q/E, 14s: next shot is a big, very slow firework, slower than a running archer, that follows the enemy nearest your line of fire and bursts where it lands or after 5 seconds, shoving everyone nearby; light damage) | Earthshaker (Q/E) |
| Ranger | Agility | **Light-footed:** 5% faster, dash recharges 15% quicker; 10 less health | Fleet Foot (10% faster, reaches full speed and turns about twice as quickly) · Quick Dash (35% faster recharge) · Momentum (for 0.6s after a dash, arrows fly 30% faster and hit 20% harder) · Parry (Q/E, 7s: a 0.6s guard; block an arrow and your next shot is drawn instantly) · Volley (Q/E: also in the Sniper tree; next shot fires three arrows in quick succession, 65% damage and knockback each) · Spotter's Mark (Q/E: enemy nearest your cursor takes 30% more damage from everyone for 5s) · Seeker Arrow *(new)* (Q/E: next shot curves toward the nearest enemy ahead) · Quickshot · Sure Footing · *Featherweight* | Grapple (Q/E) |
| Trickster | Agility | **Nimble Fingers:** draws 12% faster; arrows knock back 10% less | Ricochet · Split Arrow · Bank Shot (one more bounce, and arrows that bounced deal 40% more damage and knockback) · Trick Shot *(new)* (Q/E: next shot bounces off walls and boulders up to 3 times, +25% damage and +10% knockback per bounce) · Boomerang (Q/E, 7s: your next shot is a wide spinning boomerang that flies straight out through enemies, slower than an arrow and faster the longer you draw, until it touches a wall or boulder, then homes back to you, hitting everyone again for 50% more; it carries your element; catching it halves the cooldown) · Smoke Bomb *(new)* (Q/E: a 120px smoke cloud where you stand for 5s; anyone inside is hidden from enemies outside it, bots included) · *Scattershot* | Arrow Rain (Q/E) |
| Warden | Utility | **Mender:** you and teammates nearby heal 3 health a second after 3 seconds unhurt; 10 more health and about 17% less knockback | Rally (you and teammates within 170px move 20% faster; shown as a green aura) · Bond (you and teammates nearby) · Mend (Q/E, 12s: heal the most hurt teammate within 350px, or yourself, for 25) · Shield Wall (Q/E) *or* Gust (Q/E, 8s: a wide cone that shoves hard and blows enemy arrows out of the air) · Mending Totem *(new)* (Q/E: a totem at your feet heals you and teammates within 120px 8 health a second for 5s) · *Guardian's Oath* | Revive |
| Trapper | Utility | **Hunter:** abilities recharge 40% faster; hits on rooted, stuck or frozen enemies deal 25% more damage and knock back 30% harder | Thorned Tips · Harpoon *(new)* (Q/E: a barbed line along your aim, up to 420px, yanks the first enemy hard toward you for 6 damage and sticks them for 0.9s) · Snare Arrow (Q/E, 5s cooldown, roots 1.8s) · Bramble Trap (Q/E, 8.5s cooldown, woven at your cursor up to 450px away over half a second while you move at half speed, roots 2.5s) · Bramble Toss (Q/E, 9s: your next shot tosses a spinning bramble trap, the same size as a Bramble Trap, that flies slowly along your aim, further the longer you draw, up to 760px, rooting everyone it passes through for 1.8s (8 damage); a faint band shows its path) · Rip (Q/E, 8s: your hits leave thorns, up to 5, cleared each game; vines reach out and a second later tear them out toward you for 5 damage each, rooting anyone with 2 or more) | Deep Roots |
| Assassin *(new)* | Agility | **Backstab:** arrows that hit an enemy from behind deal 40% more damage and knock back 30% harder; 10 less health | Coup de Grâce *(new)* (Q/E: next shot deals double damage to an enemy below 40% health) · Blink *(new)* (Q/E, 8s: reappear up to 220px toward your cursor, over pits and lava; doesn't break stealth) · Stealth (Q/E: vanish for 6s and move 30% faster; enemies see only a faint shimmer up close, and bots lose track of you; shooting, abilities, dashing or being hit by an arrow ends it, but burns, poison and blasts don't) · Ambush (draw 60% faster for 2.5s after stealth) · Shadow Dash (dashing keeps stealth; faster dash recharge while hidden) · Light Step (8% faster, 15% less damage from behind) · *Cloak and Dagger* | Death Mark (first hit after stealth: target takes 30% more damage from everyone for 5s) |
| Ninja *(new)* | Agility | **Shadowstep:** no bow: hold to wind up a shuriken and let go to throw it (full wind-up in 0.42s; up to 8.5 damage, and a longer wind-up flies faster and further, about 300px at full; it slows down fast and hurts less the further it flies; a full wind-up or a bullseye counts as fully drawn for upgrades). Dash replaced by a very quick ~150px blink toward your cursor (a brief crouch, then a 0.1s streak with afterimages) that recharges in under a second and crosses pits and lava. 10 less health, 10% more knockback taken | Shadow Strike (Q/E: teleport behind the enemy nearest your cursor; next 3 shuriken within 1.5s deal 75% more damage) · Shadow Clone (Q/E: vanish for 1.5s and leave a clone that looks real to enemies and throws shuriken for 4s) · Death Blossom (Q/E: 12 shuriken in a ring) · Shadow Mark (Q/E: leave a mark, use again within 5s to snap back to it, even mid-fall) · Honed Stars (+25% shuriken damage) · Flurry (wind up 30% faster) · Execution (any damage that leaves an enemy under 15% health knocks them out) · Swift Shadows · Echo Step (within 1.2s of a blink, dash again to blink back to where you started, free) · Phase Step · *Long Step* | Shadow Dance (knockouts refill blinks and reset ability cooldowns) |
| Crossbowman *(new)* | Power | **Crank and Loose:** a crossbow, not a bow: click to fire a bolt at once (85% of a full draw, counts as fully drawn for upgrades), then 1.15s to reload; bolts drop after 480px. Takes 15% less damage from enemies and 15% less knockback. A faint ring shows your reach when you aim past it | Hair Trigger (Q/E: a 1s guard; block an arrow and go full auto for 2s at 50% damage) · Repeater (Q/E: load a bolt at once, then reload 3× as fast for 3s) · Scatter Bolts (Q/E: next shot is five bolts in a fan, 45% damage each) · Snare Arrow (Q/E, shared with Trapper) · Recoil Shot (Q/E, shared with Sniper) · Windlass (reload 25% faster) · Triple Bolt *(new, trade-off)* (each shot is a burst of three bolts at 45% damage and 50% knockback each; reload 50% slower) · Heavy Bolts (+20% knockback) · Point Blank (+30% damage within 220px) · *Long Stock* (40% more reach, 15% slower reload) | Double Crank (hold two bolts) |

Cards in *italics* are **trade-offs**: something big for a real cost.

**First pick = first ability:** every role has at least three Q/E abilities with no prerequisites. The opening pick before round 1 always offers three of them, so everyone starts with an ability they chose.

| Trade-off | Gain | Cost |
| --- | --- | --- |
| Permafrost | Frost slows by 70% for 4s | Draw 5% slower |
| Overload | Lightning does double damage | Dash recharges 30% slower |
| Potent Toxin | Poison hurts 50% more | Arrows deal 15% less direct damage |
| Glass Cannon | Arrows deal 30% more damage | 10 less health |
| Colossus | A third larger: 30 more health, 35% less knockback; dashes slam 40% harder for +6 damage; bigger arrows (easier to land) | Arrows fly 15% slower, you move 10% slower, much easier to hit |
| Featherweight | 15% faster, quicker build-up | Take 30% more knockback |
| Scattershot | Full draws fire three arrows in a fan | Each deals 40% of the damage and 45% of the knockback |
| Guardian's Oath | Teammates near you take 20% less damage | You take 10% more |
| Obsidian | Arrows knock back 30% harder | Arrows fly 8% slower |
| Unstable Rift | Rifts 50% bigger | Arrows deal 8% less damage |
| Long Step | Blinks go 40% further | Take 15% more knockback |
| Deep Shade | Shade bursts deal 50% more damage | Arrows knock back 15% less |
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
| Blood | **Bloodbath:** double healing, and teammates within 220px heal 20% of the damage you deal. |
| Shadow | **Nightfall:** every hit adds two shades instead of one. |

**Achievements and titles:** 18 challenges, each with five tiers (Bronze, Silver, Gold, Platinum and Diamond). Examples:
- **On Fire:** win 3, 5, 10, 15 or 25 matches in a row.
- **Untouchable:** win 3 to 25 games in a row without being knocked out.
- **Sharpshooter:** hit 60% to 100% of your shots in a game.
- **Damage Dealer:** top damage on your team.
- **Giant Slayer:** beat a team rated 150 or more above yours.
- **Flawless:** win a match without dropping a game.

Some are totals (knockouts, pins, revives), since sheer volume is a virtue too. They only count in ranked games and in custom games with no bots, so they can't be farmed. The server keeps them for accounts and guests, and every 10 minutes works out what share of players has reached each tier ("Top 3%"). Each started achievement is a title and a border to wear. The list is `ACHIEVEMENTS` in `public/sim.js`.

**Kill replays:** when a knockout ends a game, you see it again zoomed in and in slow motion: the winner loosing the shot, the camera riding the arrow in, then the victim going down with a flash. It slows right down as the arrow lands. For hazard, burn or poison finishes it follows the victim. Then the game summary appears. It can't be skipped (Space used to skip it, which was easy to hit by accident while dashing); you can still turn replays off in the in-game menu. Games now pause 10 seconds between them (11.5 after a round) so there's time for both.

**Telling archers apart:** every archer wears their element as a coloured trim and an emblem on their back (snowflake, flame, bolt, drop, hexagon, swirl), and their role as gear: a Sniper's hood, Juggernaut shoulder plates, a Ranger's quiver, a Trickster's jester points, a Warden's shield, a Trapper's bramble coil, an Assassin's dark cowl. The lobby shows a preview of yours.

**Bow sounds:** a rising squeak as you start to draw, small creaks as the draw deepens, a low wooden click at full draw, and an occasional creak while you hold it. Loosing an arrow plays a string snap and pluck, a limb thrum and the arrow's whoosh. When an ability comes off cooldown you hear a bright rising "shing" and its slot flashes.

**Performance:** if frames run slow (often on high-resolution screens), the game quietly lowers its drawing resolution a notch, and raises it again when there's headroom.

**Seeing the shot:** while you draw, the guide line turns red just before a wall or boulder that would stop your arrow, with an X where it would hit. Your own archer has a soft spotlight, a bright ring and a marker above your name, and the screen edge flashes red when you're hit (and pulses when you're low on health).

**Sound:** each element has its own sound. Storm arcs crackle with electricity, frost chimes and cracks when it freezes, flame whooshes, and poison bubbles and hisses. While you're burning, poisoned or frozen, you'll hear it quietly in the background.

**Deciding round and Last Arrow:** when both teams are one round from the match the round is announced as the *Deciding round*, and when both are also one game from it, that game is the *Last Arrow*.

**Performance recording:** press F9 (or Options → Performance recording) to record how long each part of the game takes; F9 again saves a `.json` file. `node tools/perf-report.js <file>` summarises one.

**Accounts:** sign up with a name, password and email, or with Google or Discord (set-up in HOSTING.md). On the website profile, under Signing in: link or unlink Google and Discord, add or change a password (signs out other devices), change your email (the old address is told), or delete the account. "Forgot your password?" emails a one-hour link. Privacy and Terms pages are at `/#/privacy` and `/#/terms`.

**Clans:** start or join a clan from the button beside your profile on the main menu. Its emblem (designed by the leader: shape, pattern, symbol or letter and four colours, on a transparent back) and tag show before your name on your banner. A clan has a leader, officers and up to 30 members, and a rating of its own that moves when a whole ranked team (two or more players) is from the clan; the best clans are on the leaderboards. Owner command: `/clan disband <tag>`.

**Match over:** a headline in the winner's colour (Victory or Defeat in ranked), the winning archers, awards for most knockouts, most damage, sharpest aim, most ring-outs and longest hit, and a rankings table you can sort by any column (knockouts, damage, accuracy, ring-outs, longest hit, times out). Your rating counts up or down to its new value, and level, mastery and Crest bars fill with a chime. Damage is credited to whoever caused it, including hazards, burns and pit falls after your knockback.

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

**Bot difficulty:** Easy, Normal, Hard, Extreme and Master. In a custom game the host can set each bot's skill from the list next to it; the Bot skill setting changes them all at once. Easy to Extreme differ in reflexes: aim, reaction time, dodging and turning. Master adds a smarter brain (`botPlan` and friends in `public/sim.js`):
- **Positioning:** several times a second it scores the spots around it. It avoids anywhere an enemy's shot could knock it into a hazard, and looks for spots where its own shot would knock the target into one, at the right range with a clear line and near pickups.
- **Aim:** it works out exactly where a shot will meet a moving target, allowing for the arrow slowing down.
- **Dodging:** it reads incoming arrows further ahead and steps to the safer side, dashing only when a step won't clear it.
- **Targets and upgrades:** it picks targets it can knock into something, and chooses upgrades from values learned over about 7,800 bot games.

In testing Master won 82% of games against Extreme, and each lower level wins roughly 66 to 78% of games against the level below. Any skill between the levels can be blended with `skillParams(0..1)`, which is how matchmaking's AI players get their own skill.

**Find game (matchmaking):** signed-in players add friends by name, see who's online, and invite up to two friends to a party. Party members press **Ready** (the leader hears a chime and sees who's ready), and once everyone is, the party leader chooses 1v1, 2v2 or 3v3 and searches. Matches are made by rating: the gap allowed starts at 120 and widens by 30 a second. If nobody suitable turns up within 20 seconds, the empty places go to **AI players**. There are 69 of them, each an account with its own name, flag (including Russian and Ukrainian players), rating, skill, a main archetype and a few favourites, playstyle, aggression, and a personality with its own chat lines (`lib/ai-chat.js`); some chat a lot, some hardly at all. They talk at moments that call for it (first blood, streaks, walking into a hazard, clutches, deciding rounds, close or one-sided finishes), answer greetings, gg, "nice shot", "ez" and "are you a bot?", avoid repeating recent lines, take a moment to type, and shorten people's names the way a person would. They come from `lib/ai-players.json`, made by `node tools/seed-ai.js`, which plays them against each other for 1,400 matches so their ratings settle naturally, then sizes their careers to their ratings (`lib/ai-scale.js`: the better the rating, the more games and the higher the level, with the achievements someone with that record would have). `node tools/rescale-ai.js` redoes that sizing on the saved list and adds any new names without re-running the simulation. They're created on the server's first start; when the list is re-sized (`SEED_V`) or gains players, the server updates the existing accounts on its next start, keeping the ratings they've earned. They're rated like everyone else, appear on the leaderboards marked **AI**, and are shown as AI in games. Guests can search too, but aren't rated. Matches are private rooms reached with one-time tickets. The arena is picked when the match is made, from everyone's **arena preferences** (on Find game: click a favourite, right-click one to avoid): each player puts in their favourite, or "any" if they have none or someone else avoids it, one is drawn, and "any" becomes a random arena nobody avoids. Once everyone's arrived (or after 15 seconds) there's a 25-second **draft**: everyone picks an element and role for that arena, and the match starts when all are ready or the time runs out. After the match, **Back to Find game** returns you to your party; the leader can search again once everyone in the party is back from the game. The code is in `lib/social.js`.

**Ranked tiers and seasons:** your 1v1 and team ratings each put you in a tier: Bronze (under 700), Silver (700), Gold (900), Platinum (1100), Diamond (1300), Master (1500) and Champion (1700), each but Champion split into III, II and I. Until your 5 placement matches are done you're Unranked. The tier shows on Find game (with how far it is to the next division and the season's days left), after each ranked match ("Promoted to Gold II"), on party rows, the leaderboards and profiles. Seasons last three months, starting on the first of January, April, July and October (UTC); season 1 is the one running when the server first started with seasons. At the end of a season everyone's peak tier is recorded on their profile, accounts get Crests for it (100 for Bronze up to 1,500 for Champion), ratings are softened toward 900 (40% of the distance is taken off) and the first 3 matches of the new season are placements. `lib/season.js`; owner command `/season` (or `/season end` to end it now).

**Rejoining:** if you drop out of a ranked match (closed the tab, lost connection, reloaded), your archer stays where it is (standing still) and your seat is kept. The main menu shows **Rejoin**, and reloading the page goes straight back in. If everyone drops out, the match is closed after 90 seconds. You still get the match's result.

**Players on controllers (same screen):** under the profile on the main screen, **Add player on controller** asks the new player to press any button on their controller, which becomes theirs (up to three extra players). They type a name to play as a guest, or sign in (the fields start empty; **Add from friends list** picks one of the main player's friends, who then only types their password). The main player (mouse and keyboard, or the first controller) runs the menus. Extra players join practice, custom games (they choose a team) and ranked searches (as part of the main player's party; ranked needs every extra player signed in, because they're rated on their own accounts). They run their own lobby from their controller: in custom games X joins Red (left), B joins Blue (right) and Y goes to unassigned; A opens their element and role picker (D-pad to choose); in a ranked draft X is ready. Their upgrade cards appear under the main player's, picked with X, Y and B. Each has a coloured P2/P3/P4 marker, and instead of a cursor a small arrow outside their archer shows their aim (with the aim guide while drawing); the main player gets the same arrow when playing on a controller. Online, each extra player has their own connection to the server (`/api/device-login` gives it a session without replacing the main player's).

**Friends on the main menu:** signed-in players see their friends under their profile: who's online and what they're doing (main menu, practising, finding a match, in a ranked match, in a custom lobby or game), with **Join** for a friend's public custom game and **Invite** to your party.

**Server load:** the server steps each room at 60 Hz (bots decide 30 times a second, half of them on each tick) and builds one snapshot per room 30 times a second while archers fight. In lobbies, upgrade picks and results it sends one only when something changed (at least once a second). Each room keeps one running compression stream shared by everyone in it: the first message is the full snapshot, then each update is a **delta** (only what changed, entities matched by id: `snapDelta`/`applyDelta`) with the fields that change every update (positions, velocities, aim, draw) **packed as 16-bit integers** (`packDelta`/`unpackDelta` in `public/sim.js`), framed as [length][kind][body] and sent as binary WebSocket frames. A 3v3 update is about 100–200 bytes on the wire, against about 3.3 KB as plain JSON. Someone joining restarts the room's stream; browsers without `DecompressionStream` get plain full snapshots. Clients send their input only when it changes (up to 30 a second, with a heartbeat every 250 ms). Pages are served brotli/gzip-compressed with ETags. Leaderboard and highscore answers are cached for 30 seconds and the balance data until the next game is saved. **Practice vs bots** runs entirely in the browser.

**Chat commands:** anyone can use `/help` and `/roll [max]`. The admin also has `/kick`, `/mute <name> [minutes]`, `/unmute`, `/ban`, `/unban` (account bans are permanent, guest bans last until the server restarts), `/announce <text>` (every game on the server), `/host`, `/start`, `/end`, `/rooms`, `/who <name>` and `/setelo <name> <rating>`. The owner (admin) account has a gold crown after its name everywhere: lobbies, scoreboard, chat, over their archer, highscores and the website.

**Controls:** change any key (two per action) under **Controls** on the main screen or in the menu; they're saved in your browser. An Xbox or PlayStation controller works: left stick moves, right stick aims (the crosshair sits out from your archer in the stick's direction; only a firm push steers it, so easing the stick off to fire doesn't drag your aim away), right trigger draws, A or left trigger dashes, LB and RB are your abilities, Start opens the menu, and X, Y, B pick upgrade cards. Moving the mouse hands aiming back to it. Menus work with the D-pad or left stick, A and B: busy screens are split into sections, so you move between sections first, press A to step into one and B to step back out.

**Controller aim assist** is built in, one strength for everyone on a controller (the mouse is never assisted). Near an enemy (about 110px either side of them) the aim slows down and is drawn 70% of the way toward a point just ahead of them, halfway to where a full draw would meet them if they keep moving; once an enemy is under your aim it tracks them, so a held or released stick stays on a runner. It never locks on: a firm push of the stick always overrides it.

**Training** (main screen) has four graded drills, D to S, always played as a plain Frost Trapper (standard rules, no upgrades; the Trapper's trait doesn't change how you move or draw) so scores compare fairly: **Target practice** (targets pop up across the range in three rounds: steady, quick, then several at once; scored on speed, accuracy and bullseyes), **Dodge drill** (an archer across a wide rift shoots at you, never faster than your dash recharges. Watch him draw and dash as he lets go: he reacts a quarter of a second late, swings his aim at a human pace and stops adjusting just before he releases. You can walk and dash; sinkholes open on your side in round 2 and bogs in round 3, each flashing for 2.5 seconds first; scored out of 1,000 on the share of shots dodged, minus 100 per fall), **Peek and shoot** (dash out from behind boulders, land three hits to knock a turret out, and get back; hits taken cost points) and **Knockout drill** (four set scenes, each with archers standing in front of their own sinkholes; knock every one in to move to the next scene. A dummy that's knocked but misses its hole goes back to its spot a second after it stops. 50 points a dummy plus up to 600 per scene for clearing it quickly against its par time; falling in costs 100 and puts you back at the scene's start. The layouts are `TRAIN_KNOCK` in `public/sim.js`). Your best is kept in your browser and, when signed in, on your account; each drill shows where your best ranks among every account's best (`/api/train`). Drills use hidden arenas and don't count for stats or achievements.

**Rating:** only ranked games (from Find game) are rated; custom games never change anyone's rating. Each ranked match with a winner updates an Elo rating once, when the match is decided, for each signed-in player: you gain if your team won the match and lose if it didn't, however the individual games went (K 64 for your first rated match, shrinking by 4 a match to the usual 24, so the first five or so are **placement** matches). Each side's strength is the average of its archers: accounts use their rating, guests theirs (800 to start), and matchmaking's AI players their own rating. Each account also has a rating per role (worked out the same way, using their rating in the role they played), which the role boards rank by once someone has 10 games in the role. The calculation is in `lib/rating.js`.

**Starting ratings:** a new account (or guest) with no rated match starts from a seed rather than a flat 800: the hardest bot difficulty it has beaten in practice (the page remembers it and sends it when it connects), plus a little for good training grades, minus a little for someone brand new who hasn't done the tutorial, within 650–1200 (`seedRating` in `lib/rating.js`).

**New players:** the tutorial (move, shoot, full draw, dash, dodge, abilities, knockouts, a quick look at the elements and roles, an upgrade pick, then a bot fight) is flagged **New? Start here** until done. An invite link (`/play?room=CODE`) skips the name screen, gives a random name, joins the room and a team. Players who haven't done the tutorial get a small controls strip in their first three games.

**Progression:** account level (XP from games, wins, knockouts, ring-outs and match wins), **mastery** of each element and role (games plus wins, ten levels, shown as ★ on the pickers; `masteryOf` in `public/sim.js`), achievements, and Crests with a daily first-win bonus. Signed-in players see what each online match gave them under the results. Design thinking behind all this is in `docs/design-notes.md`.

**Name banners:** in online lobbies each name is a banner with the player's flag, rank badge and achievement count. On the Achievements screen (with a live preview) players pick a border colour (one per achievement), a finish (a background style unlocked by total achievement tiers: Brushed steel at 3, Chevrons 8, Ember 15, Stormfront 25, Royal 40, Diamond 60) and up to three medals to show (their achievements, in tier colours). The server checks all of it against what they've earned. Accounts can only show borders they've earned on the server; guests' come from their browser, like titles.

**Flags and levels:** online, each player has a flag by their name, taken at first from where they're playing (looked up from their IP address with api.country.is, or the host's `cf-ipcountry` header if it's behind Cloudflare). Signed-in players can pick a different flag, or none, on their profile. Accounts also have a level from their career (10 xp a game, 15 a win, 4 a knockout, 2 a ring-out, 40 a match win; level L needs 40 × (L − 1)² xp) shown as a badge whose colour is the rank: Recruit, Bronze (5+), Silver (10+), Gold (15+), Platinum (20+), Diamond (30+), Master (45+). Flag pictures come from flagcdn.com, so they don't show in the offline copy.

**Version:** the game's version is on the main screen, in the menu and in the website footer, and every recorded game stores it. The Balance data screen can show only games from the current version.

## Playing with friends

**Blocking:** Block (on someone's profile card, or in a message conversation) ends any friendship and requests, stops their messages, invites and friend requests (they're not told), and hides their chat in your games. The Find game screen lists who you've blocked, to unblock.

**Profiles:** clicking a name opens a profile card: their backdrop arena and accent colour, big name, banner, flag (big and faded behind the name), motto, ranked tiers, clan, what makes them stand out (their main archetype and mastery, their best rank and season peak, their strongest playstyle, their best game), four pinned stats, their featured kill cam, achievements and seasons. The website profile shows the same, bigger. Your profile button opens your own profile as others see it, with Edit profile (backdrop, accent, motto, pinned stats, flag); the website profile has the same Edit profile button. The website draws profile pictures with the game's own drawing code (a hidden copy of the game page at `/play?avatar=1`).

**Kill cam:** the game-winning knockout is replayed in slow motion. If the same archer knocked out others in the 8 seconds before (a double, triple or clutch), those are shown first, with a cut between them. Your own kill cams are recorded as they play: **Save video** downloads it (or opens your phone's share sheet), and **Show on my profile** makes it your featured kill cam (stored as the replay's data, gzipped, in the `clips` table, one per player; anyone can watch it from your profile, or at `/play?clip=<id>`).

**Controllers on phones:** the Gamepad API works in mobile browsers too, so a Bluetooth controller paired with a phone or tablet plays exactly as on a computer: its first input puts the touch controls away (touching the screen brings them back).

**Touch controls:** on a phone or tablet, the left thumb moves (the stick appears where you touch), the right thumb aims (the bow draws while it's down and shoots when you let go; a tap shoots at the nearest enemy), and buttons give Dash and the two abilities. Phones should be held sideways. On phones the view zooms to the playing area, the touch buttons show ability cooldowns, and the game goes full screen at the first touch (Android). **Installing as an app:** the site has a web app manifest (`public/manifest.webmanifest`, icons in `public/icons/`), so Android Chrome offers *Install app* and iPhone Safari *Add to Home Screen*; installed, it opens full screen in landscape with no browser bars.

**Colour-blind friendly colours:** Options → Colours swaps the teams to oranges and blues.

**Banners:** your banner (in lobbies, drafts, party lists and your profile) has a **background** (Plain, Carbon, Brushed steel, Hex plating, Chevrons, Woodland camo, Ember, Tidal, Stormfront, Royal, Diamond, plus the supporter, Founder and Patron ones) and a **frame**: Circuit (cyan corner brackets and a scanning sweep), Rime (ice crystals, a cold shimmer), Primal (claw slashes), Shadow (a creeping violet dark), Bloodied (blood dripping from the top edge) and Gilded (a double gold edge that glows). Both unlock with total achievement tiers (frames at 5, 12, 20, 30, 45 and 65). The border colour, title and up to three medals come from your achievements; hover a medal to read what it's for. Choose them in Achievements; your profile shows a larger version with the name big and everything else on a compact second line.

**Inviting friends:** Invite (in the Friends box) gives you a link with your name. A new account made from it is noted as yours; when it has played 3 ranked matches you get 500 Crests and they get 250 (for up to 25 friends). The link works on the website and the game.

**Friends in the game:** the Friends box on the main menu lists online, away (page out of view for a minute) and offline friends, and the main menu shows how many players are online. Click a name for their profile (ratings, games, wins, favourite picks, achievements); **Chat** opens **Messages**, which also reach friends who are offline; **Watch** joins a friend's game as a spectator (ranked matches are watch-only). The messages are stored in the database (`dms` table), the newest 300 per conversation.

See **HOSTING.md** for step-by-step instructions: a free tunnel from your own computer (quickest), a permanent free site on Render (`render.yaml` is included for one-click setup), or the same Wi-Fi.


- **Same Wi-Fi:** friends open `http://<your computer's local IP>:3000`. On Windows, `ipconfig` shows the IP. On a Mac, check System Settings > Network.
- **Over the internet:** deploy the folder to any Node host that supports WebSockets (Render, Railway, Fly.io and similar). Use `npm install` as the build command and `npm start` as the start command. The server reads the `PORT` environment variable. You can also forward port 3000 on your router.

Friends can join straight from a link, for example `https://your-host/play?room=ABCD`, or find public games in the games list.

## Files

| File | What it does |
| --- | --- |
| `public/sim.js` | The whole game: movement, arrows, hazards, teams, rounds, amber, archetypes, upgrade picks, bot AI. Shared by the server and browser. |
| `server.js` | Serves the website and game, the JSON API (accounts, profiles, leaderboard, games list, forum), and runs each room at 60 ticks per second with up to 30 compressed delta updates per second. |
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
| `OPTIONS` | custom rules: sliders (`base` = what 100% means, `min`/`max`/`step`) and lists of values (`def` is the standard) |
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
