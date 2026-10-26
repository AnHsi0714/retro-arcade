# Retro Arcade

A side-scrolling hallway of arcade cabinets. Walk left and right, stop in front of a machine and press a key to play. Each cabinet is a small game inspired by a classic arcade title, with its own twists.

Built with Vite + TypeScript and a plain `<canvas>`, no game framework.

> **Status: playable.** All five games and the hallway are finished, with original pixel art and chiptune audio made for this project. Nothing is sampled or downloaded: pictures are drawn from text grids and code, sounds are synthesized by code. Remaining work is the final playtest and polish (stage 10 of [the plan](retro-arcade-plan.md)).

## Running locally

```bash
npm install
npm run dev        # http://localhost:5173/retro-arcade/
npm run build      # type-check + production build into dist/
npm run smoke      # headless test: runs every game with random input, renders every sound
npm run contrast   # WCAG AA contrast check of text and key graphics
npm run audio:export   # writes every sound and track as WAV into audio-preview/ to listen to
```

Pushing to `main` builds and deploys to GitHub Pages via [.github/workflows/deploy.yml](.github/workflows/deploy.yml). In the repo settings, set **Pages → Source** to **GitHub Actions**. If the repo isn't named `retro-arcade`, change `base` in [vite.config.ts](vite.config.ts).

## Controls

| Where         | Keys                                                  |
| ------------- | ----------------------------------------------------- |
| Hallway       | ← → walk, ↑ / Enter play                               |
| In a game     | Esc / P pause (resume, how to play, restart, exit)    |
| Anywhere      | M mute, - / + volume, L English / 中文 (also in the pause menu) |
| Snake         | Arrows steer                                           |
| Breakout      | ← → paddle, Space launch                               |
| Star Defender | ← → move, Space fire                                   |
| Meteor Drift  | ← → turn, ↑ thrust, Space fire                         |
| Maze Chomper  | Arrows move, Space drop a trap                         |

WASD works in place of the arrows. On phones and tablets, on-screen controls appear: the D-pad acts as the arrow keys, **A** as Space / Enter, **II** as Esc, and tapping the game screen as Enter. Volume and language are in the pause menu. Add `?touch=1` to the URL to try them on a desktop.

## The cabinets

| Cabinet       | Inspired by      | Twists                                                                                     |
| ------------- | ---------------- | ------------------------------------------------------------------------------------------ |
| Snake         | Snake            | Power apples (speed, ghost through walls, shrink); obstacles appear over time               |
| Breakout      | Brick breakers   | Multi-hit, explosive (chain), steel and moving bricks; multi-ball, wide paddle, extra life; boss stage |
| Star Defender | Fixed shooters   | Grunt / bomber / sniper enemies with different shots, divers, erodible shields, weapon levels, boss every 4th wave |
| Meteor Drift  | Inertia shooters | Blast meteors (chain explosions), ice meteors (frost slows you), spread / rapid pickups, gravity well from wave 3, UFO |
| Maze Chomper  | Maze chase       | Four chasers with their own targeting and skills, gates that open and close, stun traps       |
| Test Unit     | –                | Diagnostics cabinet for the hallway ↔ game flow                                             |

## Code layout

```
src/
  main.ts               boot: canvas, input, audio, scenes, loop
  engine/
    constants.ts        480x270 logical resolution, fixed step, HUD/playfield rects
    screen.ts           canvas setup and aspect-preserving (integer when possible) scaling
    loop.ts             fixed-timestep loop, decoupled from refresh rate
    input.ts            keyboard state, per-step press/release edges, key bindings
    scene.ts            Scene interface + SceneManager
    game.ts             ArcadeGame / GameInfo / GameResult contracts
    gameScene.ts        hosts one game: HUD, pause menu, restart, game over, high scores
    audio.ts            AudioManager: effects and looping music from rendered buffers, volume, mute, ducking
    storage.ts          localStorage wrapper (high scores, sound, language), safe when storage is blocked
    i18n.ts             English / Chinese text: tr({ en, zh }), current language, toggle
    touch.ts            on-screen D-pad and buttons for touch devices, sent to Input as virtual keys
    ui.ts               text, panels, HUD, menus (all interface text goes through drawText)
    bootScene.ts        title / loading screen (renders the audio while loading); the first key press unlocks audio and starts the title music
    math.ts             small math and collision helpers
  art/
    palette.ts          the color palette, plus contrast math
    baked.ts            Baked: a picture painted once into its own canvas; sprites from text rows
    font.ts             5x7 pixel font for logos and signs
    draw.ts, tiles.ts   shared pieces (power-up capsules, wall tile)
    skyline.ts          night sky and city used by the hallway and the title screen
  audio/
    synth.ts            software synthesizer (oscillators, noise, filters, envelopes)
    sfx.ts              the sound effects, as layers of tones
    music.ts            tiny tracker: turns note text into a looping track
    tracks.ts           the seven music loops (title, hallway and one per cabinet)
  hallway/
    machines.ts         cabinet list and positions (data)
    art.ts              backdrop, cabinets, player character, carpet, doors
    HallwayScene.ts     scrolling hallway, parallax, prompts, high score display
  games/
    registry.ts         every GameInfo (id, title, controls, music, hallway demo, factory)
    <game>/             one folder per cabinet; art.ts holds its sprites and its hallway demo screen
scripts/
  smoke.ts              headless smoke test
  contrast.ts           accessibility contrast check
  export-audio.ts       renders the audio to WAV files
```

### Adding a cabinet

1. Create `src/games/<id>/<Name>Game.ts` implementing `ArcadeGame` from [src/engine/game.ts](src/engine/game.ts). Draw only below `HUD_HEIGHT` (the `FIELD` rect); the host draws the HUD and handles pause, restart and game over.
2. Report `{ score, lives?, level?, info?, over }` from `status()`. Setting `over: true` hands control to the host's game-over screen.
3. Add a `GameInfo` entry in [src/games/registry.ts](src/games/registry.ts) and a position in [src/hallway/machines.ts](src/hallway/machines.ts). Visible text is written as `{ en, zh }` (see [src/engine/i18n.ts](src/engine/i18n.ts)); plain strings are only for names and numbers. Its `howTo` lines and `legend` (what each color on screen means) fill the how-to card shown before the first run and from the pause menu.
4. Give it a look: sprites and a `drawXxxPreview()` demo for the cabinet screen in `src/games/<id>/art.ts`, a `music` track name, and optionally a `marquee` for the cabinet sign.

### Art and audio

- **Sprites** are rows of characters, one character per palette color (see [src/art/palette.ts](src/art/palette.ts)), turned into small canvases on first use with `sprite()` from [src/art/baked.ts](src/art/baked.ts). Symmetric pictures are written as a left half and mirrored with `mirrorRows()`. Larger pieces (cabinets, bosses, walls) are painted with canvas calls into a `Baked` once and then stamped with `drawImage`.
- **Sound effects** are lists of tones and noise layers in [src/audio/sfx.ts](src/audio/sfx.ts); **music** is note text in [src/audio/tracks.ts](src/audio/tracks.ts) (notation described at the top of [src/audio/music.ts](src/audio/music.ts)). Both are rendered to sample buffers while the loading screen is up. Run `npm run audio:export` to get WAV files you can listen to while tuning.
- **Text** is drawn by `drawText()` in [src/engine/ui.ts](src/engine/ui.ts) with the system fonts; the pixel font in [src/art/font.ts](src/art/font.ts) is only for logos and signs. Text softness is set by `RENDER_SCALE` in [src/engine/screen.ts](src/engine/screen.ts); try values without rebuilding via `?render=1.5` in the URL.
- **Colors** must keep WCAG AA contrast: run `npm run contrast` after adding or changing any, and add the new pair to [scripts/contrast.ts](scripts/contrast.ts).

## Assets and licensing

All pictures are drawn by code and text grids, all sounds and music are synthesized by code, and the only image file is the favicon, which is hand-written SVG. The repo contains no third-party assets, fonts included (interface text uses fonts already on the player's device). Every asset added later must be recorded with its source and license in [ASSETS.md](ASSETS.md).

## Disclaimer

This project is inspired by classic arcade games. All names, code, art and sound are original or used under the licenses listed in [ASSETS.md](ASSETS.md). It is not affiliated with or endorsed by any original game publisher or rights holder.
