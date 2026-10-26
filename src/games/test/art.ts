import { sprite } from "../../art/baked";

/** The diagnostics robot, 10 x 10. */
export const TESTER = sprite([
  "...cccc...",
  "..cuuuuc..",
  ".cuwkkwuc.",
  ".cuuuuuuc.",
  "..cccccc..",
  ".cbbbbbbc.",
  ".cbwbbwbc.",
  "..cccccc..",
  "..cc..cc..",
  "..CC..CC..",
]);

export const COIN = sprite(["..yy..", ".yxxy.", "yxxyyY", "yxyyyY", ".yyYY.", "..YY.."]);

/** Demo for the hallway cabinet: a test pattern with a scanning bar. */
export function drawTestPreview(g: CanvasRenderingContext2D, time: number): void {
  const bars = ["#f4f4f4", "#ffd84a", "#4ad7ff", "#6cff7a", "#ff7ab8", "#ff5a5a", "#4a6bdc"];
  bars.forEach((color, i) => {
    g.fillStyle = color;
    g.fillRect(Math.round((i * 44) / bars.length), 0, Math.ceil(44 / bars.length), 22);
  });
  g.fillStyle = "#05050f";
  g.fillRect(0, 22, 44, 10);
  g.fillStyle = Math.floor(time * 2) % 2 === 0 ? "#6cff7a" : "#2f9a4a";
  g.fillRect(4, 26, 36, 2);
  g.fillStyle = "rgba(255, 255, 255, 0.35)";
  g.fillRect(0, Math.floor((time * 14) % 22), 44, 2);
}
