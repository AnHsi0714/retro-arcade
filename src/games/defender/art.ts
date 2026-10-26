import { Baked, mirrorRows, sprite } from "../../art/baked";
import { lighten } from "../../art/palette";

export type EnemyKind = "grunt" | "bomber" | "sniper";

/** Fighter flying up the screen, 13 x 11. The nose is the top row. */
export const PLAYER_SHIP = sprite(
  mirrorRows(["......c", "......c", ".....cc", ".....cu", "....bcw", "...bbcc", "..bbbbc", ".bbBbbc", "bbBBbbc", "bB..Bbc", "B....Bc"], true),
);

/** Two frames per enemy, 14 x 10. */
export const ENEMIES: Record<EnemyKind, Baked[]> = {
  // orb drone: a domed pod with a visor; its eyes glance and its thruster flickers
  grunt: [
    sprite(mirrorRows(["....GGG", "..GGeee", ".Geeggg", "GGegggg", "GeeGkkk", "GGeGkrk", ".GeeGkk", "..GGeee", "...GGGe", ".....GG"])),
    sprite(mirrorRows(["....GGG", "..GGeee", ".Geeggg", "GGegggg", "GeeGkkk", "GGeGkkr", ".GeeGkk", "..GGeee", "...GGGe", ".....Gy"])),
  ],
  // wasp bomber: wings flap, bomb bay underneath
  bomber: [
    sprite(mirrorRows([".......", "aa....O", "aaa.OoO", ".aaOooo", "..aOooo", "...Ooyy", "....Okk", "....Ooo", ".....OO", "......O"])),
    sprite(mirrorRows([".......", "......O", "....OoO", "...Oooo", "..aOooo", ".aaOoyy", "aaaOkkk", "aa.Ooo.", ".....OO", "......O"])),
  ],
  // cyclops sentinel: one big eye that glances left and right
  sniper: [
    sprite(mirrorRows([".....mm", "....mMM", "...mMmm", "..mMwww", "..mMwrr", "..mMwkk", "...mMww", "....mMm", ".....Mm", "......M"])),
    sprite(mirrorRows([".....mm", "....mMM", "...mMmm", "..mMwww", "..mMwwr", "..mMwwk", "...mMww", "....mMm", ".....Mm", "......M"])),
  ],
};

export const PLAYER_SHOT = sprite([".w.", "cwc", "cwc", "cwc", ".c.", ".c."]);
export const ENEMY_SHOT = sprite([".r.", "rqr", "rqr", "rrr", ".r.", ".R."]);

export const BOSS_W = 64;
export const BOSS_H = 24;
/** Main color of the boss; the how-to legend swatch uses it too. */
export const BOSS_COLOR = "#8a5ae0";

function paintBoss(g: CanvasRenderingContext2D, flash: boolean): void {
  const tone = (hex: string) => (flash ? lighten(hex, 0.8) : hex);
  const fill = (color: string, x: number, y: number, w: number, h: number) => {
    g.fillStyle = tone(color);
    g.fillRect(x, y, w, h);
  };
  // glass dome with a pilot silhouette
  fill("#2a1f55", 20, 0, 24, 2);
  fill("#2a1f55", 15, 2, 34, 2);
  fill("#2a1f55", 12, 4, 40, 6);
  fill("#aef0ff", 21, 1, 22, 1);
  fill("#6fb8d8", 16, 3, 32, 1);
  fill("#6fb8d8", 13, 5, 38, 4);
  fill("#aef0ff", 17, 4, 6, 1);
  fill("#2a1f55", 28, 4, 8, 5);
  fill("#2a1f55", 26, 6, 12, 3);
  fill("#ff5a5a", 29, 6, 2, 1);
  fill("#ff5a5a", 33, 6, 2, 1);
  // hull
  fill("#2a1f55", 0, 10, 64, 9);
  fill("#2a1f55", 4, 9, 56, 1);
  fill(BOSS_COLOR, 2, 10, 60, 7);
  fill("#c4a0ff", 4, 10, 56, 1);
  fill("#5a3aa8", 2, 14, 60, 3);
  // rim lights
  const lights = ["#ffd84a", "#ff5a5a", "#4ad7ff", "#6cff7a"];
  for (let i = 0; i < 8; i++) fill(lights[i % lights.length], 6 + i * 7, 12, 3, 2);
  // underside: two cannons and a central dish
  fill("#2a1f55", 14, 18, 8, 6);
  fill("#4a4a78", 15, 18, 6, 5);
  fill("#05050f", 17, 22, 2, 2);
  fill("#2a1f55", 42, 18, 8, 6);
  fill("#4a4a78", 43, 18, 6, 5);
  fill("#05050f", 45, 22, 2, 2);
  fill("#2a1f55", 24, 18, 16, 3);
  fill("#5a3aa8", 26, 18, 12, 2);
}

export const BOSS = new Baked(BOSS_W, BOSS_H, (g) => paintBoss(g, false));
export const BOSS_FLASH = new Baked(BOSS_W, BOSS_H, (g) => paintBoss(g, true));

/** Bunker cell colors, lightest at the top. */
export const SHIELD_SHADES = ["#b6ffbf", "#6cff7a", "#4fd464", "#3fbf5a", "#2f9a4a", "#237a3a", "#1f6a34", "#1f6a34"];

const tri = (x: number): number => Math.abs((((x % 2) + 2) % 2) - 1);

/** Demo for the hallway cabinet: one enemy of each kind above a fighter that keeps firing. */
export function drawDefenderPreview(g: CanvasRenderingContext2D, time: number): void {
  g.fillStyle = "#0b0b1a";
  g.fillRect(0, 0, 44, 32);
  g.fillStyle = "#3f3f78";
  for (const [x, y] of [[5, 12], [22, 15], [38, 10], [12, 20], [31, 22]]) g.fillRect(x, (y + time * 6) % 32, 1, 1);
  const frame = Math.floor(time * 2) % 2;
  (["grunt", "bomber", "sniper"] as const).forEach((kind, i) => ENEMIES[kind][frame].draw(g, 1 + i * 14, 2));
  const shipX = 15 + 14 * tri(time * 0.4);
  PLAYER_SHIP.draw(g, Math.round(shipX), 20);
  const shot = (time * 40) % 24;
  PLAYER_SHOT.draw(g, Math.round(shipX) + 5, Math.round(18 - shot));
}
