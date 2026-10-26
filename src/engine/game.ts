import type { AudioManager, MusicName } from "./audio";
import type { Text } from "./i18n";
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
  label: Text;
}

/** Size of the little screen on a cabinet in the hallway. */
export const PREVIEW_W = 44;
export const PREVIEW_H = 32;

export interface GameInfo {
  id: string;
  title: string;
  /** Short name for the cabinet sign when the title is too long, e.g. "DEFENDER". Defaults to the first word. */
  marquee?: string;
  /** Draws a looping demo on the cabinet's screen, into a PREVIEW_W x PREVIEW_H box at the origin. */
  preview?: (g: CanvasRenderingContext2D, time: number) => void;
  /** One-line description shown on the cabinet. */
  tagline: Text;
  /** Short control hint shown on the how-to screen and in the pause menu. */
  controls: Text;
  /** Goal and rules, one short line each, shown before the first run. */
  howTo: Text[];
  /** What each color on screen means. */
  legend?: LegendItem[];
  /** Background music while playing; silent when omitted. */
  music?: MusicName;
  /** Main color of the cabinet, also used for its title text and accents. */
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
