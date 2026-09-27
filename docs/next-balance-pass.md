# Before the next balance pass

Things to fix first, because they skew the numbers:

- **Bots dash into holes.** Even Extreme bots sometimes dash straight into a pit (or lava/water) and knock themselves out. Dash choice needs a landing check: project the dash end point (and the path, for long dashes) and reject directions that end in a hazard, a bog, or next to one while under knockback. This should apply to every level; lower levels can keep a small error rate in how far they look, not an outright blind spot. Re-measure self-knockouts per 100 games before and after.
- Balance team roles in team modes and duellists in 1v1 separately (roles/upgrades that are strong for a team shouldn't be tuned against 1v1 results, and the other way round).
- Open bot-review suggestions: level-gated arrow sidestep, Easy/Normal full walking speed, Gaussian aim and lead error, ability reaction delays, knockback-edge awareness for Normal/Hard.
