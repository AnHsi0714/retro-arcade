import { HEIGHT, WIDTH } from "./constants";

/**
 * Sizes the canvas to fit the window, keeping the aspect ratio (integer scaling
 * whenever it fits). The backing store matches the real display resolution and
 * a transform maps the logical WIDTH x HEIGHT space onto it, so games draw in
 * logical units while text is rasterized at full resolution instead of being
 * stretched and blurred.
 */
export function createScreen(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const g = canvas.getContext("2d");
  if (!g) throw new Error("Canvas 2D context is not available");

  const resize = () => {
    const fit = Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT);
    const scale = fit >= 1 ? Math.floor(fit) : fit;
    canvas.style.width = `${WIDTH * scale}px`;
    canvas.style.height = `${HEIGHT * scale}px`;

    const pixels = scale * (window.devicePixelRatio || 1);
    canvas.width = Math.round(WIDTH * pixels);
    canvas.height = Math.round(HEIGHT * pixels);
    // resizing the canvas resets the context state
    g.setTransform(pixels, 0, 0, pixels, 0, 0);
    g.imageSmoothingEnabled = false;
  };
  window.addEventListener("resize", resize);
  resize();
  return g;
}
