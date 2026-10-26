export interface Scene {
  enter?(): void;
  exit?(): void;
  update(dt: number): void;
  render(g: CanvasRenderingContext2D): void;
}

export class SceneManager {
  private current: Scene | null = null;

  get active(): Scene | null {
    return this.current;
  }

  switchTo(scene: Scene): void {
    this.current?.exit?.();
    this.current = scene;
    scene.enter?.();
  }

  update(dt: number): void {
    this.current?.update(dt);
  }

  render(g: CanvasRenderingContext2D): void {
    this.current?.render(g);
  }
}
