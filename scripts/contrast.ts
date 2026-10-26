/**
 * Checks the colors against WCAG 2.1 AA: 4.5:1 for normal text and 3:1 for
 * graphics that carry meaning (game objects, walls, UI parts).
 *
 *   npm run contrast
 */
import { contrast, darken, lighten, PALETTE } from "../src/art/palette";
import { COLORS } from "../src/engine/ui";
import { GAMES } from "../src/games/registry";
import { BRICK_COLORS } from "../src/games/breakout/art";
import { METEOR_COLORS } from "../src/games/meteor/art";

const TEXT = 4.5;
const GRAPHIC = 3;

interface Check {
  label: string;
  fg: string;
  bg: string;
  min: number;
}

const checks: Check[] = [];
const text = (label: string, fg: string, bg: string) => checks.push({ label: `text    ${label}`, fg, bg, min: TEXT });
const graphic = (label: string, fg: string, bg: string) => checks.push({ label: `graphic ${label}`, fg, bg, min: GRAPHIC });

// interface text on the panels and bars it is drawn on
for (const [name, fg] of Object.entries({ text: COLORS.text, dim: COLORS.dim, accent: COLORS.accent, danger: COLORS.danger, good: COLORS.good })) {
  text(`${name} on panel`, fg, COLORS.panel);
  text(`${name} on HUD bar`, fg, COLORS.hudBg);
}
text("dim on playfield", COLORS.dim, COLORS.bg);
// the title screen text sits on a dark haze over the skyline; this is its approximate color
text("dim on the title screen haze", COLORS.dim, "#0a0a1e");
text("white on the title screen haze", COLORS.text, "#0a0a1e");

// cabinet signs: light letters on a darkened version of the cabinet color
for (const info of GAMES) text(`${info.id} cabinet sign`, lighten(info.color, 0.78), darken(info.color, 0.88));
text("capsule letter on yellow", "#05050f", COLORS.accent);
text("capsule letter on cyan", "#05050f", "#5ef0ff");
text("capsule letter on green", "#05050f", "#6cff7a");
text("capsule letter on pink", "#05050f", "#ff7ab8");

// things you must see against the playfield
const field = ["#0b0b1a", "#0e0e22"];
const onField = (label: string, color: string) => {
  for (const bg of field) graphic(`${label} on ${bg}`, color, bg);
};
onField("snake body", PALETTE.e);
onField("snake head", PALETTE.g);
onField("apple", PALETTE.r);
onField("block", PALETTE.s);
onField("wall lip", PALETTE.S);
for (const [kind, color] of Object.entries(BRICK_COLORS)) graphic(`brick ${kind} on board`, color, "#0b0b1a");
graphic("paddle on board", "#c4c4da", "#14143a");
graphic("player ship", PALETTE.b, "#0b0b1a");
graphic("grunt drone", PALETTE.e, "#0b0b1a");
graphic("bomber", PALETTE.o, "#0b0b1a");
graphic("sniper", PALETTE.m, "#0b0b1a");
graphic("enemy shot", PALETTE.r, "#0b0b1a");
graphic("boss", "#8a5ae0", "#0b0b1a");
for (const [kind, color] of Object.entries(METEOR_COLORS)) graphic(`meteor ${kind} edge on space`, color, "#07071a");
graphic("meteor ship edge", PALETTE.c, "#07071a");
graphic("gravity well core", PALETTE.p, "#07071a");
graphic("maze wall edge", "#4a6bdc", "#0b0b1a");
graphic("maze dot", "#f4d9b0", "#0b0b1a");
graphic("chomper", PALETTE.o, "#0b0b1a");
for (const [name, color] of [["Blaze", PALETTE.r], ["Pinch", PALETTE.m], ["Echo", PALETTE.c], ["Wisp", PALETTE.o]]) graphic(`${name} chaser`, color, "#0b0b1a");
graphic("scared chaser", PALETTE.b, "#0b0b1a");
graphic("stunned chaser", PALETTE.s, "#0b0b1a");
graphic("trap", PALETTE.g, "#0b0b1a");
graphic("gate bars", "#7a5ad6", "#0b0b1a");

let failures = 0;
for (const c of checks) {
  const ratio = contrast(c.fg, c.bg);
  const ok = ratio >= c.min;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${ratio.toFixed(2).padStart(5)}:1 (need ${c.min})  ${c.label}`);
}
console.log(failures === 0 ? `\nAll ${checks.length} checks pass.` : `\n${failures} of ${checks.length} checks fail.`);
if (failures > 0) process.exit(1);
