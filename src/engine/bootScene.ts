import { HEIGHT, WIDTH } from "./constants";
import type { GameServices } from "./game";
import type { Scene } from "./scene";
import { tr, type Localized } from "./i18n";
import { isTouchDevice } from "./touch";
import { blink, COLORS, drawPanel, drawText } from "./ui";

const HOW_TO_PLAY: Array<[Localized, Localized]> = [
  [{ en: "WALK", zh: "走動" }, { en: "LEFT / RIGHT arrows (or A / D) along the hall", zh: "LEFT / RIGHT 方向鍵（或 A / D）在長廊走動" }],
  [{ en: "PLAY", zh: "遊玩" }, { en: "stand at a cabinet, press UP or ENTER", zh: "站在機台前按 UP 或 ENTER" }],
  [{ en: "PAUSE", zh: "暫停" }, { en: "ESC or P: how to play, restart, exit to hall", zh: "ESC 或 P：說明、重新開始、回到長廊" }],
  [{ en: "SOUND", zh: "音效" }, { en: "M mute,  - / + volume", zh: "M 靜音，- / + 調整音量" }],
  [{ en: "LANGUAGE", zh: "語言" }, { en: "L switches English / 中文", zh: "L 切換中文 / English" }],
  [{ en: "SCORES", zh: "分數" }, { en: "your best score per cabinet is saved here", zh: "每台機台的最高分會存在這台裝置" }],
];

/**
 * Title / loading screen. Waits for asset loading, then for a key press, which
 * also satisfies the browser's user-gesture rule for audio.
 */
export class BootScene implements Scene {
  private time = 0;
  private ready = false;
  private error: string | null = null;
  private readonly touch = isTouchDevice();

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
    drawText(g, { en: "A hallway of arcade cabinets. Walk up to one and play.", zh: "一條擺滿街機的長廊，走到機台前就能玩。" }, WIDTH / 2, 66, { align: "center", color: COLORS.dim });

    if (this.error) {
      drawText(g, { en: "FAILED TO LOAD", zh: "載入失敗" }, WIDTH / 2, 140, { align: "center", color: COLORS.danger });
      drawText(g, this.error.slice(0, 70), WIDTH / 2, 154, { align: "center", color: COLORS.dim });
      return;
    }
    if (!this.ready) {
      const dots = ".".repeat(1 + (Math.floor(this.time * 3) % 3));
      drawText(g, `${tr({ en: "LOADING", zh: "載入中" })}${dots}`, WIDTH / 2, 140, { align: "center", color: COLORS.dim });
      return;
    }

    const px = 70;
    const py = 88;
    drawPanel(g, px, py, WIDTH - px * 2, 28 + HOW_TO_PLAY.length * 13);
    drawText(g, { en: "HOW TO PLAY", zh: "遊戲說明" }, WIDTH / 2, py + 7, { align: "center", color: COLORS.accent });
    HOW_TO_PLAY.forEach(([key, text], i) => {
      drawText(g, key, px + 14, py + 24 + i * 13, { color: COLORS.good });
      drawText(g, text, px + 70, py + 24 + i * 13);
    });

    if (this.touch) {
      drawText(g, { en: "TOUCH: D-PAD = arrow keys,  A = SPACE / ENTER,  II = ESC", zh: "觸控：方向盤＝方向鍵，A＝SPACE / ENTER，II＝ESC" }, WIDTH / 2, 196, {
        align: "center",
        color: COLORS.good,
      });
    }
    const start = this.touch ? { en: "TAP TO ENTER", zh: "點一下進入" } : { en: "PRESS ANY KEY TO ENTER", zh: "按任意鍵進入" };
    if (blink(this.time)) drawText(g, start, WIDTH / 2, 214, { align: "center" });
    drawText(g, { en: "Inspired by classic arcades. Not affiliated with any original publisher.", zh: "受經典街機啟發，與任何原作公司無關。" }, WIDTH / 2, HEIGHT - 20, {
      align: "center",
      color: COLORS.dim,
    });
  }
}
