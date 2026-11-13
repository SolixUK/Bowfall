# Getting a new arena ready for the rotation

Before an arena goes into ranked play, the AI players need to know it: which archetypes and cards do well there, and which plays work. Until it's measured, they borrow the table of the arena that looks most like it (by open sight lines, drops and size). That's a guess, and it can be a long way off.

One command does the preparation:

    node tools/arena-fit.js prep <arena key> [matches per matchup]

Use 8 matches per matchup for a release; it takes a few hours. Use 2 for a quick look in about half an hour. Run it after the arena's layout is final. A change to the layout means running it again.

## What it does

1. **Profile.** It prints how the bots and the AI players' picks see the arena:
   - how open the sight lines are;
   - how much of the floor is near a drop;
   - its harpoon score (how much of it you can drag someone over a drop from);
   - its size;
   - whether it's an island or has a spot worth holding.

   Check that this matches what the arena is meant to be.
2. **Self-knockout check.** Every archetype plays Master 1v1s on it, and the tool counts how often bots walk, dash or blink into its drops on their own.
   - Anything over 3% is flagged. That's a bot-brain problem with this arena, such as a pit the pathing doesn't see or a blink that lands in water.
   - Fix flagged problems before trusting the numbers that follow, because they skew every result on the arena.
3. **Its tables.** Every archetype plays every other on it (roles), with each play that fits (plays), and with random upgrades (cards).
   - Only this arena's rows are replaced, so the other arenas' data stays as it was.
   - It then rebuilds `lib/ai-meta.json`.
4. **The result.** It shows:
   - the archetypes from best to worst there;
   - what the AI players were assuming before (its old figures, or the borrowed arena's);
   - the best and worst cards there.

## Before release

- Self-knockouts are under 3% for every archetype.
- The archetype order looks believable for the layout. An open, drop-free arena should favour long range; a cramped one with drops should favour the shovers.
- If an archetype is far ahead (over +0.12), decide whether that's the arena's character or a balance problem, before players find it.
- Commit the new `lib/ai-meta.json` with the arena.

After release, the AI players also learn from real ranked games: an archetype that keeps winning for them on an arena becomes a favourite there.
