import { FIELD } from "../../engine/constants";
import type { ArcadeGame, GameServices, GameStatus } from "../../engine/game";
import { Keys } from "../../engine/input";
import { clamp, rand, rectsOverlap } from "../../engine/math";
import { COLORS, drawText } from "../../engine/ui";
import { COIN, TESTER } from "./art";

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
    drawText(g, { en: "TEST UNIT - collect coins, X to end the run", zh: "測試機台：撿金幣，按 X 結束這局" }, FIELD.w / 2, FIELD.y + 6, {
      align: "center",
      color: COLORS.dim,
    });
    COIN.draw(g, this.coin.x, this.coin.y);
    TESTER.draw(g, this.x, this.y);
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
