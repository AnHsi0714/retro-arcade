# Retro Arcade

A side-scrolling hallway of arcade cabinets. Walk left and right, stop in front of a machine and press a key to play. Each cabinet is a small game inspired by a classic arcade title, with its own twists.

Built with Vite + TypeScript and a plain `<canvas>`, no game framework.

> **Status: prototype.** Everything visual is placeholder blocks and every sound is a synthesized beep. Real art and audio come in stage 9 of [the plan](retro-arcade-plan.md).

## Running locally

```bash
npm install
npm run dev        # http://localhost:5173/retro-arcade/
npm run build      # type-check + production build into dist/
npm run smoke      # headless test: runs every game with random input
```

Pushing to `main` builds and deploys to GitHub Pages via [.github/workflows/deploy.yml](.github/workflows/deploy.yml). In the repo settings, set **Pages → Source** to **GitHub Actions**. If the repo isn't named `retro-arcade`, change `base` in [vite.config.ts](vite.config.ts).

## Controls

| Where         | Keys                                                  |
| ------------- | ----------------------------------------------------- |
| Hallway       | ← → walk, ↑ / Enter play                               |
| In a game     | Esc / P pause (resume, how to play, restart, exit)    |
| Anywhere      | M mute, - / + volume (also in the pause menu)         |
| Snake         | Arrows steer                                           |
| Breakout      | ← → paddle, Space launch                               |
| Star Defender | ← → move, Space fire                                   |
| Meteor Drift  | ← → turn, ↑ thrust, Space fire                         |
| Maze Chomper  | Arrows move, Space drop a trap                         |

WASD works in place of the arrows. A keyboard is required; there are no touch controls yet.

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
    audio.ts            sound playback: synth placeholders, overridable by loaded files, mute
    storage.ts          localStorage wrapper (high scores, mute), safe when storage is blocked
    ui.ts               text, panels, HUD, menus (all text goes through drawText)
    bootScene.ts        title / loading screen, unlocks audio on first key
    math.ts             small math and collision helpers
  hallway/
    machines.ts         cabinet list and positions (data)
    HallwayScene.ts     scrolling hallway, parallax, prompts, high score display
  games/
    registry.ts         every GameInfo (id, title, controls, factory)
    <game>/             one folder per cabinet
scripts/smoke.ts        headless smoke test
```

### Adding a cabinet

1. Create `src/games/<id>/<Name>Game.ts` implementing `ArcadeGame` from [src/engine/game.ts](src/engine/game.ts). Draw only below `HUD_HEIGHT` (the `FIELD` rect); the host draws the HUD and handles pause, restart and game over.
2. Report `{ score, lives?, level?, info?, over }` from `status()`. Setting `over: true` hands control to the host's game-over screen.
3. Add a `GameInfo` entry in [src/games/registry.ts](src/games/registry.ts) and a position in [src/hallway/machines.ts](src/hallway/machines.ts). Its `howTo` lines and `legend` (what each placeholder color means) fill the how-to card shown before the first run and from the pause menu.

### Replacing placeholders (stage 9)

- **Sounds:** call `audio.load(name, url)` in `loadAssets()` in [src/main.ts](src/main.ts). A loaded file replaces the synth with the same name; names without a file keep their beep.
- **Text:** swap the body of `drawText()` in [src/engine/ui.ts](src/engine/ui.ts) for a bitmap font. Text softness is set by `RENDER_SCALE` in [src/engine/screen.ts](src/engine/screen.ts); try values without rebuilding via `?render=1.5` in the URL.
- **Sprites:** each game draws in its own `render()`; the shapes there are the placeholders to swap.

## Assets and licensing

All current visuals are drawn in code and all sounds are synthesized at runtime, so the repo contains no third-party assets. Every asset added later must be recorded with its source and license in [ASSETS.md](ASSETS.md).

## Disclaimer

This project is inspired by classic arcade games. All names, code, art and sound are original or used under the licenses listed in [ASSETS.md](ASSETS.md). It is not affiliated with or endorsed by any original game publisher or rights holder.
