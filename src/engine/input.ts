/** Key bindings by action. Values are KeyboardEvent.code. */
export const Keys = {
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  up: ["ArrowUp", "KeyW"],
  down: ["ArrowDown", "KeyS"],
  action: ["Space", "KeyZ"],
  alt: ["KeyX", "ShiftLeft", "ShiftRight"],
  confirm: ["Enter", "Space", "KeyZ"],
  back: ["Escape", "Backspace"],
  pause: ["Escape", "KeyP"],
  mute: ["KeyM"],
  volumeDown: ["Minus", "NumpadSubtract"],
  volumeUp: ["Equal", "NumpadAdd"],
  language: ["KeyL"],
} as const;

export type KeyList = readonly string[];

const BLOCK_DEFAULT = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
  "Backspace",
]);

/**
 * Keyboard state. Press/release edges are buffered between fixed steps so a
 * tap is never lost (no step this frame) or seen twice (several steps this frame).
 */
export class Input {
  private down = new Set<string>();
  private pendingPressed = new Set<string>();
  private pendingReleased = new Set<string>();
  private pressed = new Set<string>();
  private released = new Set<string>();
  private listeners: Array<() => void> = [];

  attach(target: Window): void {
    target.addEventListener("keydown", (e) => {
      if (BLOCK_DEFAULT.has(e.code)) e.preventDefault();
      if (!e.repeat) {
        this.down.add(e.code);
        this.pendingPressed.add(e.code);
      }
      for (const fn of this.listeners) fn();
    });
    target.addEventListener("keyup", (e) => {
      this.down.delete(e.code);
      this.pendingReleased.add(e.code);
    });
    target.addEventListener("blur", () => this.clear());
  }

  /** Called on every key press; used for things like unlocking audio. */
  onAnyKey(fn: () => void): void {
    this.listeners.push(fn);
  }

  /** Call once at the start of every fixed update step. */
  beginStep(): void {
    this.pressed = this.pendingPressed;
    this.released = this.pendingReleased;
    this.pendingPressed = new Set();
    this.pendingReleased = new Set();
  }

  isDown(keys: KeyList): boolean {
    return keys.some((k) => this.down.has(k));
  }

  wasPressed(keys: KeyList): boolean {
    return keys.some((k) => this.pressed.has(k));
  }

  wasReleased(keys: KeyList): boolean {
    return keys.some((k) => this.released.has(k));
  }

  anyPressed(): boolean {
    return this.pressed.size > 0;
  }

  /** -1, 0 or 1 from left/right keys. */
  axisX(): number {
    return (this.isDown(Keys.right) ? 1 : 0) - (this.isDown(Keys.left) ? 1 : 0);
  }

  /** -1, 0 or 1 from up/down keys (down is positive). */
  axisY(): number {
    return (this.isDown(Keys.down) ? 1 : 0) - (this.isDown(Keys.up) ? 1 : 0);
  }

  /** Drops every held key and edge, e.g. when switching scenes. */
  clear(): void {
    this.down.clear();
    this.pendingPressed.clear();
    this.pendingReleased.clear();
    this.pressed.clear();
    this.released.clear();
  }

  /** Drops this step's edges so later code in the same step doesn't react to them. */
  consume(): void {
    this.pressed.clear();
    this.released.clear();
  }
}
