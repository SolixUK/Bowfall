# Meadow art pieces: what to generate

These pieces replace the hand-coded drawing of the Meadow arena. The game places them itself, so they always line up with the real pits, ponds, lava and boulders, and the same pieces work for every grass arena and for player-made arenas.

## Rules for every piece

- **Straight down from above** (top-down, no perspective, no tilt). Nothing should look like it's seen from the side.
- **Light from the top left.** Shadows fall to the bottom right. Keep it the same on every piece, or they won't sit together.
- **Transparent background (PNG)** for everything except the grass tile. If your image AI can't do transparency, ask for a plain flat magenta (#ff00ff) background and I'll cut it out.
- **The same painted style** as the picture you liked: soft hand-painted texture, gentle outlines, muted greens and greys. No text, no characters, no arrows, no UI.
- **Size:** the sizes below are the minimum. Twice as big is fine (it looks sharper on high-resolution screens); I'll scale them down.
- **Name the files exactly as listed** and put them in a folder called `meadow`.

For reference, the arena is 1200 × 800 game units, the wall is 26 units thick, boulders are 60 across, and pits are about 135 × 150.

## The pieces

| File | What it is | Size (pixels) | Notes |
| --- | --- | --- | --- |
| `grass.png` | Grass ground, **seamless tile** | 512 × 512 | Must repeat without visible seams on all four edges. Even texture with soft light and dark patches and small flowers; no big features (no paths, rocks or holes). Not transparent. |
| `grass-dark.png` | Darker variant of the grass tile | 512 × 512 | Same as above but a shade darker. Used under walls and for variety. Optional. |
| `wall-h.png` | A straight stretch of stone wall, running left to right | 512 × 64 | Mossy stone blocks, about 3 blocks tall at most, vines and moss hanging over the **bottom** edge (the side facing into the arena). Left and right ends must join seamlessly. |
| `wall-corner.png` | The corner where two walls meet | 128 × 128 | Top-left corner (I'll rotate it for the other three). Wall along the top and left edges. |
| `pit.png` | A square hole in the ground | 256 × 256 | Dark earth hole with a dirt rim, roots and grass hanging over the edge. **Keep the rim within 32 px of the edge and the middle plain dark**, so I can stretch it to any size without stretching the rim. |
| `pit-round.png` | A round hole | 256 × 256 | Same style, circular. |
| `pond.png` | A boggy pond (slows you down) | 256 × 256 | Murky green-brown water with lily pads, a muddy bank. Same 32 px rim rule as the pit. |
| `lava.png` | A round lava pool | 256 × 256 | Glowing lava with a ring of dark stones round it. Bright in the middle, so it reads as dangerous at a glance. |
| `boulder-1.png`, `boulder-2.png`, `boulder-3.png` | Boulders | 128 × 128 each | Round, mossy grey stone, roughly filling the square. **Without** its shadow (I add the shadow so it always falls the same way). |
| `well.png` | The burrow in each corner | 128 × 128 | A round hole ringed with stone or earth. |
| `stones.png` | Flat stepping stones | 256 × 64 | 4–5 flat stones in a row, set into the grass, very little height. |
| `props.png` | Small details | 512 × 128 | A row of 8 small things, evenly spaced: pebbles, a fallen leaf, a tuft of flowers, a clover patch, a small mushroom. Low contrast; they must never look like something you could bump into. |
| `outside.png` | What's beyond the wall | 512 × 512, seamless | Dark water with lily pads, or dense bushes. Seamless tile, not transparent. |

## A prompt you can start from

> Top-down game art asset, viewed straight from above, hand-painted stylised texture, soft lighting from the top left, muted natural colours, clean edges, transparent background, no text, no characters. Asset: *[describe the piece from the table]*.

For the grass and outside tiles, replace "transparent background" with "seamless tileable texture, edges wrap perfectly".

## What happens next

Send the `meadow` folder (or a zip of it). I'll wire the pieces into the floor drawing, keep the current hand-coded drawing as the fallback when a piece is missing, and add the pieces to the offline version. Arena detail "Low" will keep the plain look.
