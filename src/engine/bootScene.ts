import { drawPixelText } from "../art/font";
import { createSky, drawScrolling, SKYLINE_FAR, SKYLINE_NEAR } from "../art/skyline";
import { HEIGHT, WIDTH } from "./constants";
import type { GameServices } from "./game";
import type { Scene } from "./scene";
import { tr, type Localized } from "./i18n";
import { isTouchDevice } from "./touch";
import { blink, COLORS, drawPanel, drawText, FONT_SIZE, measureText } from "./ui";

/** The how-to block is secondary to the title, so it uses a smaller size than regular UI text. */
const HELP_SIZE = 7;
const HELP_LINE = 11;
/** The logo is drawn in the pixel font: 7 pixel rows at scale 4. */
const TITLE_SIZE = 28;
const SKY = createSky(HEIGHT);
const GROUP_GAP = 16;
const DISCLAIMER_Y = HEIGHT - 20;

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
  /** Browsers only play sound after a key press, so the first press starts the music and the second enters. */
  private started = false;
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
      if (!this.started) {
        this.started = true;
        this.services.audio.playMusic("title");
        return;
      }
      this.onStart();
    }
  }

  render(g: CanvasRenderingContext2D): void {
    SKY.draw(g, 0, 0);
    drawScrolling(g, SKYLINE_FAR, this.time * 5, 1, HEIGHT - SKYLINE_FAR.h);
    drawScrolling(g, SKYLINE_NEAR, this.time * 9, 1, HEIGHT - SKYLINE_NEAR.h);
    // dark haze at the bottom keeps the small text readable over the city lights
    const haze = g.createLinearGradient(0, HEIGHT - 120, 0, HEIGHT);
    haze.addColorStop(0, "rgba(8, 8, 26, 0)");
    haze.addColorStop(0.6, "rgba(8, 8, 26, 0.9)");
    haze.addColorStop(1, "rgba(8, 8, 26, 0.95)");
    g.fillStyle = haze;
    g.fillRect(0, HEIGHT - 120, WIDTH, 120);
    drawText(g, { en: "Inspired by classic arcades. Not affiliated with any original publisher.", zh: "受經典街機啟發，與任何原作公司無關。" }, WIDTH / 2, DISCLAIMER_Y, {
      align: "center",
      color: COLORS.dim,
    });

    // title, how-to panel, touch hint and prompt form one group, centered vertically above the disclaimer
    const panelH = 26 + HOW_TO_PLAY.length * HELP_LINE;
    const touchH = this.touch ? HELP_LINE + 4 : 0;
    const groupH = TITLE_SIZE + GROUP_GAP + panelH + touchH + GROUP_GAP + FONT_SIZE;
    let y = Math.round((DISCLAIMER_Y - 8 - groupH) / 2);
    drawPixelText(g, "RETRO ARCADE", WIDTH / 2, y, { align: "center", scale: 4, color: COLORS.accent, shadow: "#6a5410" });
    y += TITLE_SIZE + GROUP_GAP;

    if (this.error) {
      drawText(g, { en: "FAILED TO LOAD", zh: "載入失敗" }, WIDTH / 2, y, { align: "center", color: COLORS.danger });
      drawText(g, this.error.slice(0, 70), WIDTH / 2, y + 14, { align: "center", color: COLORS.dim });
      return;
    }
    if (!this.ready) {
      const dots = ".".repeat(1 + (Math.floor(this.time * 3) % 3));
      drawText(g, `${tr({ en: "LOADING", zh: "載入中" })}${dots}`, WIDTH / 2, y, { align: "center", color: COLORS.dim });
      return;
    }

    // panel hugs its longest row, centered
    const keyW = Math.max(...HOW_TO_PLAY.map(([key]) => measureText(g, key, HELP_SIZE))) + 14;
    const textW = Math.max(...HOW_TO_PLAY.map(([, text]) => measureText(g, text, HELP_SIZE)));
    const pw = Math.ceil(keyW + textW + 28);
    const px = Math.round((WIDTH - pw) / 2);
    drawPanel(g, px, y, pw, panelH);
    drawText(g, { en: "HOW TO PLAY", zh: "遊戲說明" }, WIDTH / 2, y + 6, { align: "center", color: COLORS.accent, size: HELP_SIZE + 1 });
    HOW_TO_PLAY.forEach(([key, text], i) => {
      const ry = y + 21 + i * HELP_LINE;
      drawText(g, key, px + 14, ry, { color: COLORS.good, size: HELP_SIZE });
      drawText(g, text, px + 14 + keyW, ry, { size: HELP_SIZE });
    });
    y += panelH;

    if (this.touch) {
      drawText(g, { en: "TOUCH: D-PAD = arrow keys,  A = SPACE / ENTER,  II = ESC", zh: "觸控：方向盤＝方向鍵，A＝SPACE / ENTER，II＝ESC" }, WIDTH / 2, y + 4, {
        align: "center",
        color: COLORS.good,
        size: HELP_SIZE,
      });
      y += touchH;
    }
    const start = this.started
      ? this.touch
        ? { en: "TAP TO ENTER", zh: "點一下進入" }
        : { en: "PRESS ANY KEY TO ENTER", zh: "按任意鍵進入" }
      : this.touch
        ? { en: "TAP TO START", zh: "點一下開始" }
        : { en: "PRESS ANY KEY TO START", zh: "按任意鍵開始" };
    if (blink(this.time)) drawText(g, start, WIDTH / 2, y + GROUP_GAP, { align: "center" });
  }
}
