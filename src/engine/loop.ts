import { STEP } from "./constants";

/** Longest frame we try to catch up on; anything longer (tab hidden, breakpoints) is dropped. */
const MAX_FRAME = 0.25;

/**
 * Fixed-timestep loop: update() always receives STEP, independent of the
 * display refresh rate. render() runs once per animation frame.
 */
export class GameLoop {
  private acc = 0;
  private last = 0;
  private raf = 0;

  constructor(
    private readonly update: (dt: number) => void,
    private readonly render: () => void,
  ) {}

  start(): void {
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  private frame = (now: number): void => {
    const delta = Math.min((now - this.last) / 1000, MAX_FRAME);
    this.last = now;
    this.acc += delta;
    while (this.acc >= STEP) {
      this.update(STEP);
      this.acc -= STEP;
    }
    this.render();
    this.raf = requestAnimationFrame(this.frame);
  };
}
