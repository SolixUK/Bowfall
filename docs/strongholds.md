# Strongholds (preview)

A slow, adventurous casual mode on a big map. Only playable in practice for now (Custom games → Strongholds (preview)),
on your own or with players on controllers, so the map, the NPCs and the camera can be tried and tuned before any bot or
online work.

## The map (`buildStrongholds` in public/sim.js)
- 4800 × 3200. A wide river winds north to south through the middle; the only ways across are three bridges (north,
  middle, south). The middle bridge has a ruin on each bank for cover. Red's camp is on the west edge, blue's on the east.
- Two strongholds on each side, each in its own biome with a village around it:
  - **Castle Greyhold** (north-west): a curtain wall with a moat and two drawbridges, corner and gatehouse towers, a keep
    (the throne room), a great hall and stables inside; a village of timber houses and a chapel to the south.
  - **Vine Temple** (north-east): three stepped terraces, each entered from a different side, so the way in spirals;
    wooden watchtowers; stilt huts round a pond, in thick forest.
  - **Coral Fort** (south-west): a palisade on the shore with a barracks, a wreck for cover and the captain's cabin at the
    back; fishing huts, boats and a crow's nest up the beach; the sea to the south and west.
  - **Sun Citadel** (south-east): a great square entered through a barbican (a walled dog-leg), bazaar rooms along the
    south wall, guard quarters, a throne hall, an oasis in the courtyard, minarets; adobe houses and a market outside.
- Forests along the river and round the villages. Under a tree you can't be seen from further than 70 units (the
  canopy goes see-through for you and your teammates), until you shoot (1.5 seconds).
- Shots fly at most 1000 units, about what the camera shows. Everyone walks at normal speed (the arenas' default is fast).

## NPCs (`NPC_KINDS`, `npcThink`)
Each stronghold has about 17, with names in the biome's style: guards at the doors and the throne, sentries at the
bridges and gates, patrols walking a route through the village (they pause at each stop), archers inside, tower archers
on the towers (they shoot over the walls, can be shot back, and never leave their tower) and a captain in the throne
room. Melee NPCs show a red wedge before a swing; the captain also has a slam (a red circle) and a charge (a red lane).
NPCs leave each other alone and never wander far from their post (a leash).

## Rules (`CQ`, `updateConquest`)
- Capture: stand in the throne room (radius 80) with nobody else in it, NPCs included. 10 seconds alone, faster with
  teammates (+50% each). Progress drains slowly if you leave; an enemy stepping in pauses it.
- A captured stronghold's NPCs fight for the new owner. Its chest opens: each member of the owning team who walks up to
  it gets one pick of three upgrades (once per capture). Knocked-out NPCs come back: all together 30 seconds later while
  neutral (if no player is in the throne room), one every 15 seconds for an owned one.
- Each stronghold held scores a point a second. First to 600, or holding all four at once, wins.
- Knocked out: any teammate can revive you by standing over your marker for 3 seconds (half health). Otherwise you come
  back after 8 seconds at the stronghold your team holds nearest to where you fell, or in camp.
- No rounds, no amber, no picks between rounds. Power-ups appear by the bridges.

## Camera and view (public/index.html, the Strongholds section)
- Follows your archer, looking ahead toward the cursor. Mouse wheel or + / − zooms; the zoom-out limit (0.75) is the
  same for everyone.
- Players sharing a screen share the camera: it zooms out as they spread, to the same limit, and past that their
  movement away from the group is dragged back (the tether).
- Minimap (top left), arrows at the screen edge pointing to teammates off screen.
- The floor is painted once: sixteen 1200 × 800 tiles in their themes (meadow, spring, jungle, beach, desert), blended
  at the seams; then the water as one body (so banks join), bridges, villages, castles, tree trunks and a colour grade
  (darker and bluer overall, each quarter in its own light). Live on top: tree canopies, torch flames and glow, mist
  over the water, fireflies in the jungle and dust in the desert, and a vignette. Light effects (Options → Graphics) drop
  the glows and the vignette.

## Not in yet
- Online play (needs sending each player only what's near them), and AI players who understand the map.
- Stronghold perks, controller zoom, sounds of their own for the NPCs.
- Balance: NPC damage and health, capture time, respawn time and the points target are first guesses.
