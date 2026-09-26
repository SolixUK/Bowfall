# Changelog

Each version's number is shown on the main screen, in the in-game menu and in the website footer, and is saved with every recorded game (as `gv`), so balance data can be split by version. Bump `VERSION` in `public/sim.js` when you release: the last number for fixes and small tweaks, the middle one for new content.

## 0.16.1

**Much less bandwidth**
- Game traffic is now compressed (WebSocket permessage-deflate). A 2v2 game measured 62 KB a second per player before and 8.4 KB a second after, about 7 times less. Together with 0.16.0's smaller snapshots, a player now uses roughly 30 MB an hour of play, down from about 400 MB in 0.15.
- The game and website pages are sent compressed (brotli or gzip, about a quarter of the size). Browsers that already have the latest copy get a tiny "not changed" reply instead of downloading the whole game again.

## 0.16.0

**Players on controllers**
- Adding a player: the sign-in fields start empty, so the browser no longer fills in the main player's account.
  - **Add from friends list** picks the friend, and they only type their password.
  - Each player must use their own account.
- Extra players no longer pick an archetype when they're added. They do everything in the lobby with their own controller:
  - Custom games: **X** joins Red (left), **B** joins Blue (right), **Y** goes to unassigned.
  - **A** opens their element and role picker: D-pad up and down switches between element and role, left and right changes it, A closes it.
  - Ranked draft: **A** opens the picker, **X** is ready.
- Their upgrade cards now appear under yours on the upgrade screen, picked with X, Y and B (or clicked).
- No more cursor on a controller. A small arrow just outside the archer points where they're aiming and fills in as the bow draws (white at full draw).
  - Extra players now get the aim guide while drawing, like you do.
  - This also applies to you when you play on a controller.

**Dash direction**
- New option under Controls: dash **the way you're moving** (the new default) or **where you're aiming**. Standing still, a dash always goes where you aim.
- Ninja blinks follow the same setting. Extra players on controllers dash the way they move.

**Custom game lobby**
- Redesigned to fit on one screen:
  - Left column: teams, players on controllers and chat.
  - Right column: your archetype and the match settings.
- Arenas are compact thumbnails, with the chosen arena's description underneath.
- Custom rules and room settings fold away.
- Start and Leave stay pinned at the bottom.
- **Practice vs bots** on the Custom games screen plays against bots in your browser, without using the server.

**Find game**
- You no longer choose your archetype before searching. You pick it in the draft, once you can see the arena.
- A chime plays when a match is found, and another when the draft opens.
- The last five seconds of the draft tick down, and so do the last five seconds of an upgrade pick you haven't made.
- Fixed: "Waiting for teammates to return" could show after a game even when nobody was still in one.

**Friends on the main menu**
- A Friends panel under your profile shows who's online and what they're doing:
  - main menu, practising or playing the tutorial
  - finding a match
  - in a ranked match
  - in a custom lobby, or playing a custom game
- **Join** jumps into a friend's public custom game. **Invite** asks them into your party.

**AI players**
- Matchmaking's AI players now earn achievements from real games too, and their level updates as they play. They already gained and lost rating and stats like everyone else.

**Other fixes**
- The pause menu now opens over the upgrade screen, not under it.
- Moving to unassigned no longer says the player left.

**Lighter on the server**
- Snapshots leave out every field that's at rest (0 or empty). The client fills them back in, so each snapshot is about half the size. That halves the bandwidth each player uses in a game.
- In the lobby, during upgrade picks and on the results screen, snapshots go out 10 times a second instead of 30, since little moves there.
- A room with nobody watching builds no snapshots at all.
- Leaderboards and highscores (which read every account) are kept for 30 seconds. The balance data is built once and reused until the next game is saved.
- If the server has been updated since your page loaded, joining a game reloads the page, so you always play the version that matches the server.

## 0.15.0

**Play together on one screen**
- **Add player on controller**, under your profile on the main screen, adds up to three extra players. The new player presses any button on their controller to claim it.
- Extra players play as a guest with just a name, or sign in to their own account. If they're one of your friends, pick them from the list and they only type their password.
- You run the menus. Extra players join practice, custom games and ranked searches with you.
- In a lobby they pick element and role, and their team in custom games, from a panel or from their own controller: D-pad for archetype, LB / RB for team, A for ready.
- Upgrades: their cards appear in a strip along the bottom, picked with X, Y and B.
- Each extra player has a coloured P2/P3/P4 marker and their own reticle.
- Ranked: extra players must be signed in, because each is rated on their own account. They join your party automatically.

**Ranked draft**
- When a match is found, the arena is drawn at random and everyone gets 25 seconds to pick an element and role for it. The match starts as soon as everyone is ready.
- After the match, **Back to Find game** takes you back to your party. The leader can search again once everyone in the party is back from the game. Party members still in a game show as "In a game".

**New element: Blood**
- Every bit of damage you deal heals you for 25% of it.
- Upgrades:
  - **Hemorrhage:** full-draw hits make the target bleed, and the bleeding heals you too.
  - **Frenzy:** double healing below half health.
  - **Transfusion:** healing past full health goes to your most hurt teammate.
  - **Blood Pact** (trade-off): 45% lifesteal, but 15 less max health.
- Empowered, **Bloodbath:** double healing, and nearby teammates heal from your damage too.

**Controller aim assist**
- A bit stickier: near an enemy the aim slows down more (by up to 55%, was 40%), and the nudge toward them is a little stronger.

**Shorter matches**
- Each round is now best of three games (first to 2) instead of first to 3.

**Rating**
- Your rating now changes once per match, when it's decided, depending only on whether your team won the match. It no longer changes after each game within it.
- New players' ratings move faster for their first 10 matches.
- New players now start at 800 instead of 1000. Existing ratings aren't changed.
- Only ranked games (from Find game) change ratings. Custom games no longer do, though they still count for stats and achievements.

**Custom games: skill per bot**
- The host can set each bot's skill (Easy to Master) from a list next to it, in the lobby and the in-game menu.
- The Bot skill setting still changes every bot at once.

**Owner, admin and chat commands**
- The account named Tom is the game owner and the only admin.
- Type `/help` in chat. Everyone has `/roll`. The admin can:
  - kick, mute and ban players
  - send announcements to every game
  - hand over host, and start or end matches
  - list the games running, look players up and set ratings
- The owner account has a gold crown after its name everywhere it's shown: lobbies, the scoreboard, chat, over their archer, the highscores and on the website.

## 0.14.1

**Guests have a rating**
- Guests are now rated too. Their browser keeps a private id, and their rating, stats and achievements are saved against it on the server, so they carry on between visits.
- When a guest creates an account, or signs in to one that hasn't played yet, all of it moves across, and they're told so.
- The Find game screen and the post-game rating banner both suggest making an account to keep it.

**After each game**
- A banner shows your new rating and how much it went up or down.
- The results screen shows your rating and the change over the whole match.

**Find game**
- Redesigned. Your card shows your picture, name, flag, level, rating, games, win rate, knockouts and best achievements.
- Choose your element and role right there. Party members show their rating and archetype.
- Leaving a ranked game takes you back to Find game, and it doesn't start searching until you press the button.
- Fixed: after a ranked match, the menu could still say "Searching…".

## 0.14.0

**Find game: ranked matchmaking**
- **Friends:** add friends by player name. You can accept or decline requests, and see who's online or in a game.
- **Parties:** invite up to two online friends. The leader picks 1v1, 2v2 or 3v3 and starts the search.
- **Matching:** you're matched by rating with the closest players searching. The rating gap allowed widens the longer you wait. Matches are private and start as soon as everyone's in.
- **AI players:** if nobody near your rating turns up within 20 seconds, AI players fill the empty places.
  - There are 60 of them, each with their own name, flag, rating, skill, a main archetype plus a few favourites, a playstyle, a personality and their own chat lines. Some are chatty, some hardly speak.
  - They arrive with ratings, careers and achievements earned over 1,400 simulated matches against each other.
  - They're rated like anyone else and appear on the leaderboards. They're always marked **AI**: on leaderboards, in the scoreboard, in chat and on their hover cards.
- Guests can search too, but aren't rated.

**Bots**
- New **Master** difficulty, built from a large test of bots playing each other.
  - It picks where to stand several times a second: never where an enemy shot could knock it into a hazard, and where its own shot would knock the target into one.
  - It aims where a shot will actually meet a moving target, allowing for the arrow slowing down.
  - It reads incoming arrows and steps to the safer side, dashing only when it has to.
  - It chooses upgrades from values learned over about 7,800 games.
  - It wins about 83% of 1v1 games and 90% of 2v2 games against Extreme.
- The ladder below it stays as it was: each level wins about 66 to 78% of games against the one below.

## 0.13.7

- Controller aim assist is now a gentle bias instead of a lock-on.
  - Each enemy has a zone made of their body plus the spot you'd lead them to, worked out from how they're moving and how fast a full draw flies.
  - Aiming anywhere in that zone is left alone, so leading a runner works, and your aim moves more slowly there so it's easy to stay on them.
  - Aiming a little outside the zone nudges you part of the way back toward its edge. It never pulls you all the way, and never onto their middle.
  - Aiming well away from anyone does nothing.

## 0.13.6

- Fixed: aim assist ignored enemies more than 900px away when choosing a target. If you aimed dead on a far-away enemy with someone nearer off to the side, the shot veered onto the nearer one. It now chooses from everyone along your line of fire at any distance, picks whoever is closest to that line, and never switches target mid-flight.

## 0.13.5

**Controller aim assist**
- Fixed: it could miss while you were moving. The controller's aim went through the crosshair, which sits a short way out from your archer, so moving pulled the aim off the stick's line. The controller now aims straight along the stick's line of aim, with assist applied to that line.
- It works at any distance. The zone around each enemy is at least about 8 degrees either side of your line of aim, so far-away enemies still catch. Near an enemy it can correct your aim by up to about 7 degrees, so it lands on them.
- It's now one fixed strength for every controller player, tuned to close the gap with a mouse. The setting is gone. The mouse is never assisted.

## 0.13.4

**Aim assist (custom rule)**
- Homing is gentle early in a shot's flight and gets stronger as it closes on its target.
- It doesn't bend at all while a boulder is between the shot and the target. You can shoot round cover and let the shot curl in at the end, instead of it bending into the boulder.
- How hard a shot turns now scales with its speed, so the curve is the same shape whatever the arrow speed rule.
- Every level is a notch weaker. Tiny is now very slight, and each level takes roughly the strength of the one below it before.

**Controller**
- New **Aim assist** setting under Controls: off, low, medium (default) or high.
  - When the right stick points near an enemy, the aim slows down so it's easy to stay on them, and it's drawn onto them, most strongly near their middle.
  - It only affects controller aiming; the mouse is never assisted. It works in any game and doesn't change anything for other players.

**Sounds**
- Checked: the full-draw sound and the crossbow's reload sound only play for your own archer.

## 0.13.3

- Online lobbies announce the host's changes in chat: the arena, bot skill, match length, every custom rule ("Aim assist set to Heavy."), and the game's name, maximum players, listing and password.
- Aim assist now homes on the enemy nearest your line of fire. That means whoever you were actually aiming at, not just the closest enemy. When the shot leaves the bow it picks a target up to 220px either side of that line and keeps it for the whole flight. If nobody's near the line, the shot flies straight.

## 0.13.2

- New custom rule, **Aim assist**: none (standard), tiny, small, medium, heavy or extreme. Every arrow, bolt and shuriken bends toward the enemy it's heading for, if they're in front of it and within about 650px. The higher the setting, the harder it turns. It ignores stealthed archers. It applies to everyone, bots included.
- Tutorial: in the real game against the bot, the coach panel shrinks into the bottom-left corner. It fades almost away whenever an archer goes behind it, so it no longer covers the fight.

## 0.13.1

**Controller**
- Menus work with a controller. Move the highlight with the D-pad or left stick (hold to repeat), press A to select and B to go back. On a list, left and right change the value. It works on every screen, including picking upgrades, and it remembers where you were on each screen. X, Y and B still pick upgrades 1, 2 and 3 directly.
- New **Aim sensitivity** setting (1 to 10, default 7) under Controls: how quickly the aim swings round to where the right stick points. 10 is instant. It only affects the controller, not the mouse.

**Custom rules**
- New rule: **Dashes** on (standard) or off. Off also stops Ninja blinks, and the Dash meter shows "(off)".

## 0.13.0

**Void**
- Empowered Void is now **Singularity**: every enemy you knock out collapses into a black hole for 3 seconds. It drags other enemies within 240px toward it, and touching its core burns 30 health a second. It replaces Displacement.
- You can only have one rift open at a time. Opening a new one closes your old one.

**Lobby**
- Hover over anyone's name in the lobby (or the in-game menu) to see a card with their rank and level, rating, games played, win rate and their two best achievements. Guests show their achievements, and bots show their skill.
- A **Copy invite link** button next to the room code, and in the in-game menu, copies a link that takes a friend straight into your game.

**Menus**
- Buttons make a soft tick when you point at them and a click when you press them.

## 0.12.2

- Fixed: a Crossbowman (or Ninja) fired on their own when a round started. Clicks made while picking a card, or left over from the round before, were being saved up. Clicks now only count during play.
- Archers who fall in now fade away as they spin and shrink.
- Hair Trigger:
  - Raising it shows an orange ward and makes a cocking click.
  - Blocking an arrow sets off a burst, a clang and the crossbow revving up.
  - During full auto you get a hot spinning ring with sparks, an arc showing the time left, and a motor rattle. It spins down when it ends.
- The crossbow's reload clunk is much louder and has a bright metallic ring that cuts through a busy fight.
- Ending the match in a custom game takes you back to the match setup. Ending the tutorial still goes to the main menu.

## 0.12.1

- Crossbowman:
  - Shots now crack and punch much harder, with a small kick of the screen.
  - The reload is a crank ratchet that ends in a solid clunk.
  - Online, your shot sounds the moment you click instead of waiting for the server.
- Crossbowmen take 15% less damage from enemies and 15% less knockback, since they have to fight up close.
- New Crossbowman ability, **Hair Trigger**: a 1-second guard that stops arrows. Block one and your crossbow goes full auto for 2 seconds: hold to fire a bolt about every 0.12 seconds with no reloading, at 50% damage and knockback. The crossbow glows while it lasts.
- The range ring is fainter.

## 0.12.0

**New role: Crossbowman** (Power)
- A crossbow instead of a bow: click to fire a bolt at once, no drawing. Bolts hit as hard as 85% of a full draw and count as fully drawn shots for upgrades, but they drop out of the air after 480px. Reloading takes 1.15 seconds, and you can move freely while you reload. The reload shows as a ring around your cursor.
- Upgrades: Repeater, Scatter Bolts, Windlass, Heavy Bolts, Point Blank, Long Stock (trade-off) and the capstone Double Crank (hold two bolts). Snare Arrow and Recoil Shot can come up too.
- Roles with a short reach (Crossbowman and Ninja) see a faint ring fade in around them when they aim past their range.

**Rules and lobby**
- New standard rules: large archers, very fast arrows, fast movement, normal knockback and normal health. The lobby marks each standard option.
- Hosting a custom game starts with no bots. Add them from the lobby.
- Handicap now goes in 10% steps, from −50% to +100%, with − and + buttons.

**Stuns**
- Stunned archers crackle with a flickering ring of static and sparks, and a stun makes a low electric buzz.

## 0.11.2

- Custom games: the button is now **Host custom game**, and the separate practice row is gone. Offline, Host custom game opens the bot lobby.
- When hosting you choose the maximum number of players (2 to 16, default 8) and whether a password is needed to join, and set it there. The host can change the maximum in the lobby later (never below the players already in).
- The games list shows how full each game is (for example 4/10), the host, arena and stage, and a Password tag. Full games show Full instead of Join, and joining a full game by code says so.
- Two quick-play players with the same name in one game are numbered (Tom, Tom 2). Account names were already unique.

## 0.11.1

- Tutorial: a new step explains elements and roles (the practice pauses while you read). The ring-out step no longer says lava knocks you out at once: it burns you hard while you stand in it. The coach reminds you that Esc (or Start) opens the menu, where you can leave. The dummy and the bot you fight are now a Flame Ranger, a simpler archetype.
- Ending a practice match from the menu takes you back to the main menu instead of the lobby.
- The kill cam is no longer optional: the game-winning knockout is always replayed. The setting is gone from Options and the in-game menu.

## 0.11.0

**A proper main menu**
- After you enter a name or sign in, the game opens on a main menu with the title and five options:
  - Find game: ranked matchmaking by rating. Locked until there are enough players.
  - Custom games: the public games list, joining with a code, practice against bots, and a Host a game button in the corner. You pick the arena, bots and rules in your lobby.
  - Highscores: top ratings, the best players at each role, most wins and knockouts, and single-game records.
  - Tutorial: see below.
  - Options: see below.
- Your profile picture and name sit in the top corner. Click them to edit your profile.

**Tutorial**
- Six short steps on a practice dummy: moving, shooting, a full draw, dashing, using your ability, and a ring-out into a pit. Nothing can knock you out while you learn.
- Then a real game against an easy bot, starting with your first ability pick. A coach panel explains each step, and any step on the dummy can be skipped.

**Profile**
- Your profile picture is a drawing of an archer: pick its element, role and colour.
- Your name (guests), title, banner border and flag (accounts) are all edited in one place, with a live preview of your lobby banner.

**Options**
- Volume, sound on or off, resolution (automatic, always sharp or fast), particles, screen shake, damage numbers (everyone's, only yours, or off), the aim guide line and the kill cam. Controls and controller setup live here too.

## 0.10.0

**Rating and leaderboards**
- Every account now has an Elo rating, starting at 1000 and updated after every online game that has a winner. How much you gain or lose depends on how strong both teams were: bots count as 700 (Easy) to 1300 (Extreme), guests as 1000. New accounts move faster for their first 20 games.
- Every account also has a separate rating for each role, so the role boards show who is best at a role rather than who plays it most. You need 10 games in a role to appear on its board, and win rate is shown alongside.
- The leaderboard opens on Rating, adds By role and Highscores tabs, and keeps the old boards. Highscores lists the most knockouts, damage and ring-outs in a single game, and the highest rating anyone has reached.

**Players**
- Online lobby names are now banners, showing the player's flag, rank badge, a trophy with their achievement count, and a border colour that each achievement unlocks. Pick your border in Achievements.
- Opening the game now asks first whether you want quick play (just a name) or to sign in or create an account.
- Bots have new names.

**Abilities and balance**
- Volley: landing all three arrows on one enemy refreshes its cooldown.
- Assassin: your first arrow out of stealth deals 50% more damage and stuns for 1 second. Blink now reaches 300px (from 220), recharges in 6 seconds (from 8), and gives you triple draw speed for 1.5 seconds.
- Storm empowered: a storm bullseye stuns the target and everyone the lightning reaches for 1 second.
- Ninja: one shuriken per click instead of holding to fire, and throws come about 25% faster. Shadow Mark throws a ring of 10 shuriken when you snap back to your mark.
- Parry lasts 1 second (from 0.7). Fortify blocks 90% of knockback (from 70%). Upgrade picks last 20 seconds (from 15).
- Mushroom Grove: mushrooms bounce you according to how hard you hit them. Brushing past one just stops you.

**Feel**
- The full-draw sound is lower and quieter, and the sound when you start drawing is gone.
- The countdown and Fight! sit in the middle of the arena, and every number of the countdown ticks.
- Damage you deal pops up big and gold. Other players' damage is smaller.
- Your arrows passing through a teammate, or aiming at one, shows a green ALLY label over them.
- Bull Rush has a proper charging sound.

## 0.9.0

The first numbered version.

**Controls**
- Every key can be changed (two keys per action) under **Controls**, on the main screen and in the menu. Saved in your browser.
- Controller support (Xbox and PlayStation style): left stick moves, right stick aims, right trigger draws and fires, A or left trigger dashes, LB and RB use abilities, Start opens the menu, X, Y and B pick upgrade cards. Aim distance and stick dead zone can be adjusted.

**Players**
- Flags next to names online, taken from where you're playing to start with. Signed-in players can pick a flag, or hide it, on their profile.
- Account levels and ranks (Recruit, Bronze, Silver, Gold, Platinum, Diamond, Master), shown as a badge by your name in games, on the leaderboard, on the forum and on your profile with an xp bar.

**Bots**
- Difficulty moved down a step: the old Easy is now Normal, the old Normal is Hard, the old Hard is Extreme. A new, gentler Easy: slower to react and turn, less accurate, slower on their feet, rarely dodges.

**Arenas**
- Four new arenas, eight in all:
  - **Gale Cliffs:** a gale blows the whole arena toward the drops every 9 seconds, alternating up and down, after a flashing warning.
  - **Sawmill:** two saw blades race along their tracks.
  - **Portal Ruins:** gates that send archers and arrows to the far side.
  - **Mushroom Grove:** bouncy mushrooms that fling archers and bounce arrows.

**Balance and abilities**
- Sniper's Marksman trait: damage now rises smoothly with how far the arrow has flown, up to +25% at the length of the arena corner to corner.
- Warden's Shield Wall lasts 6 seconds.
- Second Wind is replaced by **Parry** (Ranger): a short ward that blocks an arrow; blocking one doubles your draw speed for 3 seconds, shown by a golden aura.
- Void's empowered effect is now **Displacement**: your hits teleport the target a short way along the arrow's path, which can drop them into hazards.
- Storm's empowered shock reaches enemies twice as far away.

**Kill cam**
- Smooth in slow motion: frames are blended rather than held.
- A frozen archer's ice cube shatters when they're knocked out, live and in the kill cam.

**Look**
- New typefaces (Rajdhani and Titillium Web) and a squarer, notched style for panels and buttons in the game and on the website.
