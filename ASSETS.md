# Asset sources and licenses

Every image, sound, music track and font in the repo must have a row here before it is committed. Allowed: made for this project, or CC0 / another license that clearly permits redistribution.

Nothing in this repo was downloaded, sampled, traced or converted from someone else's work. Pictures come from text grids and drawing code, sounds and music come from a software synthesizer, so there are no binary asset files except the favicon.

| File | Type | Author / source | License | Notes |
| ---- | ---- | --------------- | ------- | ----- |
| `src/art/palette.ts` | Color palette | Made for this project | Original, no third-party material | 35 named colors; contrast checked by `npm run contrast` |
| `src/art/font.ts` | Pixel font (5x7) | Letter shapes drawn for this project | Original, no third-party material | Used for logos and cabinet signs only |
| `src/art/tiles.ts`, `src/art/draw.ts`, `src/art/skyline.ts` | Wall tile, power-up capsules, night sky and city | Made for this project | Original, no third-party material | Painted from rows of characters and canvas calls |
| `src/hallway/art.ts` | Hallway backdrop, cabinets, player character, carpet, doors, plant | Made for this project | Original, no third-party material | Each cabinet is built from the game's registry color and name |
| `src/games/snake/art.ts` | Snake sprites, wall, demo screen | Made for this project | Original, no third-party material | |
| `src/games/breakout/art.ts` | Bricks, paddle, ball, boss, board, demo screen | Made for this project | Original, no third-party material | |
| `src/games/defender/art.ts` | Fighter, three enemy kinds, saucer boss, shots, demo screen | Made for this project | Original, no third-party material | Enemy designs are not copies of any existing invader sprite |
| `src/games/meteor/art.ts` | Ship, meteors, UFO, gravity well, sky, demo screen | Made for this project | Original, no third-party material | |
| `src/games/maze/art.ts` | Chomper (a fish), four chasers, walls, gate, trap, demo screen | Made for this project | Original, no third-party material | Chaser designs: flame, horned beetle, bat, wisp |
| `src/games/test/art.ts` | Test robot, coin, test pattern | Made for this project | Original, no third-party material | |
| `public/favicon.svg` | Icon | Hand-written SVG for this project | Original, no third-party material | A tiny arcade cabinet |
| `src/audio/synth.ts` | Software synthesizer | Written for this project | Original, no third-party material | Pulse, saw, triangle, sine and noise voices; filters; envelopes |
| `src/audio/sfx.ts` | 18 sound effects | Designed for this project | Original, no third-party material | select, confirm, back, pause, step, eat, powerup, shoot, enemyShoot, bounce, hit, explode, bigExplode, die, levelUp, gameOver, trap, newRecord |
| `src/audio/tracks.ts` | 7 music loops | Composed for this project | Original, no third-party material | title (E-flat major, 128 bpm), hallway (A minor, 96 bpm), snake (E minor, 116), breakout (C major, 138), defender (D minor, 150), meteor (D minor, 88), maze (A minor, 132). No existing tune is quoted |

## Fonts

No font file is bundled. Interface text uses fonts that are already on the player's device: `monospace` for English, and Noto Sans TC, Microsoft JhengHei or PingFang TC for Chinese (see `src/engine/ui.ts`).

## Checking

- `npm run contrast` checks text against WCAG AA (4.5:1) and meaningful graphics against 3:1.
- `npm run audio:export` writes every sound and track to `audio-preview/` as WAV files for listening.
- `npm run smoke` renders every sound and track and fails on silence, clipping or a loop that jumps.
