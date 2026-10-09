# Changelog

Each version's number is shown on the main screen, in the in-game menu and in the website footer, and is saved with every recorded game (as `gv`), so balance data can be split by version. Bump `VERSION` in `public/sim.js` when you release: the last number for fixes and small tweaks, the middle one for new content. Bump `PAGE_VERSION` and the `sim.js?v=` in `public/index.html` to the same number: the page checks they match and reloads if a browser mixed an old copy of one with a new copy of the other.

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
