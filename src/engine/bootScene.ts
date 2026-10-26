import { HEIGHT, WIDTH } from "./constants";
import type { GameServices } from "./game";
import type { Scene } from "./scene";
import { blink, COLORS, drawPanel, drawText } from "./ui";

const HOW_TO_PLAY: Array<[string, string]> = [
  ["WALK", "LEFT / RIGHT arrows (or A / D) along the hall"],
  ["PLAY", "stand at a cabinet, press UP or ENTER"],
  ["PAUSE", "ESC or P: how to play, restart, exit to hall"],
  ["SOUND", "M mutes and unmutes"],
  ["SCORES", "your best score per cabinet is saved here"],
];

/**
 * Title / loading screen. Waits for asset loading, then for a key press, which
 * also satisfies the browser's user-gesture rule for audio.
 */
export class BootScene implements Scene {
  private time = 0;
  private ready = false;
  private error: string | null = null;
  private readonly touchOnly = window.matchMedia?.("(pointer: coarse)").matches && !window.matchMedia("(pointer: fine)").matches;

  constructor(
    private readonly services: GameServices,
    loading: Promise<unknown>,
    private readonly onStart: () => void,
  ) {
    loading.then(
      () => (this.ready = true),
      (err: unknown) => (this.error = err instanceof Error ? err.message : String(err)),
    );
  }

  update(dt: number): void {
    this.time += dt;
    if (this.ready && this.services.input.anyPressed()) {
      this.services.audio.play("confirm");
      this.onStart();
    }
  }

  render(g: CanvasRenderingContext2D): void {
    g.fillStyle = COLORS.bg;
    g.fillRect(0, 0, WIDTH, HEIGHT);
    drawText(g, "RETRO ARCADE", WIDTH / 2, 36, { align: "center", size: 24, color: COLORS.accent });
    drawText(g, "A hallway of arcade cabinets. Walk up to one and play.", WIDTH / 2, 66, { align: "center", color: COLORS.dim });

    if (this.error) {
      drawText(g, "FAILED TO LOAD", WIDTH / 2, 140, { align: "center", color: COLORS.danger });
      drawText(g, this.error.slice(0, 70), WIDTH / 2, 154, { align: "center", color: COLORS.dim });
      return;
    }
    if (!this.ready) {
      const dots = ".".repeat(1 + (Math.floor(this.time * 3) % 3));
      drawText(g, `LOADING${dots}`, WIDTH / 2, 140, { align: "center", color: COLORS.dim });
      return;
    }

    const px = 70;
    const py = 88;
    drawPanel(g, px, py, WIDTH - px * 2, 28 + HOW_TO_PLAY.length * 13);
    drawText(g, "HOW TO PLAY", WIDTH / 2, py + 7, { align: "center", color: COLORS.accent });
    HOW_TO_PLAY.forEach(([key, text], i) => {
      drawText(g, key, px + 14, py + 24 + i * 13, { color: COLORS.good });
      drawText(g, text, px + 70, py + 24 + i * 13);
    });

    if (this.touchOnly) {
      drawText(g, "A KEYBOARD IS REQUIRED TO PLAY", WIDTH / 2, 196, { align: "center", color: COLORS.danger });
    }
    if (blink(this.time)) drawText(g, "PRESS ANY KEY TO ENTER", WIDTH / 2, 214, { align: "center" });
    drawText(g, "Inspired by classic arcades. Not affiliated with any original publisher.", WIDTH / 2, HEIGHT - 20, {
      align: "center",
      color: COLORS.dim,
    });
  }
}
