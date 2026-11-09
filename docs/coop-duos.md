# Co-op arcade: bot duos (plan)

Two friends against bot duos that get better level by level, each duo with its own tactic, archetypes and a fixed set of
three upgrades taken at the start of each game (no card draws, so the duo can rely on its plan). Arenas chosen per duo.
Players may change archetype and upgrades between games.

Duo ideas (the owner's):

- Two Assassins who stealth together and go for the same target.
- Two Ninjas.
- A Warden with a partner who stays close and fights from behind the Wall.
- A Trapper (Bramble Trap, Bramble Toss) with a Stone Ranger (fast, dashes) hunting the set-up knockouts.
- In your face: a Juggernaut with a Crossbowman behind him (or another partner).
- Two Trappers.
- Two Juggernauts, bash-heavy.

Order of work: the team behaviours first inside ranked 2v2/3v3 where AI already fill (targeting and the hold-and-finish
combo are in 0.94.2; flanking and front/back lines next), then train and measure each duo's tactic with its fixed upgrades
on its arenas (the fit tool, 2v2), then the mode: a lobby for two, a ladder of duos, difficulty rising with the level.
What exists to build on: `forceUp` (a bot's fixed upgrades, used by the clip farm), `setBotMind` (plays, builds, facets),
the 2v2 fit harness, and the AI league's headless match runner.
