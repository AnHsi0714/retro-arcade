import { FIELD } from "../../engine/constants";
import type { ArcadeGame, GameServices, GameStatus } from "../../engine/game";
import { Keys } from "../../engine/input";
import { clamp, rand, rectsOverlap } from "../../engine/math";
import { COLORS, drawText } from "../../engine/ui";

const SIZE = 10;
const SPEED = 120;

/** Minimal machine used to verify the hallway -> game -> hallway flow. */
export class TestGame implements ArcadeGame {
  private services!: GameServices;
  private x = FIELD.w / 2;
  private y = FIELD.y + FIELD.h / 2;
  private coin = { x: 0, y: 0, w: 6, h: 6 };
  private score = 0;
  private over = false;

  init(services: GameServices): void {
    this.services = services;
    this.placeCoin();
  }

  update(dt: number): void {
    const { input, audio } = this.services;
    if (input.wasPressed(Keys.alt)) this.over = true;
    this.x = clamp(this.x + input.axisX() * SPEED * dt, FIELD.x, FIELD.x + FIELD.w - SIZE);
    this.y = clamp(this.y + input.axisY() * SPEED * dt, FIELD.y, FIELD.y + FIELD.h - SIZE);
    if (rectsOverlap({ x: this.x, y: this.y, w: SIZE, h: SIZE }, this.coin)) {
      this.score += 10;
      audio.play("eat");
      this.placeCoin();
    }
  }

  render(g: CanvasRenderingContext2D): void {
    drawText(g, "TEST UNIT - collect coins, X to end the run", FIELD.w / 2, FIELD.y + 6, {
      align: "center",
      color: COLORS.dim,
    });
    g.fillStyle = COLORS.accent;
    g.fillRect(this.coin.x, this.coin.y, this.coin.w, this.coin.h);
    g.fillStyle = COLORS.text;
    g.fillRect(Math.round(this.x), Math.round(this.y), SIZE, SIZE);
  }

  destroy(): void {}

  status(): GameStatus {
    return { score: this.score, over: this.over };
  }

  private placeCoin(): void {
    this.coin.x = rand(FIELD.x + 10, FIELD.x + FIELD.w - 16);
    this.coin.y = rand(FIELD.y + 20, FIELD.y + FIELD.h - 16);
  }
}
