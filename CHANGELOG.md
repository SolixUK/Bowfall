# Changelog

Each version's number is shown on the main screen, in the in-game menu and in the website footer, and is saved with every recorded game (as `gv`), so balance data can be split by version. Bump `VERSION` in `public/sim.js` when you release: the last number for fixes and small tweaks, the middle one for new content. Bump `PAGE_VERSION` and the `sim.js?v=` in `public/index.html` to the same number: the page checks they match and reloads if a browser mixed an old copy of one with a new copy of the other.

## 0.72.0

- **New arena: Tidegate.** A harbour on a 30-second tide. At low tide it's open sand; then the tide comes in (with a 4-second warning) and for 8 seconds everything but the wooden decks floods: the spawn decks, the boardwalk, the sandbars and the central pier. The pier's drawbridge lifts for 5 of those seconds and cuts it in two. Then the water goes out and the sand is open again. Tide pools (crack hazards) can now come and go on a cycle (`tide: {per, from, to}`), not just open once.
- **Clan emblems:**
  - More shapes (Octagon, Kite, Arch, Heater), more patterns (Saltire, Border, Waves, Rays, Zigzag, Pale, Bend, Stars) and 15 new symbols (Heart, Skull, Sword, Paw, Leaf, Snowflake, Sun, Wave, Mountain, Anchor, Eye, Bow, Gem, Axe, Tree, and better Wings).
  - Symbols sit in the visual centre of every shape (they sat too high on the shield and too low on the triangle).
  - **Any colour:** each of the four colours has a picker with a saturation/brightness square, a hue slider and a hex box, as well as the quick palette. Old emblems still read the same.
- **Test sign-up:** set `TEST_SIGNUP_CODE` (6+ characters) in the server's environment, then sign up with the email `CODE@test` to make a brand-new account with no email needed, as many times as you like. It starts as a fresh newcomer (this browser's saved settings are cleared, nothing is carried over from a guest, no referral), and isn't an owner account.
- **Menu:** your archer on the banner button is as tall as the banner; the clan button's text is left-aligned; the right-hand column starts level with the top of the BOWFALL title.

## 0.71.1

- **Archers' eyes, taking aim:** while drawing, one eye shuts (a short line) and the other narrows to a slit, the more the fuller the draw.
- **Archers' eyes, hurt:** screwed shut XD style, each eye a chevron pointing at the other ( > < ), instead of both pointing the way they face. (Stunned and frozen archers too.)

## 0.71.0

- **Your banner is the profile button.** The main menu's top-right button is now your name banner as everyone sees it: frame, background, border colour, level, flag, clan, title and trophies, with your archer beside it and your ratings and Crests under your name.
- **Best play of the week shows the maker's banner** (as it is now) instead of just their name, with **AI** on an AI player's.
- **The menu's right column lines up:** banner, clan, friends and the best play are all the same width, edges aligned. **Add player on controller** has a controller icon.
- **Previews wait half a second.** A best play or kill cam card only grows and plays after the mouse has rested on it for half a second, so passing over one doesn't set it jumping about (menu and results).
- **Tutorial, reworked:**
  - You start as a plain **Ranger, with no element**; the dummy and the bot are plain too. Once you've won your first game against the bot, the game pauses and you **choose your element** from Frost, Flame and Storm (each with what it does; click or press 1, 2 or 3), then win a game with it (the bot gets one of the others).
  - **The ability step names the key your ability is really on:** your key bindings, the slot it landed in, and whether you've swapped Q and E (it said "press Q" while the ability was on E).
  - The tutorial bot still never changes a rating: its results only help place a brand-new player before their first ranked match, as before.
- **Website:** "Draw. Shoot. Knock them off the map." Every hit shoves, with damage still counting; and the ways to play: with friends online or on one screen with controllers, custom games against each other, clans.

## 0.70.5

- **Doubles and triples "at once" show every knockout.** The final shot's camera rode the arrow in and settled on the last archer it knocked out, so a double from one shot (or one ability or blast) showed only one going down. From just before it lands, the camera now frames everyone knocked out in that moment, as close as that allows, moving at full speed to get there. The same goes for kill cams, the best plays, their freeze frames and Save video.

## 0.70.4

- **AI players' plays count for Best play of the week.** After a match, your client offers your best play and the best of anyone else's; the server takes an AI player's (checked against the AI players in that match, and each match's taken once whoever sends it), never another person's. They're marked **AI** on the menu card and the website, each AI player keeps at most three a week, and a real player's play wins a tie.
- **Outnumbered plays score more.** Knockouts made while your side had fewer archers standing than theirs (1v2, 1v3, 2v3) earn a bonus that grows with the odds and with how many you took out: a 1v2 knockout about +1.5, a 1v2 double +2.7, a 1v3 triple +7.8. The play's line says so ("outnumbered 1v3"), and the clip farm's play filter has **Outnumbered**. (A clutch already scores on this, so it isn't counted twice.)
- **Freeze frames really freeze.** Once the camera settles, the menu's best play and the results' cards are left as they are: no spinning boomerangs, drifting particles or bouncing powerups. Drawn again if the frame is resized.
- **Hover previews stay inside the results card.** A card grows toward whichever side has room within the card's own shape (it has clipped corners, which cut off one growing past its edge), not the window's.

## 0.70.3

- **Fix: anything that lists saved clips failed on the live (Postgres) database.** `clipList` read the query's rows twice (the query helper already returns the rows), so it threw on every call: the plays of the week (list and offers), kept kill cams in Profile, Keep on my account and the clip limits. The local test database has its own version of the function, which is why it worked there. Found from the error 0.70.2 now writes to `/api/perf`.

## 0.70.2

- **Fix: plays not reaching Best play of the week.** Three things in the way: the bar was a score of 6 (a double kill scores about 5), so most big plays never qualified; it's now 4.5, the same as for the results screen, and the highest of the week still wins the card. The menu only fetched the list every five minutes, so a play you'd just made didn't show on the way back; it's fetched on returning to the menu and every minute. And the list was cacheable for two minutes; it isn't now.
- **The real culprit: the list of plays was failing on the live server** (`/api/weekplays` answered 500 every time, so the card could never show anything, and an offered play would have failed the same way). Both routes now catch the error, note its actual message for the owner at `/api/perf` (`server:weekplays` / `server:weekplay`), and the list answers with an empty list rather than an error, so the next deploy tells us exactly what's wrong.
- When a play makes it, you're told ("Your double kill made the plays of the week!"). Every offer's outcome is noted for the owner at `/api/perf` (`mem:weekoffer`: kept or not, and why), so if one doesn't show we can see the reason.
- **Save video** on the results screen exports at 1440p (was 1080p), the same as the clip studio's default.

## 0.70.1

- **Save video** on every kill cam and best play on the results screen: the clip studio's exporter, run on that one clip as it was shown (1080p landscape, 60 fps, drawn frame by frame and encoded, with the sound rendered to match). It only runs when asked, behind a progress box with a Stop button; nothing is filmed live, and the results come back as they were.
- **No replay files.** 0.70.0's Download replay, Import replays and dropping `.bowfall` files on the page are gone: nothing from outside is ever loaded into the game.
- **Best play of the week on the main menu:** the card now sits under the Discord button, wider, and always shows (an invitation when there's no play yet, or when the server doesn't answer; that's noted for the owner at `/api/perf` as `mem:weekplays` and tried again in a minute). It shows the week's highest-scoring play, replaced whenever a higher one comes in (the best ever when the week has none). Plays only reach it from 0.69.1 on: before that, no play was caught in online matches at all.

## 0.70.0

**Kill cams as replays, not videos.**

- **Your kill cams on the results screen are freeze frames drawn from the replay**, exactly like the best plays: hover and it grows and plays (as a kill cam), click to watch full size. Nothing is filmed or encoded during the game any more; the live recorder that froze some computers is gone from matches altogether (along with its Options switch). The newest four of a match's kill cams are shown.
- **Download replay** on every kill cam and best play: the game's own recording of the moment, saved as a small `.bowfall` file (tens of KB). Keep them in your own time, as many as you like.
- **Import replays** in the clip studio (or drop `.bowfall` files on its window, or on the main menu as the owner): they join the studio's list to watch, trim, restyle and export as video whenever you like, frame by frame, with sound. So plays from real ranked matches can now become videos for the socials. **Download replay** in the studio saves any clip the same way. A `.bowfall` file dropped on the main menu by anyone else simply plays.
- Keep on my account and Show on my profile work as before.

## 0.69.4

- **Best plays: the camera rides the final arrow again.** A play's calm camera (half speed) fell behind a fast final shot; it runs at full speed while that arrow is in the air, then settles.

## 0.69.3

- **Found it: recording kill cams as video.** With Options → Record your kill cams as video switched off, a match that had crashed on every version back to 0.61 ended without a hitch. Capturing the canvas live (`captureStream` into a `MediaRecorder`, since 0.55) can freeze the whole computer on some machines, so recording is now **off by default** and only on for those who switch it on, with 0.69.1's 1080p cap and watchdog behind it. Keeping a kill cam on your account (the replay itself) is unaffected. The results list says why there's no video ("Video recording is off (Options → Graphics)", or "Recording stopped: your computer couldn't keep up") rather than "No video in this browser".
- Still to do, as its own change: **Save video** rendered from the kept replay with the clip studio's frame-by-frame exporter (no live capture at all), so videos come back without the risk.

## 0.69.2

- **The results screen no longer opens a video player per kill cam.** It used to put a `<video>` for every one of your kill cams on the page at once, each with its own decoder (and with hardware decoding, each on the graphics driver), which a driver can take badly. Each kill cam now shows a still (grabbed as the recording starts) with a play button; a click opens one player, and any other in the list is taken down first. The big hover preview works the same way and releases its decoder when it hides. This has been so since 0.55, so it's in every version that crashed.

## 0.69.1

- **The crash after a match, take two.** It also happens on 0.64.4, which has none of the best-play frames, so 0.68.1's fix was aimed at the wrong thing. Two changes to find and fend it off:
  - **A trail.** When the results open, and over the next 20 seconds, the page sends the server a short note on what it's holding (memory, canvas size, replay buffer, kill-cam clips and their video, the recorder's state, frames and videos on the page, frame rate). They're listed at `/api/perf` (owner) under `errors` as `mem:results…`, so a crash leaves a record of what was piling up. These notes never show a pop-up or count as errors.
  - **Kill-cam recording made safe.** Your own kill cams are recorded as video while they play (since 0.55). Encoding a 4K or high-DPI canvas at 60 frames a second is more than many machines manage, and when the encoder falls behind the browser queues raw frames in memory. Recording is now capped at 1080p (a bigger canvas is drawn down each frame), never starts while the game is already struggling, and a watchdog stops it the moment data stops arriving, it runs too long, or the page's memory climbs, then switches recording off for the session (with a quiet note to the server). **Options → Graphics → Record your kill cams as video** turns it off altogether.
- **Fix: best plays were never caught in online matches.** The check for "am I spectating" read the room's list of spectators, which is a list even when empty, so every online match counted as spectating and no play was ever scored. Best plays now appear after online and ranked matches as intended (and the plays-of-the-week offer works).

## 0.69.0

**AI players with a way of playing of their own.**

- **A playstyle that fits the role, at last.** An AI player's style (marksman, brawler, skirmisher, guardian, stalker) was picked for a role they weren't playing: they got one when they were added to the match, before their real loadout went on, so a sniper could play like a brawler. The style now follows the role they actually pick, or the one on their list (`setBotMind`).
- **Traits.** Each has its own: **cover ducking** (after a shot, tuck in behind a nearby boulder while the bow is drawn again, then step out on the side they're leaning to and loose), **edge hunting** (work round to the side from which a hit throws you into a hazard, in the planner and the plain brain both), **dash habit** (how freely they dash, bash and close in) and a **charge lean** (quick shots or full draws). Plain bots have none, so practice is unchanged.
- **Human ability timing.** Gust, Parry, Deflect, Wall and the like used to catch an arrow the instant it was in range, every time. An arrow now has to have been in the air for about the bot's reaction time, each arrow is either noticed or missed (sharper players miss fewer, nobody catches them all), the flick takes a moment and a Gust's aim is a little off.
- **Temper.** A game lost without a kill, or several lost in a row, gets to the short-fused: they say so, and play wilder (more aggression) until they win one. The calm ones shrug.
- **Chat rewritten.** Far fewer lines, and plainer ones ("got you!" is gone): most of a game is silence, and "gg" is the one thing everyone types. New moments: a double or triple ("light work", "bots?"), being thrown into walls over and over ("ok stop", or a keyboard mash from the hot-headed), a game lost without a kill, tilt. Each player types their own way: some all lowercase, some with the odd typo, some who add !! when worked up, and those from a country with its own language say the odd word in it ("блин", "jaja", "mdr", "kkkk"), never more than a word or two.
- **149 AI players (up from 69)** for the Europe server, and `node tools/seed-ai.js --region na` makes a North America list (`AI_PLAYERS=lib/ai-players-na.json` on that server). Most are rated where new players start, so a solo 3v3 at 4am still fills with people of the right rating. Their archetypes follow the unlock ladder: low-rated ones play the starter kits, the premium roles and elements show up among the better players.
- **They learn.** While the seed simulation runs, each player tries one small change in half their games (a trait, their aggression, a second archetype, a planner weight) and keeps it if it wins more; `tools/balance-report.md` lists what each kept. The same run writes win rates by role, element, combination and upgrade: the cheapest balance check we have.
- **Owner view:** `/api/aiplayers?html=1` (signed in as the owner) lists every AI player with their rating now against the one they arrived with, ranked matches played here, skill, style, traits and loadouts.
- **Matchmaking:** real players first, but no pointless waiting. The 20-second wait before AI players fill a match only applies while someone else is online who could still search (on the menu, or in a ranked match that's nearly over); with nobody about, the wait is 5 to 8 seconds.
- **Bots and boulders.** Two bots either side of a big rock (a player arena with a boulder in the middle) pushed at it, were pushed back by the steering, and stood there facing each other. A goal that points into a boulder now goes round it, on the side the bot is already leaning to, and the planner looks further afield when a boulder blocks the view.
- **Transfusion** (Blood): a third of your healing flies to your most hurt teammate within 300px, plus anything you'd waste at full health; with nobody hurt in reach it all stays yours. (It only ever sent what you'd have wasted, which at less than full health was nothing.)
- The clip farm seats the ranked AI players with their traits and style, as in ranked.

## 0.68.1

- **Fix: the crash (and the whole computer slowing down) as a match's results appeared.** A clip's little frame (on the results, or the main menu's best play) is a copy of the game, and that copy was doing everything the real game does: it connected to the server as you, saw your match was still going and rejoined it, then showed its own results with its own clip frames, each another copy that did the same, so copies multiplied until the browser (and the computer) ran out of memory. A copy of the game in a frame now never connects to the server's live side (no friends, presence or rejoining, never joins a game) and never shows best plays of its own; and as a safety net, a frame inside a frame stops at once. Tested: the results open with one frame per clip card and no connection from it.
- The clip frames draw at standard resolution, and a held freeze frame is only redrawn now and then once the camera has settled (much lighter on the computer).

## 0.68.0

- **Best plays at the end of a match, as freeze frames:** two cards: **Best play of the game** (anyone's, AI players included) and **Your best play** (or one card, "Best play of the game: yours!", when they're the same). Each shows a freeze frame of the moment the final shot lands; hover over it and it grows and plays (real time, then the kill cam on the final shot); click to watch full size. Under each: the score, the play and what made it, and Keep on profile on yours (supporters).
- **Main menu: Best play of the week**, on the right: the same kind of freeze frame card (hover to grow and play, click to watch full size), with its score, play, player and arena. With nothing this week yet it shows the best play ever, and with nothing at all an invitation to be the first. (The website keeps its plays of the week section.)
- Your best play is still the one offered for the plays of the week.
- A clip that isn't yours no longer shows "You" over the archer who made it.

## 0.67.2

- **Fix: the browser running out of memory ("Aw, Snap!") on the main menu.** The plays of the week play inside a small frame that is the game itself, and that copy of the game was loading its own plays-of-the-week frame, which loaded another, and so on, until the browser ran out of memory (it showed once there was a play of the week, so usually on returning to the menu after a match). The card now only loads on the real main menu, never inside a frame (the plays' own frame, the website's backdrop and previews, avatars or replays). Tested: the menu holds at one frame for the plays, and the website at one.

## 0.67.1

- **Clip farm defaults:** one battle per game, players swapped for AI players of a similar rating, any archetype (all roles and elements), random set upgrades, a random map effect each game, Hunt on, keeping clips scoring 4.5 or more; picture as before (scores and names shown, empowerment on, normal speed, no kill cams, maximum quality).
- **Clip studio defaults:** kill cam, kill cam camera, calm, close, 1×, start and end as saved, names and health, no black bars (particles, text, shake, flash and glow on), this frame only, 1440p. Best plays on the results, profiles and the plays of the week keep their own look (real time, then the kill cam on the final shot).

## 0.67.0

- **Plays of the week, from everyone's online matches:** not just ranked: any online match (ranked or custom) offers its best play when it ends (score 6 or more), checked by the server as before.
  - **All time too:** the best ten plays ever are kept for good. The main menu's card has Week and All time tabs (a new week with nothing in it yet shows the best ever), and a line on how to get on it.
  - **On the website:** a "Plays of the week" section on the home page, the three playing one after another in a large frame beside the list (This week / All time). Click one to watch it in the game.
- **Bullying, reworked:** it's now any run of three or more slams into the walls, each within 1.8 seconds of the last, by one archer or several together. It scores more for more slams, for slams coming faster, for each one into a corner, for each extra archer joining in, and most if it ends in the knockout. Clips are titled Bullied, Cornered (two or more into a corner), Merciless (six or more), Bullied out or Cornered out (ending in the knockout), and the line says who did it, how many slams in how long and how many into a corner. The game reports every slam (the "slam" event) so the client can follow it; the old one-archer-only rule no longer decides the clip.

## 0.66.0

- **Plays of the week on the main menu:** the three best plays from ranked matches this week (Monday to Sunday, UTC), in a small frame on the right that plays them one after another with a caption (rank, score, play, who). Hover over it and it grows to watch; click it, or one in the list, to watch full size.
  - When a ranked match ends, its best play (score 6 or more) is offered for the week automatically. The server only takes it from someone who has just played a ranked match on that arena, with knockouts in it by the player they were in that match, keeps each player's best three and the week's best 30, and lets last week's go. The owner can take one off (POST /api/weekplay with drop: id).
- **Best plays are shown your way:** on the results screen, on profiles and in the plays of the week, a best play now plays from 2.5 s before, in real time until the final shot, which the kill cam rides in slow motion, on to ¾ s after, with a calm camera and no black bars.
- **Clip studio defaults** are the same look: real time then kill cam on the final shot, kill cam camera, slow and steady, close, start 2½ s earlier, end ¾ s later, no black bars, 1440p. (Settings you've already changed are kept.)

## 0.65.0

- **Your best plays, in every match:** the clip farm's eye for a good play now watches your own games too (ranked, online and against bots; not the tutorial, training or spectating). Every play you make is scored as it happens, the same way as in the farm: multi-kills (more the closer together), Rip and other ability knockouts, a held or trapped target, a dash into position, bullying into the walls, roasts, harpoon pulls, long shots, clutches and the rest. If you made one worth showing (score 4.5 or more), the results screen shows your best (up to three), best first, with its score and what made it.
  - **Watch** plays it on the game's canvas as a kill cam (save it as a video from there), then takes you back to the results.
  - **Keep on profile:** supporters can keep a best play on their account, alongside their kill cams (it counts toward the same limit). Others see the button and what it's for.
- The server checks that only supporters (and the owner) keep best plays, and remembers a kept play's score.

## 0.64.4

- **Ricochets aren't long shots:** an arrow that bounced on its way (Ricochet, Bank Shot, a ricochet power-up or Trick Shot) no longer counts as a long shot: not for the Long shot moment and clip, the "Long shot" knockout label, the longest-shot stat, or the Longshot and Farsight achievements. Its distance was luck, not range.

## 0.64.3

- **Clip farm: Crossbowman** can be picked for a player, is in the random archetypes, and has its own tick box under roles in the random pick (it had been left out of all three).

## 0.64.2

- **Clip farm, "Three or more at once"** in Only these plays: keeps just triple (or bigger) knockouts landed in the same instant, from one hit, ability or blast. "Two or more at once" covers doubles too.

## 0.64.1

- **Clip studio, export both frames:** a new Export setting, "Landscape and vertical (two files)", exports the clip twice, once 16:9 and once 9:16, each with sound. Export all starred honours it too. Every exported file's name now ends in -landscape or -vertical.

## 0.64.0

- **Clip farm:**
  - **Only these plays:** tick the kinds of play to look for (knockouts at once, triple kill or more, double kill, Rip, set-up, dash, ability, held, bullied out, harpooned, roasted, long shot, clutch, burst, untouchable) and only those are kept, so it can run for hours hunting one kind without filling the studio. Nothing ticked keeps any kind. Remembered.
  - **Higher score floors:** clips to keep can be score 6, 8, 10 or 13 and up, as well as 3 and 4.5. Remembered.
  - **Roles and elements in the random pick:** tick boxes to leave roles or elements out of the random archetypes (and out of a player's favourites when they play those). Remembered.
  - **Runs in the background:** switching tab or minimising no longer pauses it. The browser stops drawing a hidden page, so the farm keeps playing on its own clock without drawing anything (tested: 16× speed carried on at full rate with the page hidden).
  - **No round and match messages while fast-forwarding or hunting:** the game summary, results screen, countdown, banners and callouts stay hidden (at 1× they show as before).
- **Clip studio, new replay style: Real time, then kill cam on the final shot.** The clip plays at full speed with your chosen camera, then just before the final shot (or ability) is loosed it eases into slow motion and the camera rides it in to the knockout.

## 0.63.0

- **Clip studio, the action camera:**
  - **Every archer still standing stays in the picture**, and whoever's just going down, for a moment. The frame is worked out from where they are and where they'll be half a second on, centred on all of them with a lean toward the playmaker.
  - **Closeness now does what it says:** it sets how tightly the frame sits round the archers (from a roomy margin at Wide to a snug one at Very close) as well as how far in it may go, so closer settings come in noticeably tighter whenever the archers are near each other.
  - It allows for the black bars (the top and bottom 8%) and for the names and health above each archer, so nobody is hidden under a bar.
  - **Vertical 9:16 keeps everyone in frame:** it zooms out as far as it needs to rather than switching to following the arrow (which was what made it jump about and lose archers). Tested: no archer out of frame in any clip, and the slow camera moves well under a pixel a frame.
- **Scoring:**
  - Knockouts close together score more the closer they are: several from one hit, ability or blast (within a tenth of a second) add 4 for each extra one, within a second about 2.5, a few seconds apart a little. Clips like that are titled as such ("Triple kill at once").
  - The play behind a multi-kill counts once at full value rather than once per knockout.
  - **Untouchable** scores lower (a typical one is now about 4 rather than 6).

## 0.62.0

- **Clip farm:**
  - **Arenas in the random pick:** tick boxes under Arena to leave arenas out of the random choice (remembered).
  - **Lock archetype** on each player: their element, role and set upgrades stay put whatever the variety options do, even when the player in that seat is swapped.
  - The live camera option is gone from the setup (the studio has the cameras); the bar's Camera button still switches smooth, tight and arena while it runs.
  - Kill cams after games are off by default: the best moments are saved to the studio anyway.
- **Clip studio:**
  - **The action camera keeps everyone in the fight in the picture**: the playmaker, their victims, anyone close to them and anyone who's shot or been hit in the last moments (an archer idling at the far end of the arena isn't counted, or every clip would be the whole arena). It's centred on all of them with a lean toward the playmaker, as close as fits, looks a second ahead, and now moves with weight (it accelerates and settles, never jumps). Slow and steady is properly slow and steady.
  - **The shot after the shot is gone:** an arrow the playmaker loosed after the final knockout had landed is left out of the replay.
  - **Clear unstarred:** deletes every clip that isn't starred (click twice).
- **Scoring:** knockouts in quick succession score much higher (a double 5, a triple 8, a quad 11), and a Rip that takes several at once scores higher still (three in one Rip is worth about 8 on its own).

## 0.61.0

- **Clip studio exports have sound:** Export video renders every sound the replay makes at exactly its frame's moment (slowed and lowered in slow motion, as in the game) and puts it in the WebM alongside the smooth 60 fps picture, so there's one export and it's both smooth and heard. The old record-as-it-plays export is gone (it only runs now if the browser can't encode video at all).
- **Clip studio cameras, rethought:**
  - **On the action (playmaker):** the camera is built round whoever made the play: them, whoever they're fighting at that moment, their arrows in flight and where everyone's about to be. It fits as close as it can (up to the **Closeness** you choose: wide, medium, close, very close), slides toward the playmaker as far as it can while keeping the fight in view, widens quickly and tightens slowly. Nothing far away pulls it out any more, so it no longer zooms out to the whole arena after the final knockout.
  - **Camera speed:** slow and steady, calm, normal, quick or snappy: how fast it moves from one thing to the next. It applies to every camera.
  - The smooth follow option is folded into the action camera.
  - No kill cam whoosh at the start of every clip.
- **Better clips from the farm:**
  - Every knockout is looked at for the play behind it: a **frozen, rooted, pinned, stunned or hooked target**, a **dash into position** just before the shot (and more for both: trap them, dash in, finish them), **Bull Rush**, a **full Volley** landing all three, a **Rip** (much more when it takes several at once), a **Quake** into a hazard, a **pin** before the finish, and a **run of quick hits slamming them into the walls**. Good ones are saved as clips of their own (Set-up knockout, Dash knockout, Held knockout, Ability knockout, Rip, Bullied out), and the same play adds to the score of any other clip it's part of (a double kill off a Rip, a game-winning knockout from a dash).
  - **Bullied out** now means what it says: three or more quick hits in a row that slam them into a wall or corner, ending in the knockout. Plain bullying without a knockout scores less.
  - **Untouchable** is only kept when the dodging ends in a knockout (dodging bad shots alone isn't a clip), and scores less.
- **Farm variety, each its own tick box:** one battle per game, team sizes, players, archetypes, upgrades and map effect are chosen separately.
- **Hunting** no longer flashes the callouts, banners and map-effect announcements.
- **Trappers:** Harpoon and Bramble Toss can't both be loaded on the same shot (one armed shot at a time), and while your harpoon is in flight or reeling someone in you can't draw or shoot.
- **Bots use Rip properly:** they spread thorns over everyone they can reach rather than piling them on one target, hold Rip until it's likely to knock someone out (a sharp bot gives a second knockout a moment to line up), and only rip early to root someone beside a hazard when they have a shot ready to push them in. Rip knockouts roughly doubled in testing.
- The scorched ground round lava fades out instead of stopping in a hard ring, and on Meadow it's a warmer brown.

## 0.60.0

- **Clip farm:**
  - **Randomise everything after every battle:** one-battle matches, each with a new arena, team sizes (1 to 4 a side), players (any ranked AI player, or of the chosen rating), archetypes, upgrades and map effect.
  - **Hunt:** a setup option and a ⚡ button on the bar. The farm runs flat out without drawing the game (about 100× real time here, 170 battles in a minute) and keeps only the very best clips (score 6 or more). The screen shows the speed, the battles played and the clips kept.
  - **Smooth camera** (the new default): it frames everyone fighting and anyone close to them, where they are and where they're heading half a second ahead, with the arrows round them. The frame widens quickly and narrows slowly, so it glides instead of darting about and nobody slips out of view. It keeps up at any game speed. **Tight** is the old closer, quicker camera. The bar's Camera button cycles smooth, tight and arena.
  - Points to win of 1 or 2 now work (they were quietly 3).
- **Clip studio:**
  - **Smooth follow (looks ahead):** a new camera that uses the recording to see a second ahead and keeps the archers in the current fight and the arrows round them in the picture, gliding between them. Wide and the one-archer clips use it too.
  - **Vertical framing is smarter:** it's tighter on who matters, so they fill the phone's frame, and it allows for the black bars. When the archers are too far apart to fit a phone's width (a long shot across the arena), it follows the play instead, staying a step ahead: toward the target while they draw, ahead of the arrow in flight, then on the target.
  - **Clear all:** a button to delete every clip (click twice to be sure).
  - Clips loop straight round with no gap.

## 0.59.0

- **Clip studio:**
  - **Starred only** (or F) lists just the starred clips to watch through again; **Export all starred** exports every one in turn, each as its own file with its own start and end.
  - **Pause** (or P) holds the clip where it is.
  - Settings now **carry over** from clip to clip (black bars off stays off, and so on). Only the start and end belong to each clip.
  - **Moving the end later (or the start earlier) now shows in the preview**: clips are saved with 2.6 seconds to spare either side (up to 2½ s later or earlier). Clips saved before this version have little to spare.
  - **Real time stays real time** even when the frame rate dips (it measured 1.00× here). With the Kill cam camera it still rides the arrow close up, which can feel like slow motion: pick Follow the shot or Wide for a normal view.
  - **New camera, Follow the shot:** in on the shooter as they draw, out to show them and their target while the arrow flies, then in on the target as it lands. The kill cam is still there.
  - **Vertical 9:16 for phones and reels:** the preview becomes phone-shaped, every camera frames for it, and exports are 720×1280, 1080×1920 or 1440×2560.
  - Exported files are named after the clip and the archer, so a batch doesn't overwrite itself.
- **More kinds of clip from the farm:**
  - **Untouchable:** six or more enemy shots dodged in 8 seconds, dashing about, while dealing damage or knocking someone out. The camera stays on that archer.
  - **Burst:** 130 or more damage dealt in 3 seconds.
  - **Harpooned:** reeled in by a harpoon straight into a hole, water, lava or thorns.
  - **Bullied out:** bullying that ends in the knockout, from the first slam.
  - The same play is no longer saved twice. A long shot that also won the game is one clip, marked with both.
  - **Clips to keep:** every one, the good ones (score 3 or more, the default) or only the best (4.5 or more). Plain game-winning knockouts are no longer kept unless you choose every one.
- **Farm variety (each game):** each player can be swapped for a random ranked AI player of a similar rating, a high rating, a low rating or any rating, playing one of their favourite roles or any archetype. You can also give them random set upgrades (one ability and some passives) and a map effect (none, a random one each game, or a set one). With the arena on Random, it changes every game too.
- **Lava toned down:** the crust is a softer warm brown rather than near-black, the seams are thinner and orange rather than white-hot, and the glow, heat haze, bubbles and rim are all gentler, closer to the rest of the art.

## 0.58.0

- **Clip studio (clip farm):** run the farm as long as you like, then go through every clip it saved and pick the best. Open it from the farm's bar (it pauses the match) or from the farm's setup. The list is best first (or newest, or starred first); **↑ ↓** or **← →** browse, and the selected clip plays on a loop beside the list. **S** stars it, **Space** replays it, **Delete** removes it, **E** exports it, **Esc** closes.
  - **Edit each clip before saving:** kill cam (slow motion, following the arrow) or real time; the camera (kill cam, wide on everyone involved, or the whole arena); playback speed (¼× to 2×); start and end moved earlier or later; names and health, health bars or nothing over the archers; and black bars, particles, floating text, screen shake, the knockout flash and the empowered glow each on or off. A clip keeps its edits.
  - **Smooth exports:** **Export video** draws the replay frame by frame at exactly 60 frames a second and encodes it (VP9 WebM, 720p, 1080p or 1440p), so it's smooth however busy the machine is and however fast the farm was running (no sound). **Export with sound** records it as it plays instead, at a higher bit rate than before.
  - The farm now records every game step (not every other one), so clips from fast-forwarded games are as smooth as ones at 1×. The reel keeps the best 150.
- **Back to setup:** the farm bar's exit button goes back to the farm's setup rather than the main menu.
- The review-after-each-game option (0.57.1) is replaced by the studio.

## 0.57.1

- **Clip farm, the ranked AI players for sure:** the list asks the server for them again each time it opens until it has them (0.57.0 gave up after one try, so opening it before you were signed in left only the difficulty bots), and says why if it can't (not signed in as the owner, or the server not yet on this version). The offline copy has the whole roster built in. Once they arrive, the teams start from named players.
- **Pause:** a Pause button on the farm's bar, or P.
- **Review after each game:** tick it in the setup (or on the bar) and the farm stops when each game ends and goes through that game's clips, best first, playing each one on a loop: **← →** to browse, **S** to keep it (kept clips go to the Reel), **R** to switch between kill cam and real time, **V** to save it as a video, **Space** to carry on (the rest are let go). Best with a fast game speed: it runs at 16× and only stops for the good bits.

## 0.57.0

- **Clip farm, made for leaving running:**
  - **Fast-forward:** 1×, 2×, 4×, 8× or 16× from the bar (no sound above 4×). Everything is still recorded at full detail, because the replays keep every other game step whatever the speed.
  - **The reel:** every best moment (multi-kills, roasts on lava, bullying into walls, long shots), every clutch and every game-winning knockout is saved as it happens, scored, and kept (the best 80, in this browser, so it's still there after closing the page). Open **Reel** on the bar to see them best-first or newest-first, and watch any of them as a **kill cam** (slow motion, close up) or in **real time**, or **save it as a video** (it plays as a kill cam and records). The farm holds still while you watch and carries on afterwards.
  - **Set upgrades:** each player can be given a set list of upgrades (any of their archetype's, abilities marked ★), which they have from the start of the match instead of picking, for footage of particular abilities.
  - **Names:** names and health, health bars only, or nothing over the archers.
  - **Empowerment:** on, on but not shown, or off (nobody gets empowered).
  - The roster's list is clearer: **Ranked AI players** (the named players you meet in ranked, with their rating, tier and mains, and their favourite roles under each pick) and **Difficulty bots** (no name) as separate groups.
- **AI trappers use the new Harpoon well:** a bot with Harpoon now waits for the play: when there's a hole, water or lava between it and its target, it arms the harpoon on the shot it's drawing and reels them through it (the better the bot, the more surely it waits for that); otherwise it only pulls now and then. This goes for the ranked AI players who play Trapper too.

## 0.56.0

- **Harpoon, reworked (Trapper):** using it arms your next shot: a big barbed harpoon on a rope, slower than an arrow. Whoever it hits is hooked (the rope stays on them), and half a second later they're reeled in hard toward you, straight over any hole, water or lava in between. The rope is drawn from you to the harpoon in flight and to whoever's hooked, pulling taut as it reels. The line breaks if you go down or they're over 1,000 px away; a knockout during the pull is yours.
- **Best moments:** plays worth remembering get a callout as they happen and a line in the feed: **Double/Triple/Quad kill** (knockouts within 4 seconds of each other), **Roasted** (knocked out on lava after being held there a second or more), **Bullied** (slammed into walls or thorns three or more times inside 5 seconds by the same archer; five or more is **Merciless**), and **Long shot** (a knockout from 22 metres or more). The results screen lists the match's best three.
- **Practise while you wait:** while a search is running, Find game offers a practice game against a bot (no upgrade picks; it just carries on). A bar at the top says the search is still going and for how long; the match is joined the moment it's found. Back to Find game and Stop searching are on the bar.
- **Straight back into a dropped ranked match:** if the connection drops mid-match, the game reconnects to it by itself (a few tries), and opening the game or reloading the page while your ranked match is still going takes you straight back in. Leaving a ranked match on purpose doesn't (the Rejoin button is still there).
- **Season frames:** a frame for each ranked tier, Bronze to Champion, in the tier's colours with a laurel-wreathed shield (more stars and sparkle the higher it goes). When a season ends, you get the frame for the best tier you reached that season and every one below it. They have their own section in the banner collection.
- **Featured kill cam previews:** a profile card shows the featured kill cam playing, small, beside its button; hover it and it grows to watch, click to watch it full size.
- **Profiles' best moment:** "Best game: 3 knockouts" (capped by how many enemies a game has) is replaced by their most impressive feat: a 1v3 clutch, their longest knockout streak, longest knockout shot, longest win streak, games won untouched or giants slain. The pinned stat "Most KOs in a game" is now Knockout streak, and Win streak and Longest shot can be pinned too.
- **AI players are European:** this is the Europe server, so every AI player is from a European country (Russia included); two names changed to suit (Kiwi_Kicks is now Kipper_Kicks and Mochi is Mieze, keeping everything they had). Their profile pictures show their main archetype instead of everyone having the same one. (Another region's server can re-label the same players.)
- **Clip farm is set up like a lobby:** add up to four a side (1v3, 1v4…), each one any of the matchmaking AI players, listed with their rating and tier, level, skill and mains, playing their mains or any archetype you choose, or a plain bot of a chosen skill. One strong player against three middling ones to start. The scoreboard panel is hidden in the farm, so the arena gets the whole width.

## 0.55.0

- **Spectate friends, and a featured match:** friends' lists say **Spectate** on anyone in a match. The main menu shows **Live now**: the ranked match being fought by the highest-rated players (two or more of them), with its tier, arena, how long it's been going and how many are watching; anyone can spectate it, up to 40 at once. Spectators of a ranked match see it **5 seconds behind** (their updates wait in a queue and go out on a stream of their own), so nobody can watch a friend's match and tell them where the other side is. When the last player leaves, spectators still see those last seconds before the game closes.
- **Multi-kill kill cams:** the earlier knockouts of a double or triple play nearer real time with the shooter, whoever they're knocking out and the arrows all in view, so the next shot is never missed while someone falls down a hole; only the last knockout gets the full slow-motion close-up. The whole thing still fits the gap between games.
- **Kill cam videos with sound, at higher quality:** the saved video now carries the game's sound (tapped after the limiter, before the volume control, so it's at full level whatever your volume is), at 60 frames a second and about 14 Mb/s for 1080p on a machine that keeps up (30 and half that where the game is already struggling, so recording never makes it stutter). The volume control now sits after the limiter, so the limiter always works at the mix's own level.
- **Kept kill cams:** instead of one featured kill cam, your account keeps several (free accounts 3, supporters 12): **Keep on my account** on the results screen, then **Show on my profile** on any kept one. Profile settings list them to watch, feature or delete. The first one kept goes on your profile.
- **Clip farm (owner only):** AI players fight each other locally for footage: arena, 1v1 to 3v3, a skill per bot, elements and roles, the AI players' real names and looks, a camera that follows the fighting, HUD on or off, kill cams on or off, maximum picture quality, and a built-in 60 fps recorder with sound that writes straight to a file. See README.

## 0.54.0

- **AFK and leaving in ranked:** the server watches every human archer while a ranked game is being fought (not during picks, countdowns or while knocked out).
  - After 3 seconds of doing nothing (no moving, aiming, drawing, dashing or abilities), a warning appears with a countdown and a double beep.
  - You're marked AFK after 20 seconds in a row of nothing, or 40 seconds in all across the match, or 45 seconds of play while disconnected (or if you're still gone when the match ends).
  - Marked AFK: the match is a loss at the full rate for you, even if your team wins, and your next search waits 3 minutes (10, 30, then 120 for more within a week; three full matches forgive one). Find game shows the countdown.
  - Your teammates lose only a quarter of the usual rating if they lose. That relief doesn't apply between people who queued in the same party, or if the AFK came in the last 15 seconds, and each player gets it at most three times a day, so it can't be used as a get-out.
  - Leave in a ranked match's menu now says it counts as AFK (rejoining in time avoids it).
- **Tutorial away check is stricter:** 3 seconds without moving, aiming, drawing, dashing or an ability during a fight against the adaptive bot leaves that game out (was 6 seconds of any input at all).
- **Friends' online status:** "Away" now holds up better: a mouse that twitches by itself, or a controller whose stick drifts, no longer counts as someone at the game. A page that's frozen or asleep goes offline after 100 seconds (was 150), and "Away" shows for how long.
- **Find game:** your card no longer jumps about when you pick modes (the ratings stay in one fixed row; the one for your search is in gold), selected modes are clearly marked (gold, with a tick), and the arena preview stays next to its button instead of drifting off screen.
- **Options are compact on computers:** each setting on one line, so the whole screen fits without scrolling.
- **Tutorial pause menu:** no Achievements or Balance data buttons there.
- **Banner frames, redesigned and earned by feats:** sixteen frames that follow the banner's arrow shape, each with its own crest, patterns and movement (icicles and twinkling frost, rising embers, lightning, dripping venom, drifting stars…). Each is earned by one feat instead of total achievement tiers: 150 game wins with an element for that element's frame (games you've already won count), or things like winning a game alone against three (Last Stand), a 30 metre knockout shot (Farsight), 12 knockouts in a row (Reaper), 10 games won in a row without being knocked out (Untouched), 50 hazard knockouts (Thornbound) or 25 flawless matches (Gilded). Backgrounds are earned by feats too (20 knockouts into water for Tidal, a game won hitting every shot for Diamond…). Hovering anyone's banner says what earned it. The achievements screen shows the whole collection with what each takes and how far along you are. (Frames or backgrounds worn under the old rules come off if their new feat isn't done yet.)
- **Kill cam sound:** in the kill cam's slow motion every sound plays slower and lower, like real slow motion.
- **Kill cams on the results screen:** hover one to watch it big.
- **Highscores records that mean something:** longest knockout shot, longest knockout streak, quickest 1v1 game won, best match accuracy (25 shots or more), most ranked wins in a row, and highest rating. These come from ranked matches only, so they can't be farmed against bots. (The old per-game knockouts, damage and ring-outs were capped by the enemy's health.)

## 0.53.0

- **Lava holds you:** anyone flung onto lava slows right down instead of sliding across, and walking on it is 40% slower, so a knock onto lava is properly punishing (Sure Footing softens both).
- **New lava:** pools and rivers are molten rock under a skin of dark, cracked crust plates with glowing seams, more molten toward the middle. Pools turn slowly and rivers flow along their length, the seams pulse brighter and dimmer, glowing bubbles swell and pop, and a scorched rim glows where the lava meets the bank.
- **Tutorial:** the dodge step asks for 5 dodges (was 2), and the ability step uses Volley, which is easy to see working.
- **Ranked opens after the tutorial:** new players finish the tutorial (winning a game against its bot) before Find game lets them search; the server checks this too. Anyone with rated matches is never asked.
- **Skill check:** new players on Find game are offered a few more games against the tutorial's adaptive bot (it carries on where it left off, and about six games is plenty) so their first matches are fairer.
- **Away games don't count:** if you switch to another tab or window, or stop touching the controls for 6 seconds, during a game against the tutorial's adaptive bot, that game is left out: the bot doesn't get easier and your rating guess doesn't drop. A short note says so.
- **Lobbies don't shrink on phones:** adding bots or players to a lobby (and the custom games, Find game and results screens) scrolls the list instead of shrinking the whole screen to fit.
- **New sound mix:** 48 sounds tuned.

## 0.52.1

- **No endless upgrades in the tutorial's practice:** after a normal match's worth of picks (the opening and three more) the rounds just carry on, so the fight stays realistic however long you keep playing. Custom games can use the same limit (`cfg.maxPicks`).
- **A better rating guess from the tutorial:**
  - The early easy wins no longer count: only the games from the first time the bot overshoots you (a loss after wins, or a win after losses) are used. Until then the guess is simply the rating of the bot it has climbed to.
  - The guess is now the rating that best explains those results against bots of known rating (solved properly, with a little prior so a run of wins can't run away).
  - It's saved on your account (or guest record), so it counts whichever device you play on next, and a guess from more games replaces an older one.
  - Its weight in your starting rating goes from 15% (one game past the overshoot) to 60% (four or more), and with it the starting range widens to 450–1150.
- **Measured bot ratings:** the bot's rating at each skill level is now measured, not assumed. The tutorial's Flame Ranger played 240 games at each of ten skill levels against matchmaking's AI players: from about 470 at the easiest to about 1,850 at the top, on the AI players' rating scale (so a new player's guess lines up with the AI players they'll be matched against). `tools/calibrate-tutorial-bot.js` re-runs it.

## 0.52.0

**Tutorial**
- **Time to see what you did:** the steps wait a moment after you've done the thing (about a second after a dash, or after an arrow lands) before moving on.
- **The dodge dummy aims like a person:** it sees where you were about a quarter of a second ago, turns its bow at a human pace and stops adjusting just before it lets go, so a well-timed dash gets you clear.
- **The ability step** moves on once your arrow hits the dummy, not the moment you shoot.
- **Words for your controls:** on a controller it names the controller's buttons; on a phone it says what to tap, and the Q or Dash button lights up when a step needs it. The dash step says "where you're aiming" if that's how you've set your dash, and the dodge step mentions the Dash direction setting (not on touch screens).
- **Your archer:** the step now just says you pick one element and one role, and what each gives you, instead of listing them all.
- **Easier to read:** about 12 words a line, bigger, brighter text; smaller on phones, and it stays on screen.
- **An adaptive final fight:** against a Flame Ranger that starts easy, gets a bit better after each game you win and a bit easier after each you lose, with smaller steps once it overshoots. The match never ends, so you can keep practising as long as you like; the note shrinks into the corner, says the bot adjusts to you, and offers **Find a match** or **Main menu**. Where the bot settles becomes a first guess at your rating (blended into your starting rating once you've played two or more games against it).

**Other**
- **Subtler frost:** the cold haze round chilled archers is thinner, with far fewer, fainter specks in its trail.

## 0.51.0

- **Void reworked around marks:** every Void hit puts a void mark on the target (up to 5), shown as violet motes circling them, brighter for the archer who placed them. Marks fade 2.5 seconds after your last hit. From the second mark on, your own arrows curve toward that archer, only a touch at first and more with every mark, and only on shots already heading their way. In a test at 500px, an unmarked target needed aim within about 3°; at 2 marks about 4°, 3 marks 6°, 4 marks 8° and 5 marks 9°.
- **Rift is now an upgrade:** the rift on a fully drawn hit (or bullseye) moved from Void's base to an upgrade called Rift. Event Horizon, Collapse, Null Field and Unstable Rift now need it.
- **New Void upgrade, Gravity Arrows:** your arrows are dark with gravity: a black-violet halo, a long smoky trail and specks of dark matter drawn in, and as they fly they pull enemies within 110px slightly toward them (on shuriken too).

## 0.50.0

**Matchmaking**
- **Search several modes at once:** on Find game, 1v1, 2v2 and 3v3 are toggles. Pick any you like and you'll get whichever fills first (bigger matches are tried first). Modes too small for your party are greyed out.
- **Closer matches:** the rating window starts at ±75, widens by 5 a second and stops at ±250 (it was ±120, widening 30 a second, up to ±700). At most that's about an 85% favourite.
- **Everyone in range of everyone:** every party in a match has to be within range of every other one, not just of whoever has waited longest.
- **Waiting for someone about to finish:** when AI players would otherwise fill in, but a player who'd complete the match is in the last game of a ranked match (or has just finished one), near your rating, searched that mode last time and usually searches again, the search waits up to 25 seconds more for them. The search screen says so.
- **Play again** on the results of a ranked match puts you straight back into the search with the same modes.

**Elements**
- **Frost:** frozen archers can't draw or shoot while frozen. Deep Freeze is gone (that did the same thing); in its place, **Hoarfrost**: your hits leave a patch of frost where they land for 3 seconds that slows enemies in it by 35% (two patches at a time). **Permafrost** now builds up: 25% slow from the first hit, then 40%, 55% and 65% as you keep hitting, lasting 4 seconds (no draw penalty any more).
- **Chilled archers look it:** the slower they are, the paler and bluer they turn, with a cold haze that clings to them and trails behind as they move.
- **Flame:** new upgrade **Stoke the Fire**: each hit on a burning enemy adds a second of burning (up to 5) and your fire burns 30% hotter.
- **Storm:** **Static** locks the dash for 2.5 seconds, and hitting someone whose dash is already locked stuns them for half a second (once every 3 seconds). **Echo Strike** now works on any fully drawn hit, not just bullseyes. New upgrade **Thunderstrike**: every third storm hit on the same enemy within 6 seconds calls down lightning for 8 damage and a 0.6 second stun. **Overload**'s dash penalty is 20% (was 30%).

**Other**
- **Ninja throws slower:** a shuriken needs 40% of its wind-up to leave your hand and there's a 0.26 second pause after each throw, so tapping throws about 2.3 a second (it was nearly 5).
- **Short card descriptions:** upgrade cards show one short line so you can read them in time. Hover a card for the full text, which is also in How to play.
- **Swap Q and E:** a small ⇄ button by your abilities swaps which one is on Q and which on E. It's remembered, and works with controllers too (not shown on touch screens).
- **Results on phones:** two columns that fit the screen sideways, larger text, the most useful columns, and the buttons in a bar along the bottom. The touch buttons no longer show over it.
- **Main menu:** the clan button sits under the profile button.
- **App icon:** the home-screen icon uses the new, bigger archer.
- **New sound mix:** 37 sounds rebalanced on the sound desk, with the limiter ceiling at −3 dB.

## 0.49.3

- **The first sound mix is in** (`public/sfx/mix.json`, made on the sound desk): 14 sounds rebalanced. Louder: match found (+5.5 dB), the ranked draft opening (+4 dB) and the creaks as you draw the bow (+12 dB). Quieter and less boomy: the crossbow shot (−5 dB, much less low end, softer top), the crossbow reload (−4 dB, less low end, a touch lower and 45% quicker), full auto starting (−4 dB, less low end, quicker), Event Horizon (−7.5 dB), Executed (−3.5 dB) and the bolt loaded sound (−3 dB). Reshaped: the Rip spell is a little lower and much quicker, Rip tearing thorns out is much lower and a bit slower, the stun buzz is lower, quicker and thinner, and Bramble Trap's snap and the angry emote have a little less low end. The limiter stays at its default.

## 0.49.2

- **Limiter on the master out:** everything now ends in a limiter (a fast, hard compressor with a ceiling) followed by a soft clipper, so when lots of sounds go off at once they're held under the ceiling instead of spiking. In a test with two dozen explosions, shots and Event Horizons at once, the raw sum peaked at over five times full scale and came out just under full scale. It's on for everyone by default.
- **On the sound desk,** the master strip has a Limiter on/off button, a Ceiling slider (default −6 dB) and a live gain-reduction readout, and its meter now shows the level after the limiter. The limiter settings are saved in the mix file.

## 0.49.1

- **The sound desk is quiet:** its buttons, dials and lists no longer make the menu hover and click sounds, so the only thing you hear is what you preview (and the game, when one is running).

## 0.49.0

- **Sound desk (owner only):** a mixing desk for every sound in the game, from the main menu (Sound desk) or `/play?desk=1`. Each of the 170 sounds has its own strip: preview (with each version, like the streak tiers or each element's hit), pitch, speed, a 3-band EQ, mute and solo, a fader and a level meter. Groups have their own buses, and there's a master fader. Filter by group, element or role, or search.
- **Takes:** import your own recording into any strip; it sits in that strip's list next to the built-in sound and any other takes, so you can try several and pick one. Imported takes are levelled to match the original, with a dial to adjust. **Export** saves any sound as a WAV, either on its own to edit or as it sounds in the mix.
- **Simulate a game** on the desk: bots play a real match while you listen from one of them, to hear the mix in context. Switch between your mix and the original sounds to compare.
- **Save mix file** downloads the whole mix (with your takes); the game plays a mix placed at `public/sfx/mix.json`. Work in progress is kept in your browser in the meantime.
- Under the hood every sound now plays through its own channel, so a mix changes the game itself, not just the desk.

## 0.48.5

- **Praises after each game are big callouts now:** instead of a line of text in a box, each one gets a short title with the detail under it, like "Quick one · Over in 12 seconds", "Bot Quill is Dominating · 3 of Red's 3 knockouts", "Sharpshooter", "Close call", "First blood", "Ring out", "Flawless" and "Clutch!", each in its own colour. They pop in on a flat band edged in that colour, with a whoosh and a thump on the bigger ones.
- **Flatter style for the big announcements:** streaks, shutdowns and empowerment use the same flat look: solid colour, a hard dark outline and a dropped shadow, no gradients, glow or shine.
- **Map effects are announced once,** as the match starts, not every game, and they clear sooner (about two seconds) so they're gone before the fight.
- **Ricochet Arena is gone:** with every arrow bouncing there was too much going on to follow the fight. A saved "Ricochet Arena" choice falls back to Random.

## 0.48.4

- **Big announcements look and sound the part:** streaks, shutdowns and empowerment between rounds now slam in as a large title on a coloured ribbon: a white-to-colour gradient with a dark outline and glow, a shine sweeping across it, the name above and the detail below. Each one has a whoosh, a thump as it lands and a bright ring. Streak titles step up in colour and size: Rampage (3, gold), Dominating (5, orange), Unstoppable (7, red, with a shockwave and a shake) and Legendary (10, pink). Shut down is ice blue. Mid-fight they still go small in the corner so the arena stays clear.

## 0.48.3

- **AI players have a focus:** they watch the enemy they're fighting, glance at the others now and then (sharper players look round more often), and notice anyone who comes close. A shot or a drawn bow from someone they aren't watching goes unnoticed, so they no longer parry, deflect, gust or dash out of the way of a side shot while busy with someone else. In a test with a bot fighting one archer while a second shot at it from the side, its parries dropped by about 40% and the side shots landed about half as often again.
- **Map effects announced each game:** as each game starts, the match's map effects slide in under the round banner, one pill each with an icon, its name and what it does, with a little chime and shine (below the arena on phones).
- **Two map effects show properly:** the lobby, the ranked draft and the in-game chip now show both effects when a match rolls a pair (before, a pair could leave them blank).

## 0.48.2

- **Kill cam videos in online games:** the country flags over archers' heads were loaded from another website, and a browser won't record a canvas with another site's pictures on it, so online kill cams (where people have flags) came out with no video. Flags are now served by the game's own server (`/flag/xx.png`, fetched once from flagcdn and kept in memory), so the kill cams record again.

## 0.48.1

- **Kill cams are labelled by what happened:** each one on the results screen (and on your profile) says how the knockout went, who it was and where, like "Slammed into a wall · Bot Quill · Meadow", "Rip kill · fox · Tide Cove" or "Double kill: burnt on lava, frost arrow kill · Ember Rift".
- **Map effect descriptions** just say what the effect does.

## 0.48.0

- **Emotes:** press 1 to 8 while playing for laugh, angry, thumbs up, GG, cry, cool, wow and heart. Each one pops up over your archer for everyone in the game, with its own little animation (the laugh shakes, the angry one seethes, the cry drips tears, the heart beats) and sound. One every second and a half. On phones and tablets there's no button unless you switch it on in Options; then a small see-through button by the camera button opens a row of them.
- **Kill cam shows the whole play:** when your knockout came at the end of a run of hits on that archer (gaps under about a second and a half, up to four and a half seconds back), the kill cam starts at the first hit, framing you both, plays the run near real speed, then slows right down for the final arrow. One-shot knockouts still play as before.
- **More map effects:** Heavy Blows (35% more knockback), Quickdraw (draw and reload 30% faster), Arcane Surge (abilities recharge 40% faster) and Ricochet Arena (every arrow bounces once off walls and boulders). About one match in five now rolls two effects at once (they show together in the lobby and in play); one in five is still calm.
- **Profile kill cam** plays by itself in a box on the profile, on a loop, with a Full screen button.
- **AI players don't type mid-fight:** anything they'd say during a game now waits until a few seconds into the kill cam (and is dropped if it's gone stale); their hello comes while everyone's making their opening pick.
- **Blood looks like blood:** Transfusion's orb is a dark, glossy drop of blood with a dark trail, flying almost straight to your teammate. The heal pulse on your archer is a deep red through the body with a dark red glow swelling out round it (no white). The healing motes are darker too.

## 0.47.0

- **Kill cam:**
  - Knockouts close together (within about three seconds) now play straight through as one continuous clip instead of cutting between them.
  - A Rip knockout starts on the caster as they cast, then pans to the victim as the thorns tear out.
- **Your kill cams at the end of the match:** no more pop-up asking to save mid-game. Every kill cam of yours from the match is listed on the results screen, where you can watch each again (tap to play), save any as a video, and put one on your profile.
- **Bramble Trap** recharges faster (6.5s, was 8.5s), to hold its own next to Bramble Toss.
- **Rip is a trade-off now:** taking it makes your arrows deal 8% less damage.
- **Blood you can feel:**
  - Every heal sends a red pulse through your archer.
  - Transfusion's spare healing now gathers into a glowing blood orb that leaves you at an angle, curls through the air to your teammate with a trail, and heals them when it lands (with a pulse on them too).
- **Stone you can feel:**
  - Stone arrows carry a rock head and shed dust.
  - Hits crack off rock chunks and a ring of dust, heavier on full draws.
  - Staggered archers get a cracked stone crust, pebbles drifting round them and dust falling off.

## 0.46.0

- **A new front page for the website.**
  - **The hero:** behind it, a real match plays out between bots on the game's own renderer (four archers, a new arena each match), under a big BOWFALL wordmark and a Play now button. Phones, data savers and reduced-motion settings get a still picture of an arena instead.
  - **Sections:** how a fight goes (draw, knock, outplay); an archetype forge where you click through every element and role and see the archer drawn by the game, with its base effect, trait and upgrades; every arena with the game's own art; the ways to play (ranked with the tier badges, custom, friends, practice); top players, open games and the forum; and a closing call to play.
  - Sections fade in as you scroll.
- **Browser tab icon:** just the archer now, on a transparent background and filling the icon, so it reads at tab size (16px and 32px versions, and a new favicon). The site's header uses it too.
- **Kill cam:**
  - It now records and replays far more effects exactly as they looked live: Rip's wind-up and the thorns flying back, shade stacks and bursts, Eclipse, boomerang turns and catches, Mend, Flashpoint, smoke, totems, harpoons, blinks, gusts, deflects, stagger, snares, Echo Strike and more.
  - Animations run on game time: in slow motion (and the kill cam's slow-down at the hit and the knockout) spins, pulses and particles slow down with it, so a boomerang spins slower in a slow-motion replay.

## 0.45.4

- **Rip:**
  - The pull is quicker and more violent: thorns wrench free with a harder shake and snap across into you faster, one right after another, with a brighter trail and a little kick on landing.
  - Each thorn in an enemy slows them 5% (up to 25% with five).
  - Ripping a full set of five roots them for 2 seconds instead of 1.
  - (Already the case: thorns you land during the one-second wind-up are torn out too, and Blood heals from rip damage.)
- **Boomerang** flies about 20% slower, out and back.

## 0.45.3

- **Results screen:** the rating pop-up (rating, change, promotion) no longer appears over the Victory or Defeat headline when a ranked match ends. The rating is shown in its own line on the results, counting up, as intended.

## 0.45.2

- **Rip, as a spell:** no vine at all now. While it winds up, the thorns in the victim glow green and strain, motes of light drift toward you, and your hands light up, with a rising shimmer. Then each thorn is drawn out of the body in turn (a spurt of blood as it comes free) and flies through the air into your hands on a streak of green light.
- **Boomerang** is wider again: a bigger blade with a bigger hitbox.

## 0.45.1

- **Bramble Toss** spins much faster and flies a bit slower.
- **Crossbow Fireworks** now look like fireworks (they were drawn as bolts), and they no longer slow down and drop at bolt range like a bolt did.
- **Rip:** the green vine tether is gone. While Rip winds up, the victim's thorns strain toward you under a faint red glow; then the thorns snap out and whip across into you one after another, very fast, trailing a little blood.

## 0.45.0

- **Map effects:** each match can roll an effect, shown in the lobby (and the ranked draft) before anyone picks, so you can choose your archetype round it, and as a small chip under the round during play:
  - **Warden's Vigil:** every archer heals 2.5 health a second, all the time. Burst them down, or dig in and outlast.
  - **Gale Winds:** everyone moves 20% faster and every shot flies 20% faster.
  - **Juggernaut's Hide:** every archer takes 30% less damage from arrows. Knockback wins.
  - **Bounty Hunt:** power-ups about twice as often, up to three at once, all over the arena.
  - About one match in five is calm, with no effect. Hosts can pick one, or none, under Custom rules. Tutorial, training and Strongholds never have one.
- **New arena: Sideline Sawmill.** One huge boulder in the middle to fight round, with saw blades racing along both sidelines.
- **Bramble Toss** (was Bramble Line): your next shot tosses an actual bramble trap, the same look and size as a Bramble Trap, spinning as it flies. It's slower, with more reach (up to 760px), and the aim band is as wide as the trap.
- **Rip:** vines now reach from you to everyone carrying your thorns and pull taut for a second (with a creak), then the thorns tear out and fly back toward you. Thorns no longer carry over between games.
- **Shadow:** shades no longer carry over between games.
- **Boomerang:** flies slower and spins faster, a little wider, with a little less damage and knockback to make up for it.
- **Eyes:** archers blink now and then, each on their own rhythm, and screw their eyes shut for a moment when they're hurt (and while stunned or frozen).
- **Sounds:** the storm crackle is shorter and higher (it was grating when heard all game), and the stun buzz is much quieter and holds a steady pitch instead of sliding down.

## 0.44.0

- **Bramble Line, redone for touch screens:** pressing it now arms your next shot instead of firing straight away, so on a phone you press the button, then aim and draw with the other thumb as usual. Your shot becomes a spinning bramble ball that rolls straight along your aim, slower than an arrow (further and faster the longer you draw, up to 560px). It roots everyone it rolls through for 1.8 seconds (8 damage) and stops at walls and boulders. While it's armed, a faint band as wide as the ball shows where it will roll.
- **Shadow, stacking:** every hit adds a shade (up to 5) and restarts a 3-second fuse. When the fuse runs out it bursts: barely at one shade (2 damage), hard at five (31). The target gets darker with every shade, and a ring shows the fuse running down. Creeping Dark slows 6% per shade, Night Terror throws harder the more shades there were, Deep Shade is +50%, and Nightfall adds two shades a hit.
- **Ninja draws its shuriken:** hold to wind up, let go to throw. A full wind-up takes 0.42 seconds and throws faster, further and harder (up to 8.5 damage); a quick flick is weaker. No more click-spam. Flurry winds up 30% faster. Blade Guard's full auto is unchanged.
- **Boomerang:** it now flies all the way across the arena until it touches a wall or boulder, then comes back. It's slower than an arrow, faster the longer you draw, and spins much faster. It carries your element (frost, fire, poison and the rest), as before.
- **Smoke Bomb** drops on yourself, not at your cursor, and is bigger (120px).
- **Sniper:** arrows fly 25% faster (was 10%), and the 10% slower draw is gone; the longer pause between shots stays. In bot tests Snipers were losing because they shot less often, not because they missed.
- **Rip's thorns are easy to see:** fat barbed spikes round the target with a count, a red ring at 3 or more, and a proper tear-out when you rip them.
- **Seeker Arrow** (and Firework) now swerve round boulders in their path, and no longer lead a target into a spot behind cover.
- **Custom games:** a new **Arrow damage** slider (50–200%).
- **Balance:** checked over about 9,800 bot games. Roles now sit between 47% and 56% (Ninja was 63%, Sniper 42%). Bots' upgrade picks were re-learned, and they arm Bramble Line when a target is in its path and drop Smoke Bomb when hurt or outnumbered.

## 0.43.0

**Upgrades reworked.** A big pass over the upgrades that felt clunky, gimmicky or invisible. Bots know how to use every new ability.

- **Dashing: no more charges.** Everyone has one dash on a short cooldown (about 0.85 seconds; Rangers a little quicker; Quick Dash 35% faster). Ninjas blink once, recharging in under a second (Swift Shadows: 30% faster). Anti-dash upgrades (Static, Petrify, Null Field and the rest) work as before.
  - **Double Dash** is replaced by **Momentum** (Ranger): for 0.6 seconds after a dash, your arrows fly 30% faster and hit 20% harder.
  - **Third Step** is replaced by **Echo Step** (Ninja): within 1.2 seconds of a blink, dash again to blink straight back to where you started, free.
- **Boomerang, redone:** pressing it swaps your bow for a boomerang (held further back as you draw). It's a wide spinning blade that flies straight out through enemies, turns back at full range or off a wall, and homes back to you through everything, hitting everyone again on the way back for 50% more. Catch it to halve the cooldown (7s).
- **Parry, simpler:** a 0.6-second guard (7s cooldown). Block an arrow and your next shot is drawn instantly. That's all.
- **Rally** is 20% faster (was 15%), and you can see it: a soft green aura shows its reach around whoever has it.
- **Curve Shot** is replaced by **Bank Shot** (Trickster): one more bounce off walls and boulders, and arrows that have bounced deal 40% more damage and knockback.
- **Elemental Burst** is gone.
- **Shadow, rethought:** no more shrouding on every bullseye. Fully drawn hits (and bullseyes) plant a **shade** that bursts 1.2 seconds later for 7 damage; hit them again before it bursts to deepen it (12). **Eclipse** (new ability, replaces Blinding Dark) drops darkness on a spot for 4 seconds, shrouding enemies inside. **Creeping Dark** makes shades burst sooner and slow, **Night Terror** makes them throw the target away from you, and **Deep Shade** (trade-off, replaces Lingering Dark) makes them 70% stronger. Nightfall: every hit plants a shade, and they burst faster.
- **Flame:** **Inferno** is replaced by **Flashpoint** (hitting a burning enemy bursts into flame around them: 4 damage to everyone within 110px, setting them alight), and **Pyre** by **Kindling** (burning enemies take 50% more knockback from you).
- **Forked Lightning** chains properly: up to four jumps from enemy to enemy, reaching further (220px).
- **Trapper:** **Bramble Coat** is replaced by two abilities: **Bramble Line** (a 380px line of thorns along your aim that roots everyone it crosses) and **Rip** (your hits leave thorns, up to 5; rip them all out for 5 damage each, rooting anyone with 2 or more).
- **Warden:** new ability **Mend**: heal the most hurt teammate within 350px (or yourself) for 25.
- **Sniper:** new upgrade **Hold the Line**: hits on enemies within 250px of you knock back 50% harder.
- **The storm stun** sounds like a proper electric buzz.
- **Bots:** they use Boomerang, Eclipse, Bramble Line, Rip (when there's a pile of thorns, a kill, or someone held near a hazard), Mend, and Echo Step (blinking back out after a strike, or away from a hazard), and fire their Momentum shots straight after a dash. Their upgrade picks were re-learned from about 20,700 bot games under the new rules.

## 0.42.1

- **Locked picks are locked in custom games too** (when the owner has locks on): online custom games now follow the same rule as ranked, so a premium element or role needs unlocking (or this week's free pick) there as well; anyone joining with a locked one is switched to a free one, and the lobby shows them as Locked. Practice against bots and training still have everything, for trying them out.

## 0.42.0

- **Online status that's right:** a page put away (a phone locked or switched to another app, a tab hidden) now shows as Away after 30 seconds even though the phone stops running the page, because the server times it; and a page that hasn't been heard from for two and a half minutes (a phone asleep, a laptop shut, its connection still lingering) shows as offline. Friends' lists update on their own within ten seconds.
- **Browser tab icon fixed** (the icon link was broken, so Chrome showed a globe): the tab now shows the new archer icon, with a real favicon.ico too.
- **New app icon:** a Storm Ranger archer on the Meadow's grass, for the installed app and the home screen.
- **Free rotation: one a week,** a premium element one week and a premium role the next, instead of one of each.
- **Unlocks are a grind:** a premium element or role now costs 12,000 Crests (was 4,000), around fifteen hours of matches. (The £2.49 price is unchanged.)
- **Controllers on phones and tablets:** pressing anything on a connected controller (Bluetooth Xbox, PlayStation, or any standard pad) puts the touch controls away and plays as on a computer, keeping the phone's camera; touching the screen brings them back. Menus and the phone sheets work with the controller too (B closes a sheet).
- **Phone main menu:** a bigger BOWFALL title, smaller tiles (Find game stays big), and your profile above your clan.
- **Strongholds, much grander** (still a preview): the whole map is half as big again with more ground between everything; Castle Greyhold is bigger again, inside a wide moat right round its walls, crossed only by two drawbridges at its gates; and walls of forest (trunks you can't walk or shoot through, under canopies you can hide beneath) close off each camp and both river banks, so you get about by forest paths and the bridges' approaches.

## 0.41.0

- **Phone menus redesigned for the space, not shrunk to fit.** On a phone held sideways, a section you'd change now and then shows as a one-line summary of what's chosen ("Arena · Meadow", "Match settings · First to 3 · bots Normal"); tapping it opens that section full-screen to change it, with Done to come back (picking an arena closes it by itself). Everything is shown at full size.
  - **Main menu:** the title and a grid of tiles on the left (Find game the big one, with its description), your profile, clan and friends down the right; nothing scrolls or overlaps.
  - **Lobby:** the teams on the left; your archetype, the arena (with its picture) and the match settings as three summaries on the right. The arena sheet shows every arena large, with its description.
  - **Find game:** your rating and the arena preferences as summaries above the Find match button, party and friends beside them.
  - **Options:** Controls, Sound, Graphics and Gameplay as four summaries; each opens with its settings in two columns.
  - **Edit profile:** name, then Picture; Title, border and flag; and Your profile page as summaries.
  - **Challenges:** your banner as a summary; the challenges list scrolls under a fixed header at full size.
  - **Clans:** the start-a-clan form in three columns, with the emblem editor in its own sheet.
  - **Store, Highscores, How to play, Controls:** full size, scrolling inside under a header that stays put.
  - **Someone's profile:** their banner (picture, name, ranks) down the left and stays put, everything else beside it; the banner is no longer squashed (on any screen, the card no longer squeezes its banner to fit).
  Desktop layouts are unchanged.

## 0.40.1

- **Fewer pop-ups mid-fight:** messages like "You ended …'s streak" or "… is on a rampage" show small in the top-left corner while a game is being played, instead of across the middle of the arena (between games they're shown as before).
- **Touch: archers under your thumbs** are now shown like the off-screen ones: a small arrow on the line from your archer to them, where it goes under the thumb, pointing at them (so you know which way to shoot).
- **Touch: the top buttons** (camera, full screen, sound, menu) are white and see-through like Dash, Q and E, and the same size.

## 0.40.0

- **Touch: tap to place abilities.** Abilities aimed at a spot or an enemy (Bramble Trap, Arrow Rain, Spotter's Mark, Smoke Bomb, Flash, Blink, Shadow Strike) are readied by tapping their button (it pulses, and "Tap where to use …" shows); the next tap on the arena says where, or picks the enemy nearest it. Tap the button again to put it away.
- **Touch: archers under your thumbs.** When an archer is hidden under one of your thumbs, a marker in their team's colour shows just above that thumb, pointing down at them.
- **Touch: shots go where you were aiming.** A thumb rolls as it lifts and used to drag the aim with it; the shot now uses the aim from just before you let go, and your archer doesn't start turning toward the enemies for a moment after a shot.
- **Touch: clearer buttons.** Dash, Q and E are white and see-through, so the fight shows through them; the kill feed is hidden on phones.
- **Phone camera:** a closer step (Fixed, Follow, Close, Closer), and the view runs a little further past the walls, so at the edge your archer stays nearer the middle.
- **Phones: end-of-game messages are centred on the screen** (they followed the arena, which the camera may have off to one side).
- **Amber points are no longer shown** (the HUD counter, the scoreboard column and the "+N amber" pop-ups). Amber pickups still give their boost.

## 0.39.9

- **Touch aiming fixed:** a thumb landing on something drawn over the arena (the how-to-play card, a stick's ring, the top bar) now still aims or moves, instead of doing nothing, and a touch the phone never reported as lifted no longer blocks the next one.
- **No pinch or double-tap zoom** on the game page (two thumbs on the screen could start the browser zooming instead of aiming).
- **Bots close in on archers who outrange them** (crossbowmen and ninjas against bows), instead of dodging side to side out of reach:
  - every dodge also steps forward, diagonally (a dash dodge too), so dodging gains ground;
  - a weaker shot is sometimes just taken rather than given up ground for, when the hit wouldn't throw them into anything and they're healthy;
  - a long way out, they dash in the moment after the bow looses, while the next shot is still being drawn;
  - a boulder or wall between them and the bow counts for more when picking the way in.
  Against a bow standing far off and spamming shots, a master crossbowman went from in reach 9% of the time and winning 60% of games to 20% and 81%; against a master bot that kites, from 24% to 47% in reach, and its opponent gets half as many shots off. Its other matchups are unchanged.

## 0.39.8

- **Lag diagnostics (F9):** a single short server pause (60–100 ms, a memory clean-up or the host briefly busy elsewhere) no longer reads as "The server is struggling to keep up"; it shows as a warning (!) instead. The server is only blamed when it loses game time, is held back or maxed out, pauses for over 100 ms, or pauses more than once in 10 seconds.

## 0.39.7

- **Phones: menus fit without scrolling.** On short screens (a phone held sideways) every menu card is scaled to fit the screen's height and let out to its full width, and the desktop layouts are kept instead of collapsing to one tall column. Screen by screen:
  - **Lobby:** teams beside your archetype, the arena picker in one row across the bottom with the match settings beside each other, and only one open slot shown per team. (The Alt+click hint is hidden.)
  - **Find game:** the arena tip and achievement list on your card are hidden.
  - **Options:** Controls and Sound share a column, Graphics is two columns wide, and Your own archer, Phone camera and Touch aiming moved to Gameplay (on every screen).
  - **Controls:** the keyboard section is hidden on touch screens.
  - **Store:** all unlocks in one row.
  - **Highscores:** the list runs in three columns.
  - **Challenges:** six across, with the banner options in one row.
  - **Clans:** the start-a-clan form sits beside the emblem editor.
  - **Edit profile:** the profile page settings are two columns.
  - **How to play:** the sections become tabs, one at a time.
  - **In-game menu:** only one open slot per team.
  The longest screens stop shrinking at 60% and scroll a little rather than get unreadable (the arena builder can still scroll).

## 0.39.6

- **Touch: your archer faces the enemies** while you're not aiming, turning smoothly toward their general direction (nearer enemies count more), instead of staying frozen on the last aim.
- **Off-screen arrows point the way to shoot:** each one sits on the straight line from your archer to that archer, where it leaves the screen, pointing along it.
- **Phone camera runs a little past the walls**, so near the edge of the arena your archer stays nearer the middle of the screen.
- **Phones: the score and timer are centred** on the screen.

## 0.39.5

- **Touch aiming points again** by default (pull back stays in Options → Touch aiming).
- **No button click sound** from the touch buttons (Dash, Q, E, full screen, camera), so aiming over them is silent.
- **Off-screen archers on phones:** when the camera follows you, an arrow at the screen's edge points to each archer out of view, in their team's colour (enemies bigger and white-edged), kept below the top bar.
- **Camera button on phones:** a magnifier by Sound and Menu switches the camera between Fixed (the whole arena), Follow and Close; the full screen button moved up there too, out of the arena. (Options → Phone camera has the same choice.)
- **Phone main menu fits without scrolling:** the friends list, profile and clan sit in a column on the right, with the title and menu on the left.

## 0.39.4

- **Phones: bigger again.** The view crops nearly all of the wall and no longer keeps room for the top bar or the buttons, and by default zooms in a little further and follows your archer (Options → Phone zoom: Whole arena, Closer or Closest).
- **Computers: a little closer** too: half the wall is cropped off.
- **Touch aiming pulls back like a bow:** drag your right thumb away from where you want to shoot. Options → Touch aiming switches back to pointing.
- **Aim over the buttons:** a quick tap on Dash, Q or E uses it; holding or dragging from a button aims and draws your bow instead. (While you're already aiming with another finger, a touch on a button uses it at once.)
- **Aim guide line easier to see:** brighter, a touch thicker (and never thinner than about a pixel and a half on small screens), with a stronger dark edge.
- **Phones: menus fit the screen.** On short screens the main menu is two columns without the descriptions, and cards, menus and the upgrade pick shrink to fit; the touch buttons hide during the upgrade pick. The kill cam's Save video bar is small and sits at the bottom instead of the middle.
- **One device at a time:** opening Bowfall on another device (or tab) takes over, and a search the first one started stops; the first shows "searching is paused here" with a Play here button.
- **Away fixed:** after a reconnect (a server restart, a laptop waking) a player who was away showed as on the main menu until they touched something; the new connection now says straight away, and the page repeats its status every minute.

## 0.39.3

- **Phones: install Bowfall as an app.** The site is now an installable web app: on Android Chrome use the menu's **Install app** (or Add to Home screen); on iPhone, Safari's Share → **Add to Home Screen**. It opens full screen, sideways, with no browser bars, and has its own icon.
- **Phones in the browser go full screen** at your first touch in a game (Android; iPhone Safari doesn't allow it, so install it there). A full screen button sits on the left if you leave full screen; leaving it mid-game stops it coming back on its own.
- **Phones: a bigger arena.** The view zooms to the playing area itself, so the forest and trees round the outside only fill the spare space at the sides, and less room is kept for the top bar.
- **Phones: a touch-first HUD.** The Q and E buttons show their ability's name and cooldown (a sweep and a countdown, gold when ready), and Dash shows its recharge, so the ability cards along the bottom are gone. Sound and Menu are icons, the Dash bar is dropped (the button shows it), the Empower meter is smaller, and the top bar's text is shadowed so it reads over the grass.
- Server: the core count in the once-a-second performance record is read once at start instead of every second (it showed up in a server profile).

## 0.39.2

- **Browser tab icon:** the Bowfall logo (bow and arrow on gold) on the game and the website.
- **Discord button** is now just the Discord logo, on the right under the Friends box.
- **Aim guide line:** softer again. The dark edge is thinner and lighter and fades out along the line with the gold, and the line itself fades more toward its end, as before. (Bold in Options is unchanged.)
- **Custom game invites count as friend invites:** when you're signed in, the lobby's Copy invite link carries your name, so a newcomer who joins your game from it and then makes an account counts as your invite (and you both get the Crests after their 3 ranked matches).
- Your profile button shows Unranked instead of ratings until your placement matches are done.
- HOSTING.md: the Stripe webhook address example uses `www.`.

## 0.39.1

- **Join our Discord:** set `DISCORD_INVITE` (a `https://discord.gg/...` link) in the environment and a Join our Discord button appears on the game's main menu, with a Discord link in the website's menu and footer. HOSTING.md explains making the server.
- HOSTING.md: the Discord and Google sign-in redirect addresses now follow `PUBLIC_URL` (with `www.` when your domain uses it).

## 0.39.0

- **Banners redone:** six **frames** with real style on top of the background: Circuit, Rime, Primal, Shadow, Bloodied and Gilded, with subtle animation (a scanning sweep, a cold shimmer, a creeping dark, dripping blood, a pulsing gold glow). Four new **backgrounds**: Carbon, Hex plating, Woodland camo and Tidal (moving waves). Frames unlock with achievement tiers. Your profile shows a **bigger banner**: the name large, with level, flag, clan, title, trophies and medals on a compact second line. Hovering a medal now says what the achievement is for. (The "Finish" option is now called Background.)
- **Easier to find yourself in team games:** a wide, faint gold halo with a slowly turning dashed ring round your archer, and teammates drawn a little dimmer. (Options → Your own archer → Lightly marked turns both off.)
- **Bramble Trap:** range up from 380 to 450, cooldown down from 10 to 8.5 seconds.
- **Invite a friend:** Invite in the Friends box gives you a link; when someone new makes an account from it and plays 3 ranked matches, you get 500 Crests and they get 250 (up to 25 friends).
- **Ratings hidden until placed:** until your 5 placement matches are done you're shown as Unranked everywhere (Find game, party, friends, profiles, after a match), and you're not on the rating leaderboards; the rating still works behind the scenes for matchmaking.
- **A slower standard pace:** move speed is now what used to be the "slow" setting, and knockback is about 13% lower. (Training drills use it too, so drill times may be a little slower than before.)
- **Custom rules sliders:** arrow speed, move speed, knockback and health are now sliders (a percentage of the standard, 100% in the middle), so hosts can fine-tune them; a Standard button resets one. Old saved choices and records are mapped onto the sliders.
- **Fully drawn bow sound is louder** (about three times), and the held creak a little louder too.
- **Away also when idle:** friends now show as Away after 30 seconds with no mouse, keyboard, touch or controller input (or with the game out of view), not just when the page is hidden for a minute.
- **Lower starting ratings:** a new account's estimated start (from bot wins and drill grades) now tops out at 1000 instead of 1200, so a beginner who beat hard bots doesn't start above experienced players.

## 0.38.0

- **Bots and AI players play short-range roles properly.** A Crossbowman (or Ninja) bot used to hang back where it was safest, which was out of its own range, and could go a whole game without firing. Bots now weigh being outranged much more heavily: they approach behind boulders, dash the last stretch when it lands them in range (never into a hazard, and not into a drawn bow), fire using where a retreating target will be, and keep cover while reloading. Easy bots do this rarely, master bots constantly. Bow roles' behaviour is unchanged. In bot-vs-bot tests a mid-skill Crossbowman's time in range went from 40% to 56% and its win rate against a Ranger from 42% to 59%.
- Fixed a bot bug on every role: a pickup lying in a bog made bots dither at the bog's edge for seconds.
- **Away status:** friends show as Away (amber dot) once their game has been out of view for a minute (another tab or window), unless they're in an online match.
- **Players online** count on the main menu.
- **Messages collapse** to a small Messages button in the corner when closed, with the unread count; it also appears on its own when a message arrives.

## 0.37.3

- **Aim guide line easier to see:** it now has a dark edge under the gold dashes and is a little stronger, so it shows on pale ground (Tide Cove's sand) as well as grass. The red X where a shot would hit a boulder or a close wall has the same edge.
- **Options → Aim guide line → Bold:** a thicker, brighter line with longer dashes, for anyone who wants it plainer still.

## 0.37.2

- **Real profile pictures on the website:** the website profile now draws your picture with the game's own archer drawing (borrowed from a hidden copy of the game page), so it matches what you see in the game.
- **See your profile as others do:** your profile button in the game now opens your profile card, the same as everyone sees it, with an **Edit profile** button. The edit screen has **View my profile**, and Done takes you back to your profile.
- **Website:** your own profile page shows what everyone sees, with an **Edit profile** button that opens your profile page settings (backdrop, motto, accent, pinned stats, flag), title, flag and sign-in settings. Profile page settings can now be changed on the website too.

## 0.37.1

- Fixed: the featured kill cam on website profiles showed squashed into a thin strip (the embedded replay page picked up the clan emblem editor's layout).
- AI players' chat after a match is less samey: only one or two of them speak, a few seconds apart, they don't open the same way as the last few messages ("gg… gg… ggs"), and there are more lines that don't start with gg. A close finish or a sweep gets a line about it half the time, otherwise their own personality's. After a single game, at most one of them says something.

## 0.37.0

- **Ranked tiers and seasons.** Bronze, Silver, Gold, Platinum, Diamond and Master (each III, II and I), then Champion, from your 1v1 and team ratings, with a badge for each. Shown on Find game with your progress to the next division and the days left in the season, after each ranked match (promotions get a fanfare line), on party rows, the leaderboards and profiles. Seasons run three months; at the end your peak tier is recorded, you get Crests for it, ratings soften toward the middle and there are 3 placement matches. Owner command `/season`.
- **Rejoin a ranked match** you dropped out of: your archer and seat are kept, the main menu shows Rejoin, and a reload goes straight back in. Leaving no longer dodges the result.
- **Block players:** from their profile card or a message conversation. No messages, invites or friend requests from them, and their chat is hidden in your games. Unblock from Find game.
- **Profiles redesigned to show off:** a hero with your backdrop arena and accent colour, a big name, your banner, a big faded flag, motto, tiers and clan; then what makes you stand out (your main and mastery, best rank and season peak, strongest playstyle, best game), four pinned stats you choose, your featured kill cam, achievements and seasons. In the game (click any friend, or Preview in Profile) and on the website. Customise it in Profile → Your profile page.
- **Kill cams for multi-kills:** when the winning archer knocked out others in the 8 seconds before, those knockouts are shown too (Double kill, Triple kill…), cutting between them. The slow motion now eases in and out, and the camera chases fast arrows harder so they stay in view.
- **Save and share kill cams:** your own kill cams are recorded as they play. **Save video** downloads the clip (or opens the share sheet on a phone); **Show on my profile** features it on your profile, where anyone can watch it (also at `/play?clip=…`).
- **Touch controls** for phones and tablets: twin sticks (left to move, right to aim and shoot; a tap shoots the nearest enemy) and Dash, Q and E buttons. The scoreboard tucks away on small screens and the how-to-play hint explains the touch controls. Hold phones sideways.
- **Colour-blind friendly colours** (Options → Colours): orange and blue teams.
- **New arena: Harvest Field** (a farm: hay bale lanes, wells, duck ponds and mud in the middle), replacing Frozen Lake, which is out of the rotation (the ice is gone; it can come back without the sliding).
- **Training drills use standard rules:** they're now played as a plain Frost Trapper with no upgrade picks. The Ranger used before moves 5% faster and keeps more speed while drawing, which made the drills feel faster than normal games.

## 0.36.0

- **New arena: Frozen Lake**, in place of Portal Ruins (which is out of the rotation for now). A snowy clearing ringed by pines with a frozen lake in the middle. Out on the ice you slide: you're slower to turn and stop, dashes carry further, and knockback sends you much further, so a hit near a hole is deadly. Two holes are open from the start and two more crack open (with a warning) 35 and 70 seconds into each game. The banks are normal ground with snowy boulders, thorn bushes and soft snowdrifts that slow you down.
- Ice can now cover just part of an arena (`ice.zone` in an arena's definition).
- The arena builder has a Snow look.
- Fixed: the in-game chat overlapped the Empowered box in the bottom-left corner. The box now shows just the name (the description is in its tooltip, and in the announcement when you become empowered), and the chat always sits above that corner.

## 0.35.0

Friends and parties.

- **Messages between friends.** A Messages panel (from the Friends box on the main menu, or Message on the Find game screen) lists your friends down the side with the conversation on the right. Messages reach friends who are offline too: they see an unread count when they're next on. A new message pops up with a short sound on the menu (silently in a game). Up to 300 characters, a gentle limit on how fast you can send, and only between friends; the last 300 messages of each conversation are kept. Deleting an account deletes its messages.
- **Ready up in a party.** Party members press Ready (or Not ready) on the Find game screen; the leader can start the search once everyone is ready, and hears a chime with a small "X is ready" pop-up. Players on the leader's own controllers count as ready.
- **Offline friends are listed** on the main menu (under a collapsible "Offline" heading).
- **Friend profiles in the game:** click a friend's name to see their ratings, games, wins, win rate, knockouts, accuracy, favourite roles and elements, and achievements, with buttons to message, invite, watch their game or open the full profile on the website.
- **Watch a friend's game:** Watch next to a friend who's playing. A ranked match is watch-only (no team, picks or chat; up to 8 watching), a custom game is joined as usual.
- **AI players chat more like people.** Many more lines, and new moments: first blood, three knockouts in a game, walking into a hazard, a player falling in on their own, clutch rounds, the deciding round, match point, falling behind, sweeps and close finishes. They answer greetings, gg, good luck, "nice shot", laughs, "ez" and "are you a bot?" (and answer to their own name). They don't repeat recent lines, take a moment to "type" before a message appears, and call people by a short name the way a person would ("dave_smith245" becomes "dave").
- **Games played counts matches**, not every round: profiles, leaderboards ("Games played" and the in-game "Most wins"), the Find game card and party rows. Rounds won is shown separately on the website profile.
- **Triple Bolt is now an upgrade** (crossbow tree) instead of the Crossbowman's default: the base crossbow fires single bolts again (1.15 s reload); Triple Bolt turns each shot into a three-bolt burst with a 50% longer reload.
- **Clan emblems have a transparent back** (the backing colour is gone from the editor).
- **Your own archer stands out more:** a turning gold ring and a larger gold marker. Options → Your archer: Strongly or Lightly marked.
- **Arena pictures on Find game:** point at (or move to) an arena name to see a picture of it.
- **Smoother kill cams online:** the replay is now recorded from the server's own timing, so arrows move evenly instead of stuttering.
- **Shorter end-of-game banner:** just Victory or Defeat and who won.

## 0.34.3

- **Fewer server hitches on Render.** Two server profiles showed the game's own code using only about 1% of a core, yet Render still held the server back for up to 440 ms at a time (1.1 s in one two-minute game). The CPU was going to work done on several threads at once: garbage collection (about six runs a second, split across helper threads) and compressing the game updates. On a plan with half a core, several threads together use up the allowance for each tenth of a second in a few milliseconds, and Render then pauses everything until the next tenth. Garbage collection now runs on the main thread only (`--single-threaded-gc` in `npm start`) and compression on at most two helper threads, so the same work is spread out instead of arriving in bursts. `/perf` also shows how many cores the server can see.

## 0.34.2

- **Server profiling (owner only):** type `/profile` in any game's chat (or `/profile 300` for five minutes; default two) and the server records what its CPU is spent on, with garbage collection and Render's throttling second by second. When it's done it posts a summary in the chat; the full results are at `/api/profile` (a summary, including what was running in each second the server was held back) and `/api/profile?raw=1` (a file Chrome's DevTools can open: Performance tab → Load profile).
- `tools/perf-report.js` no longer takes minutes on a long recording.

## 0.34.1

- Fixed: with `PUBLIC_URL` set to `https://bowfall.com`, a visit to `www.bowfall.com` was sent to `bowfall.com` while the domain set-up sent it back to `www.`, so the site never loaded ("redirected you too many times"). The server no longer redirects between the www and plain versions of your address; it still sends the onrender.com address to yours.
- `render.yaml` lists `CONTACT_EMAIL`.

## 0.34.0

Accounts and signing in. Google and Discord sign-in, linking, passwords, email and "Forgot your password?" were already built; this release fills the gaps and gets them ready to switch on (see HOSTING.md for the step-by-step set-up).

- **Google and Discord give a recovery email:** signing in with them now also asks for the email address (if they have confirmed it), so those players can reset a password later. It's added to a new account, or to an existing one that has no email, and never if another account already uses it. It stays private, like any account email.
- **Changing or adding a password signs out your other devices** (the one you're on stays signed in), and emails you a short notice.
- **Changing your email** sends a notice to the old address, so a hijacked account can't quietly move its recovery email.
- **Delete my account** (website profile → Signing in): type your player name, and your password if you have one. Stats, ratings, achievements, email, sign-in links and clan membership are wiped and the name is freed; forum posts stay, from a deleted player. The owner's account can't be deleted this way.
- **Privacy and Terms pages** on the website (linked in the footer and on Create account), which Google asks for before it lets anyone sign in. An optional `CONTACT_EMAIL` setting shows where players can write.
- **In the game,** the account line under your profile has a "Password and sign-in" link to those settings.
- HOSTING.md: the Google and Discord set-up rewritten step by step for the current Google console, with the privacy and terms addresses and what to do about a redirect mismatch.

## 0.33.1

- **Meadow looks painted** (Arena detail: Full; Low keeps the plain look). Stone-block walls with moss and ivy spilling over the inside edge replace the hedge, and cast a soft shadow onto the grass (deeper under the top and left walls, as if lit from the top left). The grass has soft darker and lighter clumps and a brushed texture, a few trampled patches and two short trails of flat stepping stones (kept away from hazards, boulders and the middle). Pits get a shadow inside the rim and longer grass hanging over it, and boulders cast a soft shadow instead of a hard disc. All of it is painted once when the arena loads, so it costs nothing while playing. The training arenas, which use the Meadow look, get it too.
- `docs/art-assets-meadow.md`: the list of art pieces to generate for the next step (grass and outside tiles, wall, corner, pits, pond, lava, boulders, corner burrow, stepping stones, small props), with sizes, rules and a starting prompt.

## 0.33.0

- **Clan emblems.** The leader designs one when starting a clan or in Clan settings: a shape (shield, circle, triangle, diamond, hexagon, square or pennant), a pattern (plain, diagonal, horizontal or vertical stripes, chevrons, checks, quarters, a cross, halves or dots), a symbol (a letter of your choice, star, arrow, crossed arrows, flame, crown, moon, bolt or target) and five colours (base, trim, pattern, symbol and backing) from 16. It shows on every member's banner before the tag, on the Clans button on the main menu, on the clan page and lists, in Highscores and on the website leaderboard. Existing clans get a shield with their tag's first letter until the leader changes it.
- **Match over:** the rating pop-up no longer covers the Victory / Defeat headline; at the end of a match the rating is only shown on the results screen (counting up), with the guest "make an account" link there.
- **Deciding round and Last Arrow:** when both teams are one round from winning the match, the round is announced as the *Deciding round*; when both are also one game away, that game is the **Last Arrow** ("whoever wins this game wins the match"), with its own sting, and the top bar says so.
- **Crossbowman:** a normal shot is now a quick burst of three bolts (0.08s apart, with a little scatter), each with 45% of a bolt's damage and 50% of its knockback; all three together hit harder than one bolt did. Reloading takes 1.7s (was 1.15s). An armed ability (Scatter, Recoil, Firework and so on) still fires a single full bolt.
- **Dodge drill:** you can walk now (as well as dash). The shooter aims like a person: he reacts to where you were a quarter of a second ago, swings his bow round at a limited speed, and stops adjusting just before he lets go, so a dash timed to his release beats him (in a test, 8 of 8 shots dodged with timed dashes, against 2 of 7 standing still). The drill tells you to watch him draw. **All drills** are played as a Frost Ranger now, whatever you last picked.
- **Firework:** no stick; the flame and sparks out of the back are reds, oranges and yellows.
- **AI players' team rating:** AI players who had never played a team game get a team rating once, within 60 of their 1v1 rating, so they appear on the team leaderboard. After that it's theirs and moves with their games like anyone's.
- **Performance recording (F9, or Options):** records how long each part of every frame takes (simulation, arena, archers, shots, particles, overlays, HUD, network messages), what was on screen, memory, ping, long browser stalls and the server's own load each second. Pressing F9 again saves a `.json` file to send in; `node tools/perf-report.js <file>` summarises it. The server now also sends its send time, memory and player count in its per-second numbers.

## 0.32.0

- **Clans.** A **Clans** button sits next to your profile at the top right of the main menu.
  - **Start one** with a name (3 to 24 characters), a tag (2 to 5 letters or numbers), an optional motto, a colour, and whether anyone can join or people must ask. One clan per account, up to 30 members; names and tags are unique. Guests can browse but need an account to join.
  - **The tag** shows before your name, in the clan's colour, on your banner everywhere: lobbies, the ranked match-found screen, the scoreboard, the in-game menu and your party.
  - **Roles:** a leader, officers and members. The leader and officers invite players by name and accept or decline requests; officers can remove members; the leader makes and removes officers, hands over the clan, changes its settings and can disband it. If the leader leaves, the longest-serving officer (or member) takes over; when the last member leaves the clan is gone. Leaving, removing, handing over and disbanding ask for a second click.
  - **Clan rating:** there's no separate queue. In any ranked 2v2 or 3v3, if a whole team is members of one clan (two or more people, no AI players, guests or outsiders on that side), the match also counts for the clan: a win or loss against the other team's clan rating if they are a clan team too, otherwise against their players' average rating. Clans start at 800. Your own rating changes as usual. The clan's change shows on the match-over screen. Two halves of the same clan playing each other doesn't count.
  - **Best clans** are on a new Clans tab in the game's Highscores and on the website's leaderboard, and the Clans screen lists every clan with Join / Ask to join and a member list.
  - The server keeps clans in a new `clans` table (made automatically). Owner command: `/clan disband <tag>`.
- **Ranked match-found screen:** banners get a full line each and are no longer cut off (the card is wider, and the archetype, AI tag and ready state sit on the line below). The arena picture keeps its own shape instead of stretching to the height of the player list.

## 0.31.1

- **Rocket Arrow is now the Firework, and much weaker.** It flies at a set 210px a second whatever the draw or the arrow speed rule (it was about 940 under the standard rules; an archer runs at about 235), turns at a steady 1.5 radians a second without leading its target, and bursts when it lands or when its 5 second fuse runs out. The burst is 85% the size of Blast Tips (it was 150%) with 70% of the shove, and does 6 damage (it was 12); the direct hit does 35% of a normal arrow's damage and knockback (it was 70% and 60%). In a test a direct hit plus burst cost a Ranger 11 health, down from 22. It's drawn as a striped firework on a stick throwing coloured sparks, and bursts in rings and stars of several colours with a crackle.
- Bots only use it between 160 and 700px, since it's too slow to matter from across the arena.

## 0.31.0

- **Match-over screen reworked.** A big headline in the winner's colour ("Red wins"), or **Victory** / **Defeat** in ranked, with the points line small beneath it; the winning archers are shown; the headline and winners animate in with a short fanfare. The rankings table drops Amber and Damage taken. Your rating counts up (or down) from the old number with a tick per step, and the level, mastery and Crest bars chime as they fill (a brighter chime on a level-up).
- **In-game menu (Esc):** in a ranked match there's no room code, bot skill, join or team-change buttons; your upgrades are listed instead. In a drill or the tutorial the team columns and bot settings are gone too. The menu is wider, bot controls drop to a second line instead of squeezing names, and nothing is cut off at the card edge any more.
- **Banners fit.** Name plates no longer get cut off in the profile preview, custom lobbies or the in-game menu: when there isn't room the title gives way first, then the medals; the name always shows.
- **Ranked lobby:** everyone's full banner (level, flag, border, finish, medals, title) is shown while you wait, and the other team's archetypes stay hidden until the match starts. Your party's banners show on the Find game screen too.
- **No drawing during the countdown:** the bow (and the cursor's draw ring) only works once the round starts.
- **Rocket Arrow** (new ability for Juggernaut, Trickster and Crossbowman, 14s): your next shot is a big, slow rocket (about 30% of normal arrow speed) that homes hard on the enemy nearest your line of fire and explodes where it lands with a blast half as big again as Blast Tips, throwing everyone nearby. It can be dodged, and boulders stop it. Drawn as a rocket with an exhaust flame, smoke trail and blinking light.
- **Falling into holes looks right:** an archer knocked hard into a pit now bounces off its inside walls while falling instead of sliding out across the ground.
- **Arena centred:** the arena sits in the middle of the window whenever it fits beside the scoreboard (before, it always sat left of centre).
- **Transitions:** screens and cards slide in as they open, and a dark wipe lifts off the arena as a match's first countdown starts.
- **Graphics options:** *Team glow round archers* (Living: breathes slowly, leans the way the archer moves, tightens and brightens on a draw, flares on a hit · Soft · Ring only) and *Arena detail* (Full: ambient drift, cloud shadows, lava glow and embers, night tints · Low). New at full detail: embers lift off lava, a splash ring and droplets when someone goes into water (a dust ring for a hole), and a puff of dust when an archer slams into a wall. Light effects mode turns all of it off as before.
- Fixed: a render error from the team glow on cloned archers.

## 0.30.1

- **Aim guide:** fades to 30% of its brightness at distance (was 12%). The red X now shows only when a boulder is in the way, or when the arena wall is within 240px of you; a shot across the arena ends without one.
- **Ranked arena choice:** each AI player filling a place now counts as a player with no favourite. Before, a match against AI was drawn only from the human players' favourites, so playing alone always gave you yours. In a 1v1 against AI your favourite now comes up about half the time.
- **Banners:** a banner border now shows on top of a finish (the finish's own edge glow was replacing it).

## 0.30.0

- **Seeker Arrow reworked to use the homing system.** It used to chase whoever was nearest with a slow, fixed turn, which missed more often than it hit. Now, like the Arrow homing rule, it locks on at release to the enemy nearest your line of fire (within 340px either side, at any range), never switches target, bends harder as it closes in and scales with arrow speed, and boulders still block it. It also leads its target. In a test of 63 shots aimed up to 17° off at still and strafing targets, hits went from 33 to 61; a shot aimed more than about 25° off still misses.
- **Traps can't be placed over holes or water.** A trap aimed there lands on the nearest edge instead (the aiming circle shows where), and bots no longer try. Lava and bogs are still fine.
- **New standard rules:** arrow speed **Blazing** (was Very fast), move speed **Normal** (was Fast) and movement feel **Snappy** (was Glide). A new, faster arrow speed, **Bullet**, is above Blazing. Ranked matches always use the standard rules (they have no host, so nothing can be changed). The tutorial, training drills and practice use them too, unless you've set your own in a practice lobby.
- **Aim guide fades with distance:** brightest by the bow, down to a faint line about 700px out. The red end where it meets a wall or boulder stays bright.
- **Custom rules:** the "Allowed in this game" list at the bottom is gone; the host takes elements and roles out with Alt+click (or Y on a controller) on the pickers, as before.
- **Knockout drill:** par times are about 10% longer (10s, 13s, 15.5s, 16.5s) to match the slower standard move speed.
- `render.yaml` now asks for Render's **Starter** plan. With `plan: free` in the file, every upload to GitHub reset an upgraded service back to free.

## 0.29.0

- **Tutorial reworked** for everything added since it was first written. It now runs: move → shoot → full draw → dash → **dodge** (new: a stone sniper takes aim with a visible draw, and you dash out of two shots) → abilities → knockouts → a short "build your archer" card that lists every element and role in a few words → pick an upgrade → a real fight against a Flame Juggernaut bot. You play it as a Frost Ranger (the easiest all-rounder). A **Skip to the match** button jumps straight to the fight, and finishing offers Find a match or Custom games. New players default to Ranger.
- **Playing within seconds:**
  - The main menu marks the tutorial **New? Start here** until you've done it (or played a few games), and the name screen has a Tutorial button.
  - **Invite links drop you straight in:** opening a friend's `?room=CODE` link skips the name screen, gives you a friendly random name if you haven't picked one (change it any time), joins the room and puts you on the team with fewer people. No clicks.
  - For your first three games (if you haven't done the tutorial), a small **How to play** strip shows the controls at the start of each game (keyboard or controller, whichever you're using). "Got it" hides it for good.
- **Starting ratings for new players:** a new account's first rating is now seeded from what the game already knows about them: the hardest bot difficulty they've beaten in practice (Easy ≈ 780, Normal 850, Hard 950, Extreme 1050, Master 1150), plus a little for good training grades, minus a little for someone brand new who hasn't done the tutorial (range 650–1200). **Placement:** the first five ranked matches move your rating faster (K 64, shrinking by 4 a match down to the usual 24). Find game shows how many placement matches are left. Accounts that already have a rated match are unchanged.
- **Game feel:**
  - **Hit-stop:** full-draw hits and bullseyes that involve you freeze the picture for a few frames (a little longer for a full-draw bullseye), so big hits land.
  - **Knockouts:** knocking someone out gives a gold flash round the screen edge (and, in practice, a moment of slow motion); being knocked out gives a red one.
  - **Knockback streaks:** anyone flung faster than they can run leaves a short ribbon in their colour, so you can read who got launched and where. Hidden, stealthed and smoke-covered archers don't show one. Light effects mode turns them off; Screen shake: Off also turns off the hit-stop and slow motion.
- **Progression:**
  - **Mastery** for every element and role: games with it count 1, wins 2, over ten levels (5, 15, 30, 50, 80, 120, 170, 230, 300, 400). Your level shows as ★ on the pickers (bronze, silver from 5, gold at 10). Role mastery counts your whole history; element wins are counted from this version on.
  - **After-match progress:** signed-in players see what the match gave them under the results: XP and level bar (with Level up!), mastery bars for the element and role they played (with Mastery up!), and Crests earned.
  - **Daily first win** is now visible: Find game shows whether today's +100 Crests first-win bonus is still waiting, and the progress panel says when a match earned it.
- **Design notes:** `docs/design-notes.md` covers what makes the game fun, the first-minute funnel, the options for locking elements and roles (still undecided), and the play loops.

## 0.28.0

- **Emails and forgotten passwords:** creating an account now asks for an email (kept private, only used for password resets). "Forgot your password?" on the sign-in page emails a link that lasts an hour and works once; using it signs you out everywhere else. Players with older accounts can add or change their email on their profile under **Signing in**. Emails are sent through Resend: set `RESEND_API_KEY` and `MAIL_FROM` on Render (see HOSTING.md).
- **Knockout drill: an S needs a clean run.** Any missed shot, or any archer put back on its spot after a knock that didn't sink it, caps the run at A. The coach line counts misses and resets as you go.
- **Ranked arena preferences:** on Find game, click an arena to make it your favourite and right-click one to avoid (on a controller, pressing a favourite again switches it to avoid). After a match is made, each player puts in their favourite, or "any" if they have none or someone else avoids it, and one is drawn: both pick the same arena and that's the one; different favourites are 50/50; a favourite the other player avoids gives a random other arena; a favourite against no preference is 50% that arena, 50% random. Random arenas skip anything anyone avoids.
- **Highland Reach reworked for long range:** the centre fires are open campfires (no bowls to hide behind), the boulders in the middle are gone, and the cover now sits out by the outer walls, so the middle is clear for sniping. The fire glow is softer and a deeper orange, so it no longer washes the ground out.

## 0.27.1

- **Taking elements and roles out of a custom game, right on the pickers:** the host Alt+clicks an element or role in the lobby (or presses Y on it with a controller) to take it out of the game, and again to put it back. Taken-out ones are greyed, struck through and marked with a red ✕ for everyone; a line under the pickers tells the host how. (The same list is still under Custom rules → Allowed in this game.)

## 0.27.0

- **Highland Reach at dusk:** a new, darker theme. Dark heath under a cold, moonlit sky, braziers at the corners of the centre crossing (small bits of cover too) and lanterns by each side's spawn, each throwing a flickering pool of warm light, fireflies drifting over it, and a vignette. The canyon and ledges have a lighter earth bank and a pale moonlit rim so the drops stay easy to read. Light effects mode keeps the fires but drops the glows.
- **Fix: the page and the game files can't run out of step any more.** The Highland Reach report (a bot standing outside the arena, which was cut short at the old width) came from a browser running an older copy of the page with the new game files. The page now checks that it and the game files are the same version; if not, it reloads once, fetching both fresh (and keeping any room link), and if that still doesn't fix it, a banner says to press Ctrl+F5. The game files are also requested by version, so an update always fetches them fresh.

## 0.26.0

- **Ranger buff (a better all-rounder):** draws 12% faster, and keeps 70% of its speed while drawing (everyone else keeps 55%).
- **Custom game rules:**
  - **Allowed in this game:** the host can take any elements and roles out of a custom game. Players on them are moved to something allowed, the pickers grey them out, and bots avoid them.
  - **Upgrades: off:** no picks between rounds; everyone plays their plain element and role.
  - **Movement feel:** Glide (the standard air-hockey feel), Snappy, Drifty, or Direct (no glide at all). Top speed is the same in all four; only how quickly you get going, turn and stop changes (to full speed / to a stop: Glide 1.7s / 2.0s, Snappy 1.1s / 0.8s, Drifty 2.2s / 3.2s, Direct 0.45s / 0.2s).
  - "Aim assist" is now called **Arrow homing**, so it isn't confused with the controller's aim assist.
- **1v1s don't offer upgrades that need teammates or extra enemies:** Guardian's Oath, Revive, Transfusion, Contagion, Aftershock and Forked Lightning.
- **Controllers:** hints follow what you last touched. The ability bar shows LB / RB (or L1 / R1 on a PlayStation controller) instead of Q / E, the upgrade cards show X / Y / B (which now pick them for the main player too), and the tutorial's lines are said the controller's way.
- **Players on one screen:** each extra player's abilities now show in a panel of their own colour above yours, with their controller's buttons and cooldowns.
- **New arena, Highland Reach:** bigger than the rest (1500 × 960) and built for long shots; a canyon splits the middle, crossed only in the centre. Mushroom Grove is out of the rotation for now.
- **Strongholds is on hold:** only the owner account (and the offline copy) can open it.

## 0.25.0

**Strongholds rebuilt** (still a practice-only preview under Custom games; `docs/strongholds.md` has the full picture).
- The map is 4800 × 3200 with a wide river down the middle and only three bridges across it, so the two sides can't just walk into each other; the middle bridge has ruins on both banks.
- Four unique strongholds, each with rooms and its own way in, and a village round it: Castle Greyhold (moat, drawbridges, keep, great hall, stables, timber houses and a chapel), Vine Temple (three stepped terraces entered from different sides, watchtowers, stilt huts round a pond), Coral Fort (a palisade on the shore, barracks, a wreck, the captain's cabin, fishing huts and boats), Sun Citadel (a barbican, bazaar rooms, a throne hall, an oasis, minarets, adobe houses and a market).
- More NPCs, spread further out: patrols walk routes through the villages, archers stand on the towers and shoot over the walls (and can be shot back), sentries watch the gates, and the captain holds the throne room. Each faction has its own names and look.
- Forests: under a tree you're hidden from enemies more than 70 units away (until you shoot); the canopy goes see-through for you and your teammates.
- Everyone can revive: stand over a knocked-out teammate for 3 seconds. Respawns take 8 seconds otherwise.
- Capturing a stronghold opens a chest in its throne room: each member of the owning team gets a pick of three upgrades.
- Normal walking speed in this mode, and a slower pace overall: capturing takes 10 seconds, first to 600 points.
- The look: darker and moodier, each quarter of the map in its own light, torches that flicker, mist over the river, fireflies in the jungle, dust in the desert, and a vignette.

## 0.24.0

**Strongholds (preview)**: a new casual mode on a big map, playable in practice for now (Custom games → Strongholds (preview)), alone or with players on controllers. Details in `docs/strongholds.md`.
- A 3600 × 2400 map with four walled strongholds, one per biome (castle, jungle temple, coral fort, desert citadel), each held by NPCs: two gate guards, two sentries at the bridges, two archers and a captain. Capture one by standing in its throne room with nobody else in it; its NPCs then fight for you. A point a second for each one held: first to 500, or all four at once, wins. Knocked-out archers come back after 5 seconds at their nearest stronghold or their camp.
- NPCs show a clear tell before every attack (a red wedge, circle or lane). The captain is heavy and has a slam and a charge.
- A camera that follows you and looks ahead toward your aim, with zoom (mouse wheel or + / −) up to the same limit for everyone; a shared camera for players on one screen that zooms out as they spread, then gently holds them together; a minimap; arrows pointing to teammates off screen. Shots fly at most about a screen's width in this mode.
- Engine: the arena size is now per map, and castle walls block movement, shots and line of sight. Normal arenas are unchanged.

**Fixes**
- The Pitch's ball now moves smoothly: it was only redrawn when the game updated (every other frame, or 30 times a second online), unlike archers and arrows, which glide between updates.

## 0.23.1

- **The Pitch's ball is a plain white disc** with a dark rim and a shadow, instead of the rolling 3D panel ball: it suits the 2D look and costs almost nothing to draw.
- **Bots handle the ball:** once they notice it coming at them (quicker on higher difficulties) they step or dash out of its path, and when it's still far enough off they shoot it back. The opening trick of shooting the ball straight into them now rarely works on Hard and above; on Normal and Easy they still get caught more often.
- **Fix:** running into a still or slow ball counted as the ball hitting you (damage and a shove) whenever you were moving at a normal pace. Now only the ball's own speed counts: run into it and you kick it, as intended.

## 0.23.0

- **Everything flies 10% faster**, on every Arrow speed setting (arrows, bolts and shuriken): Normal 1.32, Fast 1.65, Very fast 1.98, Blazing 2.42. Shuriken reach 10% further with it; bolts keep their set reach.
- **The aim guide reaches as far as your shot really goes**: for a bow, worked out from your draw, your upgrades (Longbow, Railshot and so on) and the arrow speed setting, and stopped at the first wall or boulder. Ninjas and Crossbowmen, whose shots fly at once, now see it all the time, out to their range.
- **Power-ups are announced 3 seconds early:** their spot shows a ring closing in and a countdown (gold for a power-up, violet for a channel).

## 0.22.0

- **Knockout drill rebuilt as four set scenes** (Warm-up, Angles, Weave, Long shots). Every archer is already standing in front of its own sinkhole; work your way through the arena knocking each one in, and the next scene starts once they're all in. A dummy you hit that misses its hole goes back to its spot a second after it stops. Scoring: 50 per dummy, plus up to 600 per scene for clearing it quickly (full marks at half its par time, nothing at twice it); falling in costs 100 and puts you back at the scene's start. It's a new drill, so it has a fresh leaderboard (the old drill's bests are kept but no longer shown).
- **New graphics options** (Options → Graphics):
  - **Effects: Automatic / Full / Light.** Light drops the soft glows (team glow, your spotlight, lava's outer glow, the low-health vignette) and draws arrow trails as plain lines. Automatic (the default) switches to Light by itself when the game can't hold its frame rate even at its lowest resolution, and back again once it's comfortable.
  - **Shots' shadows: Soft / Simple / Off.** Simple is a blurred dot under every arrow, bolt and shuriken; Light effects use it too.
- **The Arena builder moved into Custom games** (a button next to Practice vs bots), since arenas are only played in custom games. Its Back button (and Esc) returns to Custom games.

## 0.21.3

- **New Ninja ability, Blade Guard** (10s cooldown): raise a guard for 1 second that stops shots from any side. Block one and you go full auto for 2 seconds: hold to throw a shuriken every 0.12 seconds (three times the normal rate), each dealing 50% of the damage and knockback. It works like the Crossbowman's Hair Trigger.
- **Smoother frames with lots of shots in the air:** the soft ground shadow under every arrow, bolt and shuriken was blurred live each frame, which is very slow for the browser. Bursts like Shadow Mark's return (10 shuriken) and Death Blossom (12) dropped frames. The shadows are now blurred once and reused, and look the same.
- Bots with a parry (Parry, Hair Trigger, Blade Guard) now also raise it against a shot that's about to hit them, not only against a bow being drawn at them, so they can use it against Ninjas and Crossbowmen too.

## 0.21.2

- **A drawing error can no longer freeze the game.** If something goes wrong while drawing a frame (or the HUD, or handling a message from the server), the game reports it and carries on with the next frame instead of stopping with a blank arena.
- **Browser errors are reported to the server:** each distinct error goes to `POST /api/clienterr` once (with the version, screen, arena and browser). The owner sees the latest in `/perf` (in any game's chat) and in full at `/api/perf`, and the server log prints them.

## 0.21.1

- **Fix:** the ranked draft screen came up blank (no arena name, no element and role choices, no teams), so ranked matches couldn't be set up. A variable in the new lock markers was used before it was defined, which stopped the draft screen drawing. The draft also redraws once a player-made arena's layout arrives.

## 0.21.0

**Crests and unlocks**
- Accounts earn **Crests** from ranked games and custom games without bots (a game 8, won 16; a match 25, won 50; +100 for the first match win of the day), achievement tiers (40 each) and first B/A/S training grades (50/100/200).
- Premium elements (Stone, Void, Shadow, Blood) and roles (Assassin, Ninja, Crossbowman) can be unlocked for 4,000 Crests or £2.49. One premium element and role are free each week.
- **Locks are off** until the owner types `/locks on`: everything stays free, and unlocks bought now are kept. With locks on they only apply in ranked drafts (locked chips are greyed out; the server checks too). Practice, training and custom games always have everything.

**Supporters, Founders and Patrons** (cosmetic only)
- **Supporter** (£4 a month): an emblem everywhere your name appears, bronze → silver (3 months) → gold (6) → diamond (12); the animated **Aurora** banner finish; 1,000 Crests a month and +25% Crests.
- **Founder pack** (£15, limited): every element and role for good, the Founder emblem, the **Founder** finish and 2,000 Crests.
- **Donations** (any amount): the Patron heart and the **Patron rose** finish.
- A new **Store** screen on the main menu. Payments use Stripe Checkout with a signed webhook; nothing is charged until the owner adds Stripe keys (HOSTING.md). Emblems also show on the website's leaderboards and profiles.
- Owner commands: `/locks`, `/rotation`, `/founders`, `/grant`.

**Arena builder**
- Build your own arena on the main menu: sinkholes, water, lava, bogs, boulders, mushrooms, gates, thorns, a football and any arena's look. It mirrors itself for fairness and is checked as you go (clear spawns, a path between the teams, no cut-off areas, size and count limits).
- Test it against bots, save it (3 on a free account, 25 for supporters) with a share code, host custom games on it by code, and (supporters) publish it to the **Community** tab where players like and play arenas. The owner can feature arenas and add them to the ranked map pool (`/feature`).

**Other**
- The compressed update stream also sends a full snapshot every 10 seconds, so a game's view can never drift for long.

## 0.20.0

**Lighter on the server and the network** (gameplay unchanged)
- **Delta updates:** after the first full snapshot, each update sends only what changed since the one before (new, changed and removed archers, arrows, zones and pickups, matched by id). Checked against full snapshots over whole matches: identical every time.
- **Binary packing:** the fields that change every update (archer position, velocity, aim and draw; arrow position and heading) go as 16-bit integers instead of JSON text, at the precision the snapshots already had.
- Together with the per-game compression stream from 0.19.4: a 3v3 update is about 100–200 bytes on the wire (it was about 430 in 0.19.3 and 3.3 KB uncompressed). Messages in the stream are framed [length][kind][body].
- **Quiet phases:** in the lobby, upgrade picks and results the server sends an update only when something changed, at least once a second, instead of 10 a second.
- **Inputs:** the browser sends its input only when it changes (still up to 30 a second, with a heartbeat every 250 ms) instead of 30 a second regardless.
- **Bots** decide 30 times a second instead of 60 (half of them on each tick, with the full elapsed time, so turning speeds and timers are unchanged). Simulation cost of a 3v3 of bots: about 20% lower; a 1v1: about 38% lower. Their reactions can be up to 1/60 s later, which is well inside their built-in reaction delays.
- Performance stats no longer count the pause before a fight starts as a late packet.

## 0.19.4

- **Snapshots compressed once per game, not once per player.** Each game keeps one running compression stream (so each update still compresses against the ones before it: a 3v3 update goes from about 2.5 KB to about 350 bytes) and sends the same bytes to everyone in it, as binary frames. Before, the server compressed every update separately for every connection. Compression cost for a 6-player game drops from about 21 ms of CPU per second to about 3.5. Someone joining (or moving games) restarts the stream for that game so everyone can always unpack it. Browsers unpack it with the built-in DecompressionStream, in order with the other messages; one that can't gets plain JSON.

## 0.19.3

- **Server:** the game loop now wakes once per tick (about 60 times a second) instead of every 5 ms, and every 50 ms when no games are running. On a tiny host the wake-ups alone were a noticeable share of the CPU allowance: an idle server now uses about half the CPU it did.
- The first lag report (a ranked 3v3 with AI players) showed the server's host holding it back for about a third of every second (Render's free plan allows a tenth of one core), so the lag was the server, not the player's PC or connection. See HOSTING.md.

## 0.19.2

**Tracking down lag**
- **Performance stats (F3,** or Options → Graphics): a small panel in online games that splits lag into its three sources over the last 10 seconds: **your PC** (frame rate, slowest frame, frames over 50 ms), **the network** (ping and its variation, and *late packets*: updates that reached you more than 60 ms after the server's own tick numbers say they were sent, not counting moments when your own computer froze), and **the server** (CPU as a share of what the host allows, time the host held it back, the longest game-loop stall, and the slowest tick). A graph shows every update gap and slow frame, and the top line names the likely cause.
- The server measures itself every second (game-loop stalls, lost time, tick cost per game, CPU against the host's quota and cgroup throttling, event-loop delay, memory) and sends each game a tiny summary. Snapshots now carry the server's tick number.
- Every 10 seconds each player's browser sends a one-line report. The owner can type **/perf** in chat for the server's state now and over the last 30 seconds plus the latest reports, or open **/api/perf** for the last two minutes. HOSTING.md explains how to read it.

## 0.19.1

**Training**
- **Rankings:** each drill now shows your best score and where it ranks among everyone's bests ("top 4% of 312 players"), on the drill list and when a run ends. Signed in, your best is kept on your account (`career.train`; `GET/POST /api/train`); guests see where a run would rank. Scores are checked against each drill's maximum.
- **Dodge drill reworked:** one archer walks up and down across a wide rift you can't dash over, and never shoots faster than your dash recharges. Three 20-second rounds: open ground (lighter shots), then sinkholes open on your side, then bogs (you can only wade out of a bog). Hazards flash for 2.5 seconds before they open. Your dashes now go the way you're pushing (your feet are tied, but the stick still steers), fixing dashes going where you aimed. Scored out of 1,000 on the share of shots dodged, minus 100 for each fall.
- **New: Knockout drill.** Archers who don't shoot back appear one or two at a time on a field of sinkholes; knock ten in within 90 seconds. Each scores 100 plus up to 200 for speed; falling in yourself costs 100.

**The Pitch**
- The ball now shoves anyone it hits much harder (about twice as far), and a slower ball counts as a hit.
- The ball looks like a real football: black pentagons and seams on a white ball, shaded, rolling the way it moves.

**Controller and local players**
- Pressing A on **Add bot** (or any lobby button that redraws the screen) keeps you on that button, so you can add several bots in a row.
- With extra players on the same screen, the main player's archer shows their name instead of "You", and each extra player's archer has a glow in their own colour.

**Visuals**
- Arrows: the dark outline no longer rounds off the tip; the head keeps a sharp point.

## 0.19.0

**New arena: The Pitch** (replaces Gale Cliffs)
- A football pitch whose only hazards are the two goals, which are drops. A ball sits in the centre: shoot it or run into it to send it flying; it hurts and shoves anyone it hits (harder the faster it goes), bounces off walls, boulders and archers, and comes back to the centre after a goal. A saved Gale Cliffs preference falls back to Meadow.

**Training**
- A new main-screen entry with three graded drills (D to S, best kept in your browser): **Target practice** (three rounds: steady, quick, then several targets at once; scored on speed, accuracy and bullseyes), **Dodge drill** (three turrets, 45 seconds, dashes only) and **Peek and shoot** (dash out from cover, three hits knock a turret out, hits taken cost points). Two hidden training arenas; drills don't count for stats or achievements. Works with a controller, including the results buttons.

**Combat**
- **Quick-fire arrows** are no longer worth it: an arrow needs a quarter draw to leave the bow, the bow takes 0.3s to nock the next arrow (0.45s for a Sniper), and damage and knockback grow more steeply with the draw. Ninja shuriken and Crossbow bolts are unchanged.
- **Full draw** is marked by a spark and a click instead of a ring around the archer.
- **Homing arrows** option: Tiny is smaller (0.12) and the other steps moved down (small 0.25, medium 0.5, heavy 1, extreme 2.2).

**Controller**
- **Aim assist reworked:** it reaches further (about 110px either side of an enemy), pulls harder (70%) and leads more (halfway to the intercept); once an enemy is under your aim it tracks them, so a held or released stick stays on a runner. Only a firm push of the stick steers the aim, so easing it off to fire doesn't drag your aim away. Same for extra players on controllers.
- **Menus in sections:** busy screens (lobby, custom games, find game, options, the in-game menu, the draft) are split into sections: move between sections, A steps in, B steps out. The in-game menu's buttons (Resume, Controls, End match) now highlight.
- **Extra players:** pick upgrade cards with the D-pad or left stick and A as well as X/Y/B; their archetype picker works with the stick; results say which colour team won.

**AI players**
- Nine new players from Russia and Ukraine (69 in all).
- Careers now follow ratings: the better a player's rating, the more games and the higher their level (a top player is level 20-odd with hundreds of games; a low-rated one is newer), with the achievements someone with that record would have. Existing accounts are updated on the server's next start, keeping the ratings they've earned here.

**Visuals**
- Arrow shadows have a sharp tip and a slight blur (not on the Fast graphics setting).
- The football is bigger.

## 0.18.0

**Balance pass** (from two rounds of bot testing: about 6,800 matches, 60,000 games; details in the balance review)
- **Parry:** the riposte no longer makes every shot instant for 3 seconds (a human could fire 22 full-power arrows in 3 seconds). Now only the next shot is instant and 30% harder; for 3 seconds you still draw twice as fast, move 20% faster, and get half the cooldown back.
- **Assassin:** 10 less health, Blink cooldown 6 → 8s. (Was the strongest role at 61%; now about 54%.)
- **Ninja:** blink recharge 1.5 → 1.65s, shuriken gap slightly longer. (61% → about 52% in 1v1.)
- **Ranger:** 8% → 5% faster. **Fleet Foot:** 15% → 10% faster (keeps its sharp turning).
- **Warden:** was by far the weakest (27% in 1v1). Now: heals 3/s after 3s unhurt (was 2/s after 4s), no longer slower, 10 more health, about 17% less knockback taken. Rally and Bond now cover the Warden too. Guardian's Oath's self-penalty 10% → 5%. **Gust** is wider, shoves 35% harder, has an 8s cooldown and blows enemy arrows out of the air.
- **Trapper:** abilities recharge 40% faster (was 30%); hits on rooted, stuck or frozen enemies deal 25% more damage (was 15%) and knock back 30% harder. Harpoon holds 0.9s (was 0.5) for 6 damage (was 4). Bramble Trap roots 2.5s.
- **Blood:** the more health you've lost, the harder your arrows knock back (up to +25% near death). Blood Pact costs 10 health (was 15). Extra healing was tested and did nothing, because ring-outs decide games.
- **Void:** rifts now open on any fully drawn hit, not only bullseyes. (Bots bullseye far more than people, so this should help humans most.)
- **Railshot:** cooldown 11 → 10s, and bots now aim it correctly (they led it as a normal-speed arrow).
- Bots' learned card values were re-learned under the new rules (11,000 games), Blood cards included, and bots no longer pick team-only cards when they have no teammate.

**Bots**
- Matchmaking's AI players now keep their own personality and playstyle through a match (a bug rerolled them at every match start).
- The smart "Master" brain now fades in gradually with skill instead of switching on at once.
- Bots take a moment to pick their upgrade cards, like a person reading them: 1 to 3 seconds for the best, up to 8 for the weakest.

**Banners**
- Your lobby banner can be customised on the Achievements screen, with a live preview:
  - **Finish:** a background style unlocked by your total achievement tiers: Brushed steel (3), Chevrons (8), Ember (15), Stormfront (25), Royal (40), Diamond (60).
  - **Medals:** up to three achievement medals in their tier colour, your choice (your best three by default).
  - Border and title, as before.
- Medals also show on hover cards and in the ranked draft.

**Full draw is visible**
- Every archer drawing a bow shows a ring that fills as they draw and flares white at full draw, with a flash and (for a nearby enemy) a faint tick when it's reached. You can see when an enemy is about to loose a full-power shot, and time a Parry or a dodge.

**Controls screen**
- Redesigned into two panels, keyboard and controller, with each one's settings beside it.

## 0.17.2

**Parry forgives a late press**
- Online, what you see is a moment behind the server (the game shows the world about a tenth of a second late to keep it smooth, plus your connection's delay). So a parry that looked perfectly timed could arrive just after the arrow had already landed.
- Now a Parry pressed up to 0.15 seconds after an arrow hits you undoes that hit, as long as it didn't knock you out: the damage, knockback, burns, slows and stuns from it. You still get the riposte and the halved cooldown.

## 0.17.1

**Controller aiming**
- The aim arrow sits further out from your archer, with a faint dotted line out to it, all the time.
- While drawing you also get the full aim guide, as before.
- Stronger aim assist, between the old sticky lock-on and the gentle nudge. Near an enemy the aim slows and is drawn 60% of the way toward a point just ahead of them: their middle, shifted a third of the way toward where they're heading. In testing, a stick 0.1 radians off a still target ended up 0.04 off. On a target running across your aim, it leans a little their way.

## 0.17.0

**Achievements, rebuilt as challenges**
- 18 achievements, each with five tiers: Bronze, Silver, Gold, Platinum and Diamond. Most are real challenges:
  - **On Fire:** win matches in a row.
  - **Unstoppable:** knockouts in a row without going down.
  - **Untouchable:** win games in a row without being knocked out.
  - **Flawless:** win a match without losing a game.
  - **Sharpshooter:** accuracy in a game.
  - **Eagle Eye:** bullseyes in one game.
  - **Damage Dealer:** top damage on your team.
  - **Ringmaster:** ring-outs in one match.
  - **Longshot:** knockout distance.
  - **Clutch** and **Lone Wolf**.
  - **Giant Slayer:** beat a team rated 150 or more above yours.
- A few are totals, since volume is a virtue too: Champion, Warlord, Pinmaster, Empowered, Keeper and Lifeline.
- Each tier shows how rare it is among players ("Top 3%").
- They count only in ranked games and in custom games with no bots, so they can't be farmed against easy bots.
- Knockouts, pins, captures, revives, clutches, streaks, long shots and match wins carry over from the old achievements.

**Playstyle on profiles**
- Stats are separate from achievements. A profile now shows how the player plays compared with everyone else:
  - damage per game
  - accuracy
  - games survived
  - damage taken (evasive)
  - knockouts
  - assists
  - share of knockouts into hazards
  - share of the team's damage (carry)
- Each is shown as "top X%", with the player's two strongest traits as their headline style.
- Assists are now tracked: hurting someone in the 8 seconds before a teammate knocks them out.

**Match history**
- Profiles show the last 10 ranked matches: mode, win or loss, score, K / D / A, archetype, rating change and when.

**Ratings**
- Separate **1v1** and **team** (2v2 and 3v3) ratings, each with its own leaderboard. Your team rating starts from your 1v1 rating.
- Anti-boosting in team games:
  - A side's strength leans toward its best player, so a strong friend can't carry a weak account into easy wins.
  - Each player's change is scaled by how much they did (their share of the team's knockouts, assists and damage). Someone who was carried gains as little as half. Someone who carried a losing team loses less.

**Friends**
- Add a friend by name from the Friends panel on the main menu.
- Friend requests pop up as a notice, and you can accept or decline them right in the panel.

**Website**
- New home page:
  - The Bowfall name is the headline.
  - A live bot match plays in your browser.
  - Sections on how it plays, the arenas, the top players, open games and the forum.
- Balance data is now only for the game's owner, on the website and in the game.

**Balance**
- **Blood Frenzy:** also draws faster the more health you've lost, up to 60% faster near death.
- **Railshot:** now deals 35% more damage and 30% more knockback, and the cooldown is down from 14 to 11 seconds.
- **Parry:** blocking an arrow now gives a riposte. For 3 seconds your bow draws instantly, your next shot hits 30% harder, you move 20% faster, and Parry's cooldown is halved.
- **Fleet Foot:** 15% faster (was 10%). You reach full speed about twice as quickly and turn much more sharply, so reversing takes about half the time.
- **Arrow speed:** the old Blazing speed is now Very fast and is the default. Normal, Fast and Blazing moved up with it, so Blazing is faster still.

**Easier to see arrows**
- Arrows in flight cast a soft shadow on the ground and have a dark outline, and are a little bigger, so they stand out on every arena.

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
