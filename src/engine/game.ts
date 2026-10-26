import type { AudioManager } from "./audio";
import type { Input } from "./input";

/** Shared services handed to every game. */
export interface GameServices {
  input: Input;
  audio: AudioManager;
}

/** What the host needs to know to draw the HUD and detect the end of a run. */
export interface GameStatus {
  score: number;
  lives?: number;
  level?: number;
  /** Extra short HUD text, e.g. an active power-up. */
  info?: string;
  over: boolean;
}

/**
 * Contract every arcade machine implements. The host (GameScene) owns pause,
 * restart, the game-over screen, the HUD and high scores, so games only
 * simulate and draw their playfield (below HUD_HEIGHT).
 */
export interface ArcadeGame {
  init(services: GameServices): void;
  update(dt: number): void;
  render(g: CanvasRenderingContext2D): void;
  destroy(): void;
  status(): GameStatus;
}

/** A colored swatch and what it means, for the how-to screen. */
export interface LegendItem {
  color: string;
  label: string;
}

export interface GameInfo {
  id: string;
  title: string;
  /** One-line description shown on the cabinet. */
  tagline: string;
  /** Short control hint shown on the how-to screen and in the pause menu. */
  controls: string;
  /** Goal and rules, one short line each, shown before the first run. */
  howTo: string[];
  /** What the placeholder colors mean. */
  legend?: LegendItem[];
  /** Placeholder cabinet color until real artwork exists. */
  color: string;
  create(): ArcadeGame;
}

/** Returned to the hallway when the player leaves a machine. */
export interface GameResult {
  gameId: string;
  /** Best score reached during this visit. */
  score: number;
  newRecord: boolean;
}
