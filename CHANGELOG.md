# Changelog

Each version's number is shown on the main screen, in the in-game menu and in the website footer, and is saved with every recorded game (as `gv`), so balance data can be split by version. Bump `VERSION` in `public/sim.js` when you release: the last number for fixes and small tweaks, the middle one for new content.

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
