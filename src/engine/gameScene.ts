import { FIELD } from "./constants";
import type { ArcadeGame, GameInfo, GameResult, GameServices } from "./game";
import { Keys } from "./input";
import type { Scene } from "./scene";
import { getHighScore, submitScore } from "./storage";
import { COLORS, drawHowTo, drawHud, drawMenu, drawText, padScore, type MenuItem } from "./ui";

/** intro: how-to card before the first run; help: the same card opened from the pause menu. */
type Mode = "intro" | "playing" | "paused" | "help" | "over";

const PAUSE_ITEMS: MenuItem[] = [{ label: "RESUME" }, { label: "HOW TO PLAY" }, { label: "RESTART" }, { label: "EXIT TO HALL" }];
const OVER_ITEMS: MenuItem[] = [{ label: "PLAY AGAIN" }, { label: "EXIT TO HALL" }];

/** Ignore input briefly after game over so a held fire key doesn't skip the screen. */
const OVER_INPUT_DELAY = 0.8;

/**
 * Hosts one ArcadeGame: HUD, pause menu, restart, game-over screen and high
 * score bookkeeping. Calls onExit with the visit's result when the player leaves.
 */
export class GameScene implements Scene {
  private game!: ArcadeGame;
  private mode: Mode = "playing";
  private cursor = 0;
  private best = 0;
  private visitBest = 0;
  private newRecord = false;
  private visitRecord = false;
  private overTimer = 0;
  private time = 0;

  constructor(
    private readonly info: GameInfo,
    private readonly services: GameServices,
    private readonly onExit: (result: GameResult) => void,
  ) {}

  enter(): void {
    this.best = getHighScore(this.info.id);
    this.services.input.clear();
    this.start();
    this.mode = "intro";
  }

  exit(): void {
    this.game.destroy();
  }

  update(dt: number): void {
    const { input, audio } = this.services;
    this.time += dt;
    switch (this.mode) {
      case "intro": {
        if (input.wasPressed(Keys.back)) this.leave();
        else if (input.wasPressed(Keys.confirm)) {
          audio.play("confirm");
          this.resume();
        }
        return;
      }
      case "help": {
        if (input.wasPressed(Keys.back) || input.wasPressed(Keys.confirm) || input.wasPressed(Keys.pause)) {
          audio.play("back");
          input.consume();
          this.mode = "paused";
        }
        return;
      }
      case "playing": {
        if (input.wasPressed(Keys.pause)) {
          this.mode = "paused";
          this.cursor = 0;
          audio.play("pause");
          return;
        }
        this.game.update(dt);
        const status = this.game.status();
        if (status.over) this.finish(status.score);
        return;
      }
      case "paused": {
        if (input.wasPressed(Keys.pause)) {
          this.resume();
          return;
        }
        const choice = this.navigate(PAUSE_ITEMS.length);
        if (choice === 0) this.resume();
        else if (choice === 1) this.mode = "help";
        else if (choice === 2) this.restart();
        else if (choice === 3) this.leave();
        return;
      }
      case "over": {
        this.overTimer += dt;
        if (this.overTimer < OVER_INPUT_DELAY) return;
        if (input.wasPressed(Keys.back)) {
          this.leave();
          return;
        }
        const choice = this.navigate(OVER_ITEMS.length);
        if (choice === 0) this.restart();
        else if (choice === 1) this.leave();
      }
    }
  }

  render(g: CanvasRenderingContext2D): void {
    g.fillStyle = COLORS.bg;
    g.fillRect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
    g.save();
    // games draw only inside the playfield; things like wrapping sprites can't spill onto the HUD
    g.beginPath();
    g.rect(FIELD.x, FIELD.y, FIELD.w, FIELD.h);
    g.clip();
    this.game.render(g);
    g.restore();

    const status = this.game.status();
    drawHud(g, {
      title: this.info.title,
      score: status.score,
      best: this.best,
      lives: status.lives,
      level: status.level,
      info: status.info,
      muted: this.services.audio.muted,
    });

    if (this.mode === "intro" || this.mode === "help") {
      drawHowTo(
        g,
        {
          title: this.info.title,
          lines: this.info.howTo,
          legend: this.info.legend,
          controls: this.info.controls,
          prompt: this.mode === "intro" ? "ENTER / SPACE: START     ESC: BACK TO HALL" : "ENTER / ESC: BACK",
        },
        this.time,
      );
    } else if (this.mode === "paused") {
      drawMenu(g, "PAUSED", PAUSE_ITEMS, this.cursor, ["ESC/P resume  M mute"]);
    } else if (this.mode === "over") {
      const footer = [`SCORE ${padScore(status.score)}`];
      if (this.newRecord) footer.push("NEW RECORD!");
      drawMenu(g, "GAME OVER", OVER_ITEMS, this.cursor, footer);
      if (this.overTimer < OVER_INPUT_DELAY) {
        drawText(g, "...", FIELD.w / 2, FIELD.y + 4, { align: "center", color: COLORS.dim });
      }
    }
  }

  private start(): void {
    this.game = this.info.create();
    this.game.init(this.services);
    this.mode = "playing";
  }

  /** Up/down moves the cursor; returns the chosen index on confirm, else -1. */
  private navigate(count: number): number {
    const { input, audio } = this.services;
    if (input.wasPressed(Keys.up)) {
      this.cursor = (this.cursor + count - 1) % count;
      audio.play("select");
    } else if (input.wasPressed(Keys.down)) {
      this.cursor = (this.cursor + 1) % count;
      audio.play("select");
    } else if (input.wasPressed(Keys.confirm)) {
      audio.play("confirm");
      input.consume();
      return this.cursor;
    }
    return -1;
  }

  private resume(): void {
    this.mode = "playing";
    this.services.input.consume();
  }

  private finish(score: number): void {
    this.mode = "over";
    this.cursor = 0;
    this.overTimer = 0;
    this.recordScore(score);
    this.services.audio.play("gameOver");
  }

  private recordScore(score: number): void {
    this.visitBest = Math.max(this.visitBest, score);
    if (submitScore(this.info.id, score)) {
      this.newRecord = true;
      this.visitRecord = true;
      this.best = score;
    }
  }

  private restart(): void {
    if (this.mode === "paused") this.recordScore(this.game.status().score);
    this.game.destroy();
    this.newRecord = false;
    this.start();
  }

  private leave(): void {
    if (this.mode === "paused") this.recordScore(this.game.status().score);
    this.services.audio.play("back");
    this.onExit({ gameId: this.info.id, score: this.visitBest, newRecord: this.visitRecord });
  }
}
