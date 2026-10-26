import { HEIGHT, HUD_HEIGHT, WIDTH } from "./constants";
import { getLang, tr, type Text } from "./i18n";

/** Shared palette for placeholder visuals. Stage 9 can retune these in one place. */
export const COLORS = {
  bg: "#0b0b1a",
  hudBg: "#000000",
  text: "#f4f4f4",
  dim: "#8a8aa6",
  accent: "#ffd84a",
  danger: "#ff5a5a",
  good: "#6cff7a",
  // opaque so gameplay never shows through text (keeps the measured contrast)
  panel: "#08081a",
  panelBorder: "#f4f4f4",
};

export const FONT_SIZE = 9;
/** Chinese glyphs need more pixels than Latin ones to stay readable. */
const ZH_SIZE_BONUS = 2;
const ZH_FONT = '"Noto Sans TC", "Microsoft JhengHei", "PingFang TC", sans-serif';

export interface TextOptions {
  color?: string;
  align?: CanvasTextAlign;
  size?: number;
}

function setFont(g: CanvasRenderingContext2D, size: number): void {
  g.font = getLang() === "zh" ? `${size + ZH_SIZE_BONUS}px ${ZH_FONT}` : `${size}px monospace`;
}

/** All text goes through here so a bitmap font can replace it later. */
export function drawText(
  g: CanvasRenderingContext2D,
  text: Text,
  x: number,
  y: number,
  opts: TextOptions = {},
): void {
  setFont(g, opts.size ?? FONT_SIZE);
  g.textBaseline = "top";
  g.textAlign = opts.align ?? "left";
  g.fillStyle = opts.color ?? COLORS.text;
  // the larger Chinese font starts a pixel higher so it stays inside the same line box
  const dy = getLang() === "zh" ? -1 : 0;
  g.fillText(tr(text), Math.round(x), Math.round(y) + dy);
}

/** Width of text as drawText would draw it. */
export function measureText(g: CanvasRenderingContext2D, text: Text, size = FONT_SIZE): number {
  setFont(g, size);
  return g.measureText(tr(text)).width;
}

export function drawPanel(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  g.fillStyle = COLORS.panel;
  g.fillRect(x, y, w, h);
  g.strokeStyle = COLORS.panelBorder;
  g.lineWidth = 1;
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

export function padScore(n: number): string {
  return String(Math.floor(n)).padStart(6, "0");
}

export interface HudData {
  title: string;
  score: number;
  best: number;
  lives?: number;
  level?: number;
  info?: string;
  muted: boolean;
}

/** Shared top bar: title, score, best, lives/level and mute state. */
export function drawHud(g: CanvasRenderingContext2D, hud: HudData): void {
  g.fillStyle = COLORS.hudBg;
  g.fillRect(0, 0, WIDTH, HUD_HEIGHT);
  const y = 3;
  drawText(g, hud.title.toUpperCase(), 4, y, { color: COLORS.accent });
  drawText(g, `${tr({ en: "SCORE", zh: "分數" })} ${padScore(hud.score)}`, 120, y);
  drawText(g, `${tr({ en: "HI", zh: "最高" })} ${padScore(Math.max(hud.best, hud.score))}`, 220, y, { color: COLORS.dim });

  const right: string[] = [];
  if (hud.info) right.push(hud.info);
  if (hud.level !== undefined) right.push(`${tr({ en: "LV", zh: "關" })} ${hud.level}`);
  if (hud.lives !== undefined) right.push(`x${Math.max(0, hud.lives)}`);
  if (hud.muted) right.push(tr({ en: "MUTE", zh: "靜音" }));
  drawText(g, right.join("  "), WIDTH - 4, y, { align: "right" });
}

export interface MenuItem {
  label: Text;
  /** Adjustable value shown at the right; the active row shows < > around it. */
  value?: string;
}

/** Centered panel with a title and a vertical list; the selected item gets a cursor. */
export function drawMenu(
  g: CanvasRenderingContext2D,
  title: Text,
  items: readonly MenuItem[],
  selected: number,
  footer: readonly Text[] = [],
): void {
  const lineH = 12;
  const w = 220;
  const h = 30 + items.length * lineH + footer.length * 10 + 8;
  const x = (WIDTH - w) / 2;
  const y = Math.round((HEIGHT - h) / 2);
  drawPanel(g, x, y, w, h);
  drawText(g, title, WIDTH / 2, y + 8, { align: "center", color: COLORS.accent });
  items.forEach((item, i) => {
    const iy = y + 26 + i * lineH;
    const active = i === selected;
    const color = active ? COLORS.text : COLORS.dim;
    drawText(g, `${active ? ">" : " "} ${tr(item.label)}`, x + 40, iy, { color });
    if (item.value !== undefined) {
      drawText(g, active ? `< ${item.value} >` : item.value, x + w - 30, iy, { color, align: "right" });
    }
  });
  footer.forEach((line, i) => {
    drawText(g, line, WIDTH / 2, y + 30 + items.length * lineH + i * 10, { align: "center", color: COLORS.dim });
  });
}

/** Simple blink helper for "press a key" prompts. */
export function blink(time: number, rate = 2): boolean {
  return Math.floor(time * rate) % 2 === 0;
}

export interface HowToData {
  title: string;
  lines: readonly Text[];
  legend?: readonly { color: string; label: Text }[];
  controls: Text;
  prompt: Text;
}

/** Full how-to card: goal lines, a two-column color legend, controls and a prompt. */
export function drawHowTo(g: CanvasRenderingContext2D, data: HowToData, time: number): void {
  const lineH = 12;
  const legendRows = Math.ceil((data.legend?.length ?? 0) / 2);
  const w = 440;
  const h = 36 + data.lines.length * lineH + (legendRows ? 8 + legendRows * lineH : 0) + 46;
  const x = (WIDTH - w) / 2;
  const y = Math.round(HUD_HEIGHT + (HEIGHT - HUD_HEIGHT - h) / 2);
  drawPanel(g, x, y, w, h);

  drawText(g, data.title.toUpperCase(), WIDTH / 2, y + 8, { align: "center", color: COLORS.accent, size: 16 });
  let cy = y + 32;
  for (const line of data.lines) {
    drawText(g, line, x + 16, cy);
    cy += lineH;
  }

  if (data.legend && legendRows) {
    cy += 8;
    data.legend.forEach((item, i) => {
      const col = i < legendRows ? 0 : 1;
      const row = col === 0 ? i : i - legendRows;
      const lx = x + 16 + col * (w / 2 - 8);
      const ly = cy + row * lineH;
      g.fillStyle = item.color;
      g.fillRect(lx, ly + 1, 7, 7);
      drawText(g, item.label, lx + 12, ly, { color: COLORS.text });
    });
    cy += legendRows * lineH;
  }

  cy += 8;
  drawText(g, `${tr({ en: "CONTROLS", zh: "操作" })}  ${tr(data.controls)}`, x + 16, cy, { color: COLORS.dim });
  if (blink(time, 1.5)) drawText(g, data.prompt, WIDTH / 2, y + h - 16, { align: "center", color: COLORS.good });
}

/** Volume bar shown briefly after a volume or mute change. */
export function drawVolumeIndicator(g: CanvasRenderingContext2D, volume: number, max: number, muted: boolean): void {
  const w = 120;
  const x = WIDTH - w - 8;
  const y = HUD_HEIGHT + 6;
  drawPanel(g, x, y, w, 20);
  drawText(g, muted ? { en: "MUTE", zh: "靜音" } : { en: "VOL", zh: "音量" }, x + 6, y + 6, { color: muted ? COLORS.danger : COLORS.text });
  const bx = x + 36;
  const step = (w - 44) / max;
  for (let i = 0; i < max; i++) {
    g.fillStyle = !muted && i < volume ? COLORS.good : "#3a3a5a";
    g.fillRect(Math.round(bx + i * step), y + 6, Math.max(2, Math.floor(step) - 2), 8);
  }
}
